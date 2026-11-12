-- SEGOPATINES · BASE DE DATOS DEMOSTRATIVA (MySQL / MariaDB)
-- ATENCIÓN: reiniciar este script elimina los datos de las cuatro tablas.
CREATE DATABASE IF NOT EXISTS segopatines
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE segopatines;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS viajes;
DROP TABLE IF EXISTS patinetes;
DROP TABLE IF EXISTS estaciones;
DROP TABLE IF EXISTS usuarios;
SET FOREIGN_KEY_CHECKS = 1;

-- Usuarios de prueba. No se guardan tarjetas ni contraseñas.
CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE estaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  direccion VARCHAR(200) NOT NULL,
  latitud DECIMAL(10,7) NOT NULL,
  longitud DECIMAL(10,7) NOT NULL,
  capacidad SMALLINT UNSIGNED NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE patinetes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(18) NOT NULL UNIQUE,
  estacion_id INT UNSIGNED NULL,
  estado ENUM('disponible','reservado','en_uso','mantenimiento') NOT NULL DEFAULT 'disponible',
  bateria TINYINT UNSIGNED NOT NULL DEFAULT 100,
  modelo VARCHAR(100) NOT NULL DEFAULT 'Segopatines Urban',
  reservado_por INT UNSIGNED NULL,
  reserva_hasta DATETIME NULL COMMENT 'Instante UTC en que caduca la reserva',
  CONSTRAINT fk_patinete_estacion FOREIGN KEY (estacion_id) REFERENCES estaciones(id) ON DELETE SET NULL,
  CONSTRAINT fk_patinete_reserva FOREIGN KEY (reservado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_patinete_estacion (estacion_id, estado),
  INDEX idx_patinete_reservado (reservado_por, reserva_hasta)
) ENGINE=InnoDB;

CREATE TABLE viajes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  patinete_id INT UNSIGNED NOT NULL,
  estacion_origen_id INT UNSIGNED NOT NULL,
  estacion_destino_id INT UNSIGNED NULL,
  inicio DATETIME NOT NULL COMMENT 'UTC',
  fin DATETIME NULL COMMENT 'UTC',
  minutos_cobrados INT UNSIGNED NULL,
  importe DECIMAL(8,2) NULL,
  estado ENUM('activo','finalizado') NOT NULL DEFAULT 'activo',
  CONSTRAINT fk_viaje_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_viaje_patinete FOREIGN KEY (patinete_id) REFERENCES patinetes(id),
  CONSTRAINT fk_viaje_origen FOREIGN KEY (estacion_origen_id) REFERENCES estaciones(id),
  CONSTRAINT fk_viaje_destino FOREIGN KEY (estacion_destino_id) REFERENCES estaciones(id),
  INDEX idx_viaje_usuario_estado (usuario_id, estado)
) ENGINE=InnoDB;

-- Los nombres, emplazamientos y ocupaciones siguientes son SIMULADOS.
INSERT INTO usuarios (id, nombre, email) VALUES
(1, 'Usuario de demostración', 'demo@segopatines.local'),
(2, 'Cliente de ejemplo', 'cliente@segopatines.local');

INSERT INTO estaciones (id, nombre, direccion, latitud, longitud, capacidad, activa) VALUES
(1, 'Plaza del Azoguejo (Acueducto)', 'Plaza del Azoguejo, Segovia', 40.9477800, -4.1184200, 16, 1),
(2, 'Plaza Mayor', 'Plaza Mayor, Segovia', 40.9506600, -4.1255200, 12, 1),
(3, 'Estación de Autobuses', 'Paseo Ezequiel González, Segovia', 40.9412800, -4.1199700, 14, 1),
(4, 'Alcázar', 'Plaza Reina Victoria Eugenia, Segovia', 40.9525000, -4.1324200, 10, 1),
(5, 'Estación Guiomar (AVE)', 'Estación Segovia-Guiomar, Segovia', 40.9117600, -4.1307400, 20, 1),
(6, 'Campus María Zambrano (UVa)', 'Plaza de la Universidad, Segovia', 40.9402000, -4.1134000, 12, 1),
(7, 'José Zorrilla', 'Calle José Zorrilla, Segovia', 40.9379900, -4.1158300, 10, 1),
(8, 'IE University', 'Calle Cardenal Zúñiga, Segovia', 40.9551700, -4.1190300, 12, 1),
(9, 'Nueva Segovia', 'Barrio de Nueva Segovia, Segovia', 40.9277000, -4.1058000, 10, 1);

