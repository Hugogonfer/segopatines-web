# Segopatines — Proyecto web Full-Stack

Prototipo académico de una red de patinetes eléctricos con bancada fija en Segovia, diseñado a partir de las capturas de referencia. **No representa estaciones existentes ni una empresa en funcionamiento.**

## 1. Estructura del proyecto

```text
segopatines_web/
├── index.html                      # Página web semántica, secciones y diálogos
├── database.sql                    # Creación de tablas + datos de demostración
├── README.md                       # Instrucciones de instalación
├── assets/
│   ├── css/
│   │   └── style.css               # Estilos responsive
│   ├── js/
│   │   └── app.js                  # Leaflet, fetch, reserva, alquiler, devolución
│   └── img/
│       ├── logo.png                # Logotipo del documento del proyecto
│       ├── patinete.jpg            # Foto de referencia recortada de la captura
│       ├── bancada-banner.jpg      # Banner recortado de la captura
│       ├── hero-respaldo.jpg       # Respaldo local del Acueducto
│       └── mapa-respaldo.jpg       # Respaldo local de la sección mapa
└── php/
    ├── .htaccess                   # Deniega acceso HTTP directo a conexion.php
    ├── conexion.php                # Configuración PDO + conexión
    ├── api_estaciones.php          # GET: estaciones y scooters libres
    └── alquilar.php                # GET estado; POST reservar/cancelar/iniciar/finalizar
```

## 2. Requisitos

- PHP 8.1 o superior, con la extensión `pdo_mysql` activada.
- MySQL 8 o MariaDB 10.5 o superior, con InnoDB.
- Apache con PHP, el servidor embebido de PHP o vuestro Docker LAMP.
- Internet para el mapa Leaflet/OpenStreetMap y la fotografía principal. Hay fotografías locales de respaldo.

## 3. Instalar con XAMPP

1. Copia `segopatines_web` dentro de `C:\xampp\htdocs\` (Windows) o en el directorio `htdocs` de XAMPP.
2. En el panel de XAMPP, inicia **Apache** y **MySQL**.
3. Entra en `http://localhost/phpmyadmin/` → pestaña **SQL** → pega todo `database.sql` y ejecútalo. También puedes usar **Importar** y seleccionar el archivo.
4. Revisa `php/conexion.php`. Los valores por defecto son `localhost`, base de datos `segopatines`, usuario `root`, contraseña vacía.
5. Abre `http://localhost/segopatines_web/`.

**Importante:** Ejecutar `database.sql` de nuevo borra y vuelve a crear las cuatro tablas con los datos demo.

## 4. Instalar con Docker LAMP (contenedores de clase)

1. Copia la carpeta a la ruta de tu volumen web de Docker; por ejemplo, a la carpeta que termina montada como `/var/www/html/segopatines_web` dentro del contenedor Apache/PHP.
2. En `php/conexion.php`, configura el host `db` si tu servicio de MariaDB se llama así. Puedes hacerlo mediante variables de entorno PHP:

   ```text
   DB_HOST=db
   DB_PORT=3306
   DB_NAME=segopatines
   DB_USER=root
   DB_PASS=CONTRASENA_DEL_CONTENEDOR
   ```

   Si tu Docker no transmite esas variables a PHP, modifica los valores tras `getenv(...) ?: ...` en `conexion.php` o configúralas en el servicio `environment` de tu `docker-compose.yml`.
3. Importa `database.sql` desde `http://localhost:8080/` si phpMyAdmin corre en ese puerto.
4. Visita `http://localhost/segopatines_web/` si Apache expone el puerto 80.

## 5. Alternativa con servidor PHP integrado

Si tienes MySQL funcionando, abre una terminal dentro de `segopatines_web/` y ejecuta:

```bash
php -S localhost:8000
```

Luego entra en `http://localhost:8000/`.

**No abras `index.html` usando doble clic (`file:///...`)** si quieres usar el backend. La API requiere un servidor PHP.

## 6. Prueba del recorrido completo

