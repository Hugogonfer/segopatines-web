<?php
/**
 * GET /php/api_estaciones.php
 * Lista las estaciones y los patinetes alquilables en cada bancada.
 * La disponibilidad procede de MySQL; no hay hardware IoT real.
 */
declare(strict_types=1);
require_once __DIR__ . '/conexion.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido']);
    exit;
}

try {
    $pdo = obtenerConexion();

    // Una reserva caducada vuelve a ser seleccionable sin trabajo cron.
    $sql = "SELECT e.id, e.nombre, e.direccion, e.latitud, e.longitud,
                   e.capacidad, COUNT(p.id) AS ocupados,
                   COALESCE(SUM(CASE
                     WHEN p.estado = 'disponible' OR
                          (p.estado = 'reservado' AND p.reserva_hasta <= UTC_TIMESTAMP())
                     THEN 1 ELSE 0 END), 0) AS disponibles
            FROM estaciones e
            LEFT JOIN patinetes p ON p.estacion_id = e.id
            WHERE e.activa = 1
            GROUP BY e.id, e.nombre, e.direccion, e.latitud, e.longitud, e.capacidad
            ORDER BY e.id";
    $filas = $pdo->query($sql)->fetchAll();

    $sqlPatinetes = "SELECT id, codigo, estacion_id, bateria
                    FROM patinetes
                    WHERE estacion_id IS NOT NULL
                      AND bateria >= 20
                      AND (estado = 'disponible' OR
                          (estado = 'reservado' AND reserva_hasta <= UTC_TIMESTAMP()))
                    ORDER BY bateria DESC, id ASC";
    $scooters = $pdo->query($sqlPatinetes)->fetchAll();

    $estaciones = [];
    foreach ($filas as $fila) {
        $id = (int) $fila['id'];
        $estaciones[$id] = [
            'id' => $id,
            'nombre' => $fila['nombre'],
            'direccion' => $fila['direccion'],
            'latitud' => (float) $fila['latitud'],
            'longitud' => (float) $fila['longitud'],
            'capacidad' => (int) $fila['capacidad'],
            'ocupados' => (int) $fila['ocupados'],
            'disponibles' => 0,
            'patinetes' => [],
        ];
    }

    foreach ($scooters as $scooter) {
        $id = (int) $scooter['estacion_id'];
        if (!isset($estaciones[$id])) {
            continue;
        }
        $estaciones[$id]['patinetes'][] = [
            'id' => (int) $scooter['id'],
            'codigo' => $scooter['codigo'],
            'bateria' => (int) $scooter['bateria'],
        ];
        $estaciones[$id]['disponibles']++;
    }

    echo json_encode([
        'ok' => true,
        'modo' => 'base_de_datos_demo',
        'actualizado' => gmdate('c'),
        'estaciones' => array_values($estaciones),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('Segopatines / api_estaciones: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode([
        'ok' => false,
        'mensaje' => 'No se pudo acceder a MySQL. Revisa la conexión y la importación de database.sql.'
    ], JSON_UNESCAPED_UNICODE);
}
