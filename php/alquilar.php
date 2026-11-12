<?php
/**
 * API DEMO: reserva, cancelación, desbloqueo y devolución transaccionales.
 * POST JSON {accion: reservar|cancelar|iniciar|finalizar, usuario_id: 1,
 *            patinete_id: 1, estacion_id: 2}
 * GET  ?accion=estado&usuario_id=1
 *
 * Uso académico: NO incluye autenticación, cobro real ni geolocalización física.
 * En producción es obligatorio autenticar usuario y validar disponibilidad física.
 */
declare(strict_types=1);
require_once __DIR__ . '/conexion.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const TARIFA_MINUTO = 0.20; // Importe ilustrativo, en EUR.
const MINUTOS_RESERVA = 10;

function responder(array $datos, int $estado = 200): never
{
    http_response_code($estado);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function enteroPositivo(mixed $valor, string $campo): int
{
    $numero = filter_var($valor, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($numero === false || $numero === null) {
        throw new InvalidArgumentException("El campo {$campo} debe ser un entero positivo.");
    }
    return (int) $numero;
}

function comprobarUsuario(PDO $pdo, int $usuario): void
{
    // El bloqueo del usuario serializa solicitudes concurrentes de ese usuario.
    $consulta = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? FOR UPDATE');
    $consulta->execute([$usuario]);
    if (!$consulta->fetch()) {
        throw new DomainException('El usuario no existe en la base de datos.');
    }
}

function viajeActivo(PDO $pdo, int $usuario): ?array
{
    $consulta = $pdo->prepare(
        "SELECT v.id, v.patinete_id, v.estacion_origen_id, v.inicio, p.codigo
         FROM viajes v INNER JOIN patinetes p ON p.id = v.patinete_id
         WHERE v.usuario_id = ? AND v.estado = 'activo'
         ORDER BY v.id DESC LIMIT 1 FOR UPDATE"
    );
    $consulta->execute([$usuario]);
    $fila = $consulta->fetch();
    return $fila ?: null;
}

function patineteBloqueado(PDO $pdo, int $id): array
{
    $consulta = $pdo->prepare('SELECT * FROM patinetes WHERE id = ? FOR UPDATE');
    $consulta->execute([$id]);
    $fila = $consulta->fetch();
    if (!$fila) {
        throw new DomainException('El patinete indicado no existe.');
    }
    return $fila;
}

try {
    $metodo = $_SERVER['REQUEST_METHOD'];
    if ($metodo === 'GET' && ($_GET['accion'] ?? '') === 'estado') {
        $usuario = enteroPositivo($_GET['usuario_id'] ?? null, 'usuario_id');
        $pdo = obtenerConexion();
        $consulta = $pdo->prepare(
            "SELECT v.id, v.patinete_id, p.codigo, v.inicio, v.estacion_origen_id
             FROM viajes v JOIN patinetes p ON p.id = v.patinete_id
             WHERE v.usuario_id = ? AND v.estado = 'activo'
             ORDER BY v.id DESC LIMIT 1"
        );
        $consulta->execute([$usuario]);
        $viaje = $consulta->fetch() ?: null;
        $consulta = $pdo->prepare(
            "SELECT p.id AS patinete_id, p.codigo, p.estacion_id,
                    p.reserva_hasta
             FROM patinetes p
             WHERE p.reservado_por = ? AND p.estado = 'reservado'
               AND p.reserva_hasta > UTC_TIMESTAMP()
             LIMIT 1"
        );
        $consulta->execute([$usuario]);
        $reserva = $consulta->fetch() ?: null;
        responder(['ok' => true, 'viaje' => $viaje, 'reserva' => $reserva,
                   'tarifa_minuto' => TARIFA_MINUTO]);
    }

    if ($metodo !== 'POST') {
        header('Allow: GET, POST');
        responder(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);
    }

    // Los formularios deben mandar JSON; el backend nunca concatena datos en SQL.
    $entrada = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($entrada)) {
        throw new InvalidArgumentException('Envía un objeto JSON válido.');
    }
    $accion = (string) ($entrada['accion'] ?? '');
    if (!in_array($accion, ['reservar', 'cancelar', 'iniciar', 'finalizar'], true)) {
        throw new InvalidArgumentException('Acción no válida.');
    }
    $usuario = enteroPositivo($entrada['usuario_id'] ?? null, 'usuario_id');
    $pdo = obtenerConexion();
    $pdo->beginTransaction();
    comprobarUsuario($pdo, $usuario);

    if ($accion === 'reservar') {
        $patineteId = enteroPositivo($entrada['patinete_id'] ?? null, 'patinete_id');
        if (viajeActivo($pdo, $usuario)) {
            throw new DomainException('Ya tienes un viaje activo.');
        }
        $consulta = $pdo->prepare(
            "SELECT id FROM patinetes WHERE reservado_por = ? AND estado = 'reservado'
             AND reserva_hasta > UTC_TIMESTAMP() LIMIT 1"
        );
        $consulta->execute([$usuario]);
        if ($consulta->fetch()) {
            throw new DomainException('Ya tienes una reserva en vigor. Cancélala primero.');
        }
        $patinete = patineteBloqueado($pdo, $patineteId);
        $caducada = $patinete['estado'] === 'reservado' &&
                    $patinete['reserva_hasta'] !== null &&
                    strtotime($patinete['reserva_hasta'] . ' UTC') <= time();
        if (!($patinete['estado'] === 'disponible' || $caducada) ||
            $patinete['estacion_id'] === null || (int) $patinete['bateria'] < 20) {
            throw new DomainException('Este patinete ya no se puede reservar.');
        }
        $consulta = $pdo->prepare(
            "UPDATE patinetes SET estado = 'reservado', reservado_por = ?,
             reserva_hasta = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
             WHERE id = ?"
        );
        $consulta->execute([$usuario, $patineteId]);
        $pdo->commit();
        responder(['ok' => true, 'mensaje' => 'Patinete reservado durante 10 minutos.',
                   'patinete_id' => $patineteId, 'codigo' => $patinete['codigo'],
                   'estacion_id' => (int) $patinete['estacion_id'],
                   'reserva_hasta' => gmdate('c', time() + 600)]);
    }

    if ($accion === 'cancelar') {
        $patineteId = enteroPositivo($entrada['patinete_id'] ?? null, 'patinete_id');
        $patinete = patineteBloqueado($pdo, $patineteId);
        if ($patinete['estado'] !== 'reservado' || (int) $patinete['reservado_por'] !== $usuario) {
            throw new DomainException('No hay una reserva tuya para este patinete.');
        }
        $consulta = $pdo->prepare(
            "UPDATE patinetes SET estado = 'disponible', reservado_por = NULL,
             reserva_hasta = NULL WHERE id = ?"
        );
        $consulta->execute([$patineteId]);
        $pdo->commit();
        responder(['ok' => true, 'mensaje' => 'Reserva cancelada.']);
    }

    if ($accion === 'iniciar') {
        $patineteId = enteroPositivo($entrada['patinete_id'] ?? null, 'patinete_id');
        if (viajeActivo($pdo, $usuario)) {
            throw new DomainException('Ya tienes un viaje en curso.');
        }
        $patinete = patineteBloqueado($pdo, $patineteId);
        if ($patinete['estado'] !== 'reservado' ||
            (int) $patinete['reservado_por'] !== $usuario ||
            $patinete['reserva_hasta'] === null ||
            strtotime($patinete['reserva_hasta'] . ' UTC') <= time()) {
            throw new DomainException('Necesitas una reserva válida para desbloquearlo.');
        }
        $origen = (int) $patinete['estacion_id'];
        if ($origen < 1) {
            throw new DomainException('El patinete no está en una bancada.');
        }
        $consulta = $pdo->prepare(
            "UPDATE patinetes SET estado = 'en_uso', estacion_id = NULL,
             reservado_por = NULL, reserva_hasta = NULL WHERE id = ?"
        );
        $consulta->execute([$patineteId]);
        $consulta = $pdo->prepare(
            "INSERT INTO viajes (usuario_id, patinete_id, estacion_origen_id, inicio, estado)
             VALUES (?, ?, ?, UTC_TIMESTAMP(), 'activo')"
        );
        $consulta->execute([$usuario, $patineteId, $origen]);
        $viajeId = (int) $pdo->lastInsertId();
        $pdo->commit();
        responder(['ok' => true, 'mensaje' => 'Viaje iniciado. Patinete desbloqueado (simulación).',
                   'viaje_id' => $viajeId, 'patinete_id' => $patineteId,
                   'codigo' => $patinete['codigo'], 'tarifa_minuto' => TARIFA_MINUTO]);
    }

    if ($accion === 'finalizar') {
        $estacionId = enteroPositivo($entrada['estacion_id'] ?? null, 'estacion_id');
        $viaje = viajeActivo($pdo, $usuario);
        if (!$viaje) {
            throw new DomainException('No tienes ningún viaje activo.');
        }
        $patinete = patineteBloqueado($pdo, (int) $viaje['patinete_id']);
        if ($patinete['estado'] !== 'en_uso') {
            throw new DomainException('El patinete no figura como en uso.');
        }
        // Bloqueamos la estación para evitar dos devoluciones simultáneas
        // que excedan el número de plazas de la bancada.
        $consulta = $pdo->prepare('SELECT id, capacidad, activa FROM estaciones WHERE id = ? FOR UPDATE');
        $consulta->execute([$estacionId]);
        $estacion = $consulta->fetch();
        if (!$estacion || !(bool) $estacion['activa']) {
            throw new DomainException('La estación de devolución no está habilitada.');
        }
        $consulta = $pdo->prepare('SELECT COUNT(*) FROM patinetes WHERE estacion_id = ?');
        $consulta->execute([$estacionId]);
        if ((int) $consulta->fetchColumn() >= (int) $estacion['capacidad']) {
            throw new DomainException('Esa bancada está llena. Selecciona otra estación.');
        }
        // Se cobra cada minuto comenzado; mínimo un minuto.
        $consulta = $pdo->prepare('SELECT GREATEST(0, TIMESTAMPDIFF(SECOND, inicio, UTC_TIMESTAMP())) FROM viajes WHERE id = ?');
        $consulta->execute([(int) $viaje['id']]);
        $segundos = (int) $consulta->fetchColumn();
        $minutos = max(1, (int) ceil($segundos / 60));
        $importe = round($minutos * TARIFA_MINUTO, 2);
        $consulta = $pdo->prepare(
            "UPDATE viajes SET estado = 'finalizado', fin = UTC_TIMESTAMP(),
             estacion_destino_id = ?, minutos_cobrados = ?, importe = ? WHERE id = ?"
        );
        $consulta->execute([$estacionId, $minutos, $importe, (int) $viaje['id']]);
        $consulta = $pdo->prepare(
            "UPDATE patinetes SET estado = 'disponible', estacion_id = ?,
             bateria = GREATEST(0, bateria - LEAST(30, CEIL(? * 0.7)))
             WHERE id = ?"
        );
        $consulta->execute([$estacionId, $minutos, (int) $viaje['patinete_id']]);
        $pdo->commit();
        responder(['ok' => true, 'mensaje' => 'Viaje finalizado. Recibo de demostración.',
                   'viaje_id' => (int) $viaje['id'], 'codigo' => $viaje['codigo'],
                   'minutos' => $minutos, 'importe' => $importe,
                   'moneda' => 'EUR', 'estacion_id' => $estacionId]);
    }
} catch (InvalidArgumentException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    responder(['ok' => false, 'mensaje' => $e->getMessage()], 422);
} catch (DomainException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    responder(['ok' => false, 'mensaje' => $e->getMessage()], 409);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Segopatines / alquilar: ' . $e->getMessage());
    responder(['ok' => false, 'mensaje' => 'Error interno. Comprueba PHP, PDO MySQL y la base de datos.'], 503);
}
