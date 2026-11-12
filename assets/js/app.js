/* ==============================================================
 * SEGOPATINES · Interacción frontend
 * Los datos de MySQL se consultan mediante fetch + endpoints PHP.
 * Si MySQL no está configurado, se muestra un mapa de demostración,
 * pero NUNCA se simula un alquiler exitoso sin guardar en la BD.
 * ============================================================== */
(() => {
  'use strict';

  const DEMO_USER_ID = 1; // Usuario de ejemplo insertado por database.sql.
  const URL_ESTACIONES = 'php/api_estaciones.php';
  const URL_ALQUILER = 'php/alquilar.php';
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (texto) => String(texto).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);

  const datosDemo = [
    [1, 'Plaza del Azoguejo (Acueducto)', 'Plaza del Azoguejo, Segovia', 40.94778, -4.11842, 16, 9],
    [2, 'Plaza Mayor', 'Plaza Mayor, Segovia', 40.95066, -4.12552, 12, 4],
    [3, 'Estación de Autobuses', 'Paseo Ezequiel González, Segovia', 40.94128, -4.11997, 14, 11],
    [4, 'Alcázar', 'Plaza Reina Victoria Eugenia, Segovia', 40.95250, -4.13242, 10, 2],
    [5, 'Estación Guiomar (AVE)', 'Estación Segovia-Guiomar, Segovia', 40.91176, -4.13074, 20, 15],
    [6, 'Campus María Zambrano (UVa)', 'Plaza de la Universidad, Segovia', 40.94020, -4.11340, 12, 0],
    [7, 'José Zorrilla', 'Calle José Zorrilla, Segovia', 40.93799, -4.11583, 10, 6],
    [8, 'IE University', 'Calle Cardenal Zúñiga, Segovia', 40.95517, -4.11903, 12, 5],
    [9, 'Nueva Segovia', 'Barrio Nueva Segovia, Segovia', 40.92770, -4.10580, 10, 4]
  ].map(([id, nombre, direccion, latitud, longitud, capacidad, disponibles]) => ({
    id, nombre, direccion, latitud, longitud, capacidad,
    ocupados: disponibles, disponibles,
    patinetes: Array.from({ length: disponibles }, (_, index) => ({
      id: id * 100 + index, codigo: `DEMO-${id}-${index + 1}`, bateria: 90 - index * 3
    }))
  }));

  const estado = {
    estaciones: [],
    backend: false,
    seleccion: null,
    mapa: null,
    marcadores: new Map(),
    reserva: null,
    viaje: null,
    tarifa: 0.20,
    bloqueo: false,
    temporizador: null,
    toastTimeout: null
  };

  async function solicitarJSON(url, opciones = {}) {
    const respuesta = await fetch(url, { cache: 'no-store', ...opciones });
    let cuerpo;
    try {
      cuerpo = await respuesta.json();
    } catch (_) {
      throw new Error('El servidor no devolvió JSON. Abre la web desde Apache/PHP.');
    }
    if (!respuesta.ok || !cuerpo.ok) {
      throw new Error(cuerpo.mensaje || `Error HTTP ${respuesta.status}`);
    }
    return cuerpo;
  }

  async function enviarAccion(accion, parametros = {}) {
    if (!estado.backend) {
      throw new Error('Alquiler desactivado: configura MySQL e importa database.sql primero.');
    }
    return solicitarJSON(URL_ALQUILER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, usuario_id: DEMO_USER_ID, ...parametros })
    });
  }

  function mostrarToast(mensaje) {
    const elemento = $('#toast');
    elemento.textContent = mensaje;
    elemento.classList.add('visible');
    clearTimeout(estado.toastTimeout);
    estado.toastTimeout = setTimeout(() => elemento.classList.remove('visible'), 4200);
  }

  function mensajeReserva(mensaje, error = false) {
    const elemento = $('#bookingMessage');
    elemento.textContent = mensaje;
    elemento.className = `booking-message ${error ? 'error' : 'success'}`;
  }

  function encontrarEstacion(id) {
    return estado.estaciones.find((estacion) => estacion.id === Number(id));
  }

  async function cargarEstaciones() {
    try {
      const datos = await solicitarJSON(URL_ESTACIONES);
      estado.estaciones = datos.estaciones;
      estado.backend = true;
      $('#dataIndicator').textContent = '● Datos de MySQL · demo';
      $('#dataIndicator').classList.remove('offline');
    } catch (error) {
      estado.estaciones = datosDemo;
      estado.backend = false;
      $('#dataIndicator').textContent = '● Vista simulada · sin MySQL';
      $('#dataIndicator').classList.add('offline');
    }
    if (!encontrarEstacion(estado.seleccion)) {
      estado.seleccion = estado.estaciones[0]?.id ?? null;
    }
    renderizarEstaciones();
    renderizarMarcadores();
    renderizarDetalle();
    rellenarDevolucion();
  }

  async function cargarEstadoUsuario() {
    if (!estado.backend) {
      estado.viaje = null;
      estado.reserva = null;
      renderizarViaje();
      return;
    }
    try {
      const datos = await solicitarJSON(`${URL_ALQUILER}?accion=estado&usuario_id=${DEMO_USER_ID}`);
      estado.reserva = datos.reserva;
      estado.viaje = datos.viaje;
      estado.tarifa = Number(datos.tarifa_minuto) || .20;
      renderizarViaje();
    } catch (error) {
      console.warn('No se pudo recuperar la sesión del usuario de demostración.', error);
    }
  }

  function seleccionarEstacion(id, desplazar = false) {
    const estacion = encontrarEstacion(id);
    if (!estacion) return;
    estado.seleccion = estacion.id;
    renderizarEstaciones();
    renderizarMarcadores();
    renderizarDetalle();
    if (estado.mapa) {
      estado.mapa.panTo([estacion.latitud, estacion.longitud], { animate: true, duration: .4 });
    }
    if (desplazar) $('#stationDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderizarEstaciones() {
    const contenedor = $('#stationsList');
    contenedor.innerHTML = '';
    for (const estacion of estado.estaciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `station-button ${estado.seleccion === estacion.id ? 'active' : ''}`;
      boton.setAttribute('aria-label', `${estacion.nombre}: ${estacion.disponibles} patinetes disponibles de ${estacion.capacidad} plazas`);
      boton.innerHTML = `
        <span class="station-name">
          <span class="pin" aria-hidden="true">⌖</span>
          <span class="station-name-text">${escapeHTML(estacion.nombre)}</span>
        </span>
        <span class="availability ${estacion.disponibles === 0 ? 'zero' : ''}">${estacion.disponibles}/${estacion.capacidad}</span>`;
      boton.addEventListener('click', () => seleccionarEstacion(estacion.id, true));
      contenedor.appendChild(boton);
    }
  }

  function renderizarDetalle() {
    const estacion = encontrarEstacion(estado.seleccion);
    const detalle = $('#stationDetail');
    if (!estacion) {
      detalle.innerHTML = '<div><h3>No hay estaciones</h3><p>Inténtalo de nuevo.</p></div>';
      return;
    }
    const libre = estacion.disponibles > 0;
    detalle.innerHTML = `
      <div>
        <h3>${escapeHTML(estacion.nombre)}</h3>
        <p>${escapeHTML(estacion.direccion)}</p>
        <p class="meta">${estacion.disponibles} patinetes para alquilar · ${Math.max(0, estacion.capacidad - estacion.ocupados)} plazas libres</p>
      </div>
      <button type="button" id="openBookingBtn" class="button button-yellow" ${!libre || estado.viaje ? 'disabled' : ''}>
        ${estado.viaje ? 'Viaje activo' : libre ? 'Reservar aquí' : 'Sin patinetes'}
      </button>`;
    $('#openBookingBtn').addEventListener('click', () => abrirReserva(estacion.id));
  }

  function iniciarMapa() {
    if (typeof window.L === 'undefined') {
      $('#mapFallback').hidden = false;
      return;
    }
    estado.mapa = L.map('map', { scrollWheelZoom: false, zoomControl: true })
      .setView([40.9434, -4.1205], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(estado.mapa);
    renderizarMarcadores();
    setTimeout(() => estado.mapa.invalidateSize(), 150);
  }

  function renderizarMarcadores() {
    if (!estado.mapa) return;
    estado.marcadores.forEach((marcador) => marcador.remove());
    estado.marcadores.clear();
    for (const estacion of estado.estaciones) {
      const sinPatinetes = estacion.disponibles === 0;
      const seleccionado = estacion.id === estado.seleccion;
      const icono = L.divIcon({
        className: '',
        html: `<div class="station-map-marker ${sinPatinetes ? 'zero' : ''} ${seleccionado ? 'active' : ''}" aria-hidden="true">${estacion.disponibles}</div>`,
        iconSize: [31, 31],
        iconAnchor: [15, 15]
      });
      const marcador = L.marker([estacion.latitud, estacion.longitud], {
        icon: icono, title: estacion.nombre
      }).addTo(estado.mapa);

      // Popup construido con nodos DOM; no se introduce HTML de usuarios.
      const popup = document.createElement('div');
      popup.className = 'map-popup';
      const titulo = document.createElement('strong');
      titulo.textContent = estacion.nombre;
      const plazas = document.createElement('span');
      plazas.textContent = `${estacion.disponibles} patinetes disponibles · ${estacion.capacidad} plazas`;
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = 'Ver estación';
      boton.addEventListener('click', () => {
        marcador.closePopup();
        seleccionarEstacion(estacion.id, true);
      });
      popup.append(titulo, plazas, boton);
      marcador.bindPopup(popup, { maxWidth: 240 });
      marcador.on('click', () => {
        estado.seleccion = estacion.id;
        renderizarEstaciones();
        renderizarDetalle();
      });
      estado.marcadores.set(estacion.id, marcador);
    }
  }

  function abrirReserva(idEstacion) {
    const estacion = encontrarEstacion(idEstacion);
    if (!estacion) return;
    if (estado.viaje) {
      mostrarToast('Finaliza tu viaje anterior antes de reservar otro.');
      return;
    }
    estado.seleccion = estacion.id;
    $('#dialogStationName').textContent = estacion.nombre;
    const selector = $('#scooterSelect');
    selector.innerHTML = '';

    if (estado.reserva) {
      const opcion = document.createElement('option');
      opcion.value = estado.reserva.patinete_id;
      opcion.textContent = `${estado.reserva.codigo} · reservado para ti`;
      selector.appendChild(opcion);
      selector.disabled = true;
      $('#reserveBtn').hidden = true;
      $('#startBtn').hidden = false;
      $('#cancelReserveBtn').hidden = false;
      $('#bookingAvailability').textContent = 'Tu reserva está activa. Llega a la bancada y pulsa Desbloquear e iniciar.';
      $('#dialogStationName').textContent = encontrarEstacion(estado.reserva.estacion_id)?.nombre || estacion.nombre;
      mensajeReserva(`Tu patinete ${estado.reserva.codigo} está reservado.`, false);
    } else {
      for (const patinete of estacion.patinetes) {
        const opcion = document.createElement('option');
        opcion.value = patinete.id;
        opcion.textContent = `${patinete.codigo} · batería ${patinete.bateria}%`;
        selector.appendChild(opcion);
      }
      selector.disabled = !estado.backend;
      $('#reserveBtn').hidden = false;
      $('#reserveBtn').disabled = estacion.patinetes.length === 0 || !estado.backend;
      $('#startBtn').hidden = true;
      $('#cancelReserveBtn').hidden = true;
      $('#bookingAvailability').textContent = estado.backend
        ? 'Reserva gratis durante 10 minutos. Precio del viaje: 0,20 €/min. Sin pago real.'
        : 'Necesitas iniciar PHP y configurar MySQL para reservar. El mapa sigue disponible como demostración.';
      mensajeReserva('', false);
    }
    $('#bookingDialog').showModal();
  }

  async function ejecutarConBloqueo(accion) {
    if (estado.bloqueo) return;
    estado.bloqueo = true;
    for (const boton of document.querySelectorAll('#bookingDialog button, #finishTripBtn')) boton.disabled = true;
    try {
      await accion();
    } catch (error) {
      mostrarToast(error.message);
      mensajeReserva(error.message, true);
    } finally {
      estado.bloqueo = false;
      $('#startBtn').disabled = false;
      $('#cancelReserveBtn').disabled = false;
      $('#finishTripBtn').disabled = false;
      const estacion = encontrarEstacion(estado.seleccion);
      $('#reserveBtn').disabled = !estado.backend || !estacion || estacion.disponibles === 0;
    }
  }

  async function reservarPatinete() {
    await ejecutarConBloqueo(async () => {
      const id = Number($('#scooterSelect').value);
      if (!id) throw new Error('Selecciona un patinete disponible.');
      const respuesta = await enviarAccion('reservar', { patinete_id: id });
      estado.reserva = {
        patinete_id: respuesta.patinete_id,
        codigo: respuesta.codigo,
        estacion_id: respuesta.estacion_id,
        reserva_hasta: respuesta.reserva_hasta
      };
      await cargarEstaciones();
      $('#bookingDialog').close();
      mostrarToast(`Reserva confirmada: ${respuesta.codigo}. Tienes 10 minutos.`);
      abrirReserva(respuesta.estacion_id);
    });
  }

  async function cancelarReserva() {
    await ejecutarConBloqueo(async () => {
      if (!estado.reserva) return;
      const id = estado.reserva.patinete_id;
      await enviarAccion('cancelar', { patinete_id: Number(id) });
      estado.reserva = null;
      $('#bookingDialog').close();
      await cargarEstaciones();
      mostrarToast('Reserva cancelada.');
    });
  }

  async function iniciarViaje() {
    await ejecutarConBloqueo(async () => {
      if (!estado.reserva) throw new Error('Reserva antes de desbloquear.');
      const respuesta = await enviarAccion('iniciar', {
        patinete_id: Number(estado.reserva.patinete_id)
      });
      estado.reserva = null;
      $('#bookingDialog').close();
      await cargarEstadoUsuario();
      await cargarEstaciones();
      mostrarToast(`Viaje iniciado con ${respuesta.codigo}. ¡Buen trayecto!`);
      $('#travelPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function rellenarDevolucion() {
    const selector = $('#returnStation');
    const anterior = selector.value;
    selector.innerHTML = '<option value="">Selecciona una bancada de devolución</option>';
    for (const estacion of estado.estaciones) {
      const libres = Math.max(0, estacion.capacidad - estacion.ocupados);
      const opcion = document.createElement('option');
      opcion.value = estacion.id;
      opcion.disabled = libres === 0;
      opcion.textContent = `${estacion.nombre} · ${libres} plazas libres`;
      selector.appendChild(opcion);
    }
    if ([...selector.options].some((opcion) => opcion.value === anterior && !opcion.disabled)) selector.value = anterior;
  }

  function convertirFechaUTC(fechaSQL) {
    // MySQL DATETIME almacena UTC sin sufijo; se lo añadimos antes de parsear.
    if (!fechaSQL) return new Date();
    const iso = fechaSQL.includes('T') ? fechaSQL : fechaSQL.replace(' ', 'T') + 'Z';
    return new Date(iso);
  }

  function actualizarCronometro() {
    if (!estado.viaje) return;
    const segundos = Math.max(0, Math.floor((Date.now() - convertirFechaUTC(estado.viaje.inicio).getTime()) / 1000));
    const minutos = String(Math.floor(segundos / 60)).padStart(2, '0');
    const resto = String(segundos % 60).padStart(2, '0');
    $('#travelTimer').textContent = `${minutos}:${resto}`;
    $('#travelDescription').textContent = `${estado.viaje.codigo} · ${(Math.max(1, Math.ceil(segundos / 60)) * estado.tarifa).toFixed(2).replace('.', ',')} € estimados`;
  }

  function renderizarViaje() {
    $('#travelPanel').hidden = !estado.viaje;
    if (estado.viaje) {
      actualizarCronometro();
      if (!estado.temporizador) estado.temporizador = setInterval(actualizarCronometro, 1000);
    } else if (estado.temporizador) {
      clearInterval(estado.temporizador);
      estado.temporizador = null;
    }
    renderizarDetalle();
  }

  async function finalizarViaje() {
    await ejecutarConBloqueo(async () => {
      const idEstacion = Number($('#returnStation').value);
      if (!idEstacion) throw new Error('Selecciona una bancada de devolución con plazas libres.');
      const respuesta = await enviarAccion('finalizar', { estacion_id: idEstacion });
      estado.viaje = null;
      renderizarViaje();
      $('#receiptText').textContent = `Viaje #${respuesta.viaje_id} · ${respuesta.codigo} · ${respuesta.minutos} minuto(s) · Total ${Number(respuesta.importe).toFixed(2).replace('.', ',')} € (no cobrado).`;
      $('#receiptPanel').hidden = false;
      await cargarEstaciones();
      mostrarToast('Devolución confirmada. ¡Gracias por viajar con Segopatines!');
      $('#receiptPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function configurarEventos() {
    $('#menuToggle').addEventListener('click', () => {
      const abierto = $('#mainNav').classList.toggle('open');
      $('#menuToggle').setAttribute('aria-expanded', String(abierto));
    });
    document.querySelectorAll('.main-nav a').forEach((enlace) => {
      enlace.addEventListener('click', () => {
        $('#mainNav').classList.remove('open');
        $('#menuToggle').setAttribute('aria-expanded', 'false');
      });
    });
    $('#reserveBtn').addEventListener('click', reservarPatinete);
    $('#startBtn').addEventListener('click', iniciarViaje);
    $('#cancelReserveBtn').addEventListener('click', cancelarReserva);
    $('#finishTripBtn').addEventListener('click', finalizarViaje);
    $('#receiptClose').addEventListener('click', () => $('#receiptPanel').hidden = true);
    $('#bookingDialog').addEventListener('click', (evento) => {
      if (evento.target === $('#bookingDialog')) $('#bookingDialog').close();
    });
  }

  async function iniciarApp() {
    configurarEventos();
    iniciarMapa();
    await cargarEstaciones();
    await cargarEstadoUsuario();

    // Consulta periódica: no es telemetría física en tiempo real, sino refresco BD.
    setInterval(async () => {
      if (!estado.bloqueo) {
        await cargarEstaciones();
        await cargarEstadoUsuario();
      }
    }, 20000);
  }

  document.addEventListener('DOMContentLoaded', iniciarApp);
})();
