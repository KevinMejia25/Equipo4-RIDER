import { supabase } from './supabaseClient.js';

// ── Referencias a los bloques de estado que ya viven en eventos.html ──
const elCargando   = document.getElementById('estado-cargando');
const elVacio       = document.getElementById('estado-vacio');
const elError       = document.getElementById('estado-error');
const elConDatos    = document.getElementById('estado-con-datos');
const tbody         = document.getElementById('tabla-eventos-body');
const inputBuscar   = document.getElementById('buscar-evento');
const contador      = document.getElementById('contador-resultados');
const btnReintentar = document.getElementById('btn-reintentar');
const btnNuevo      = document.getElementById('btn-nuevo-evento');

// Guardamos la última lista completa para poder filtrarla en el cliente
// sin volver a pedirle datos a Supabase en cada tecla.
let eventosCache = [];

// Mapeo de estado del evento → clase de etiqueta (solo hay 4 colores
// disponibles en ui.css para 5 estados; ver nota en eventos.html).
const ETIQUETA_POR_ESTADO = {
  cotizado:    { clase: 'etiqueta--pendiente',  texto: 'Cotizado' },
  confirmado:  { clase: 'etiqueta--completado', texto: 'Confirmado' },
  en_montaje:  { clase: 'etiqueta--proceso',    texto: 'En montaje' },
  cerrado:     { clase: 'etiqueta--proceso',    texto: 'Cerrado' },
  cancelado:   { clase: 'etiqueta--cancelado',  texto: 'Cancelado' },
};

function formatearFecha(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return fecha.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// Nota: varios componentes de ui.css (.estado-vacio, .aviso, etc.) traen
// "display" fijo en su clase, lo que anula el atributo `hidden` de HTML.
// Usamos la clase utilitaria .oculto (display:none !important) que la
// propia hoja de estilos ya trae para este caso.
function mostrarSoloEstado(nombre) {
  const toggle = (el, mostrar) => el.classList.toggle('oculto', !mostrar);
  toggle(elCargando, nombre === 'cargando');
  toggle(elVacio,    nombre === 'vacio');
  toggle(elError,    nombre === 'error');
  toggle(elConDatos, nombre === 'con-datos');
}

function renderFila(evento) {
  const etiqueta = ETIQUETA_POR_ESTADO[evento.estado] ?? { clase: '', texto: evento.estado };
  const nombreCliente = evento.clientes?.nombre ?? '—';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${evento.nombre}</td>
    <td>${nombreCliente}</td>
    <td>${formatearFecha(evento.fecha_montaje)}</td>
    <td>${formatearFecha(evento.fecha_fin)}</td>
    <td><span class="etiqueta ${etiqueta.clase}">${etiqueta.texto}</span></td>
  `;
  return tr;
}

function renderLista(eventos) {
  tbody.innerHTML = '';
  eventos.forEach((ev) => tbody.appendChild(renderFila(ev)));
  contador.textContent = `${eventos.length} resultado${eventos.length === 1 ? '' : 's'}`;

  if (eventos.length === 0) {
    mostrarSoloEstado('vacio');
  } else {
    mostrarSoloEstado('con-datos');
  }
}

async function cargarEventos() {
  mostrarSoloEstado('cargando');

  // select con join implícito a clientes, ordenado por fecha de montaje
  const { data, error } = await supabase
    .from('eventos')
    .select('id, nombre, fecha_montaje, fecha_inicio, fecha_fin, estado, clientes(nombre)')
    .order('fecha_montaje', { ascending: true });

  if (error) {
    // Error de red o de Supabase: nunca dejamos la pantalla en blanco
    console.error('Error al cargar eventos:', error);
    mostrarSoloEstado('error');
    return;
  }

  eventosCache = data ?? [];
  renderLista(eventosCache);
}

// ── Buscador: filtra en el cliente sobre lo que ya se cargó ──
inputBuscar.addEventListener('input', () => {
  const termino = inputBuscar.value.trim().toLowerCase();

  if (!termino) {
    renderLista(eventosCache);
    return;
  }

  const filtrados = eventosCache.filter((ev) => {
    const nombreCliente = ev.clientes?.nombre?.toLowerCase() ?? '';
    return (
      ev.nombre.toLowerCase().includes(termino) ||
      nombreCliente.includes(termino)
    );
  });
  renderLista(filtrados);
});

btnReintentar.addEventListener('click', cargarEventos);
btnNuevo.addEventListener('click', () => {
  window.location.href = '/nuevo-evento.html';
});

document.getElementById('btn-salir')?.addEventListener('click', async (evento) => {
  evento.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

cargarEventos();