1. Verifica que la etiqueta junto a estaciones dice **Datos de MySQL · demo** (si dice *Vista simulada · sin MySQL*, el backend todavía no funciona).
2. Selecciona una estación con disponibilidad, como **Plaza del Azoguejo**.
3. Haz clic en **Reservar aquí**, selecciona un patinete y pulsa **Reservar 10 minutos**.
4. Pulsa **Desbloquear e iniciar**. El contador de tiempo comenzará y el scooter desaparecerá de la bancada de origen.
5. Elige una estación de devolución con plazas libres y pulsa **Finalizar viaje**.
6. Aparece un recibo de demostración con los minutos cobrados y el importe. La ocupación de la estación se actualiza en MySQL.

Si recargas la web durante una reserva o un viaje, el estado se recupera mediante `GET php/alquilar.php?accion=estado&usuario_id=1`.

## 7. API PHP

**`GET php/api_estaciones.php`** devuelve las estaciones con `id`, `nombre`, `direccion`, `latitud`, `longitud`, `capacidad`, `ocupados`, `disponibles` y `patinetes` con batería suficiente.

**`GET php/alquilar.php?accion=estado&usuario_id=1`** devuelve la reserva activa y/o el viaje activo de ese usuario de prueba.

**`POST php/alquilar.php`** espera JSON. Ejemplos:

```json
{"accion":"reservar","usuario_id":1,"patinete_id":1}
```
```json
{"accion":"iniciar","usuario_id":1,"patinete_id":1}
```
```json
{"accion":"finalizar","usuario_id":1,"estacion_id":2}
```
```json
{"accion":"cancelar","usuario_id":1,"patinete_id":1}
```

La reserva dura 10 minutos. El importe ilustrativo es **0,20 €/minuto**, facturado por minuto comenzado con un mínimo de 1 minuto. Se ajusta en `TARIFA_MINUTO` dentro de `php/alquilar.php`.

## 8. Seguridad y límites del prototipo

El código usa PDO con consultas preparadas, validaciones y transacciones InnoDB con `FOR UPDATE` para las operaciones que cambian el estado de los scooters. **No debe publicarse como un negocio real sin trabajo adicional:**

- Autenticación segura, autorizaciones basadas en la sesión y CSRF. El ID 1 es un usuario demo y no identifica a una persona autenticada.
- Registro de usuarios con verificación de edad/requisitos, contratos y política de privacidad RGPD.
- Pasarela de pago certificada que tokenice las tarjetas; no almacenar datos completos de tarjetas en MySQL.
- Integración IoT con GPS, control físico de bloqueo, anclaje a bancada y telemetría.
- Certificaciones y requisitos normativos VMP, licencias municipales, pólizas, privacidad, accesibilidad y revisión legal antes del lanzamiento.
- Las coordenadas y cantidades son **hipotéticas**; no constituyen la ubicación de estaciones autorizadas.
- Verificación de retorno físicamente y alertas por batería insuficiente; el desgaste mostrado es una aproximación.

## 9. Fotografías y recursos

- **Logo:** extraído del documento del propio proyecto Segopatines proporcionado por el equipo.
- **Patinete / banner / respaldo del mapa y Acueducto:** recortes de las capturas de ejemplo facilitadas por el usuario; se utilizan de forma ilustrativa.
- **Acueducto (foto principal en línea):** Diego Delso, *Acueducto, Segovia, España, 2024-06-14, DD 10.jpg*, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Acueducto,_Segovia,_Espa%C3%B1a,_2024-06-14,_DD_10.jpg), CC BY-SA 4.0. Si se redistribuye o transforma la fotografía deben respetarse sus condiciones de atribución y licencia.
- **Mapa:** [OpenStreetMap](https://www.openstreetmap.org/copyright), servido con Leaflet, sujeto a los términos de los proveedores de teselas.
- **Leaflet 1.9.4:** biblioteca de código abierto obtenida por CDN de unpkg.com.

> Este sitio es un prototipo funcional **a nivel de software y base de datos**, no una app pública de movilidad operativa.
