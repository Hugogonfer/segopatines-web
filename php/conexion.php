<?php
/**
 * Conexión PDO a MySQL/MariaDB.
 * XAMPP por defecto: localhost / root / contraseña vacía.
 * Docker: configurar DB_HOST=db y la contraseña de su instalación.
 */
declare(strict_types=1);

function obtenerConexion(): PDO
{
    $host = getenv('DB_HOST') ?: 'localhost';
    $puerto = getenv('DB_PORT') ?: '3306';
    $base = getenv('DB_NAME') ?: 'segopatines';
    $usuario = getenv('DB_USER') ?: 'root';
    $contrasena = getenv('DB_PASS') ?: '';

    $dsn = "mysql:host={$host};port={$puerto};dbname={$base};charset=utf8mb4";

    return new PDO($dsn, $usuario, $contrasena, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