-- Cantidades iniciales parecidas a las capturas: 9/16, 4/12, 11/14, etc.
INSERT INTO patinetes (codigo, estacion_id, estado, bateria, modelo) VALUES
('SG-001', 1, 'disponible', 56, 'Segopatines Urban'),
('SG-002', 1, 'disponible', 75, 'Segopatines Urban'),
('SG-003', 1, 'disponible', 94, 'Segopatines Urban'),
('SG-004', 1, 'disponible', 69, 'Segopatines Urban'),
('SG-005', 1, 'disponible', 88, 'Segopatines Urban'),
('SG-006', 1, 'disponible', 63, 'Segopatines Urban'),
('SG-007', 1, 'disponible', 82, 'Segopatines Urban'),
('SG-008', 1, 'disponible', 57, 'Segopatines Urban'),
('SG-009', 1, 'disponible', 76, 'Segopatines Urban'),
('SG-010', 2, 'disponible', 95, 'Segopatines Urban'),
('SG-011', 2, 'disponible', 70, 'Segopatines Urban'),
('SG-012', 2, 'disponible', 89, 'Segopatines Urban'),
('SG-013', 2, 'disponible', 64, 'Segopatines Urban'),
('SG-014', 3, 'disponible', 83, 'Segopatines Urban'),
('SG-015', 3, 'disponible', 58, 'Segopatines Urban'),
('SG-016', 3, 'disponible', 77, 'Segopatines Urban'),
('SG-017', 3, 'disponible', 96, 'Segopatines Urban'),
('SG-018', 3, 'disponible', 71, 'Segopatines Urban'),
('SG-019', 3, 'disponible', 90, 'Segopatines Urban'),
('SG-020', 3, 'disponible', 65, 'Segopatines Urban'),
('SG-021', 3, 'disponible', 84, 'Segopatines Urban'),
('SG-022', 3, 'disponible', 59, 'Segopatines Urban'),
('SG-023', 3, 'disponible', 78, 'Segopatines Urban'),
('SG-024', 3, 'disponible', 97, 'Segopatines Urban'),
('SG-025', 4, 'disponible', 72, 'Segopatines Urban'),
('SG-026', 4, 'disponible', 91, 'Segopatines Urban'),
('SG-027', 5, 'disponible', 66, 'Segopatines Urban'),
('SG-028', 5, 'disponible', 85, 'Segopatines Urban'),
('SG-029', 5, 'disponible', 60, 'Segopatines Urban'),
('SG-030', 5, 'disponible', 79, 'Segopatines Urban'),
('SG-031', 5, 'disponible', 98, 'Segopatines Urban'),
('SG-032', 5, 'disponible', 73, 'Segopatines Urban'),
('SG-033', 5, 'disponible', 92, 'Segopatines Urban'),
('SG-034', 5, 'disponible', 67, 'Segopatines Urban'),
('SG-035', 5, 'disponible', 86, 'Segopatines Urban'),
('SG-036', 5, 'disponible', 61, 'Segopatines Urban'),
('SG-037', 5, 'disponible', 80, 'Segopatines Urban'),
('SG-038', 5, 'disponible', 99, 'Segopatines Urban'),
('SG-039', 5, 'disponible', 74, 'Segopatines Urban'),
('SG-040', 5, 'disponible', 93, 'Segopatines Urban'),
('SG-041', 5, 'disponible', 68, 'Segopatines Urban'),
('SG-042', 7, 'disponible', 87, 'Segopatines Urban'),
('SG-043', 7, 'disponible', 62, 'Segopatines Urban'),
('SG-044', 7, 'disponible', 81, 'Segopatines Urban'),
('SG-045', 7, 'disponible', 56, 'Segopatines Urban'),
('SG-046', 7, 'disponible', 75, 'Segopatines Urban'),
('SG-047', 7, 'disponible', 94, 'Segopatines Urban'),
('SG-048', 8, 'disponible', 69, 'Segopatines Urban'),
('SG-049', 8, 'disponible', 88, 'Segopatines Urban'),
('SG-050', 8, 'disponible', 63, 'Segopatines Urban'),
('SG-051', 8, 'disponible', 82, 'Segopatines Urban'),
('SG-052', 8, 'disponible', 57, 'Segopatines Urban'),
('SG-053', 9, 'disponible', 76, 'Segopatines Urban'),
('SG-054', 9, 'disponible', 95, 'Segopatines Urban'),
('SG-055', 9, 'disponible', 70, 'Segopatines Urban'),
('SG-056', 9, 'disponible', 89, 'Segopatines Urban');
