import './pwa.js';
import { exigirRol, cerrarSesion } from './guardia.js';
import { cargarMisEventos } from './datos-tecnico.js';

// Pantalla solo para técnicos. Sin sesión va al login; si entra un
// coordinador lo manda a su inicio. Lo demás del archivo no corre antes.
const perfil = await exigirRol('tecnico');

// Cierra la sesión y borra del teléfono la copia local de los datos.
document.getElementById('btn-salir')?.addEventListener('click', (evento) => {
  evento.preventDefault();
  cerrarSesion();
});

// Pantalla de la hoja de carga de un evento (HU-09: solo lectura; HU-10 y
// HU-11 le agregan marcar salida y registrar retorno).
// Si es null, las tarjetas se muestran sin enlace ni flecha.
const RUTA_HOJA_CARGA = '/tecnico-hoja-carga.html';

const elCargando   = document.getElementById('estado-cargando');
const elError      = document.getElementById('estado-error');
const elVacio      = document.getElementById('estado-vacio');
const elLista      = document.getElementById('lista-eventos');
const elResumen    = document.getElementById('resumen');
const elAvisoDatos = document.getElementById('aviso-datos');
const elErrorTitulo = document.getElementById('error-titulo');
const elErrorTexto  = document.getElementById('error-texto');

const TEXTO_ERROR_RED = {
  titulo: 'No pudimos cargar tus eventos',
  texto: 'Revisa tu conexión e inténtalo de nuevo.',
};

// Una etiqueta por estado. ui.css trae justo cuatro colores más el gris
// base, y coinciden con el diseño de Figma (ámbar, verde, gris, azul, rojo).
const ETIQUETA_POR_ESTADO = {
  en_montaje: { clase: 'etiqueta--pendiente',  texto: 'En montaje' },
  confirmado: { clase: 'etiqueta--completado', texto: 'Confirmado' },
  cotizado:   { clase: '',                     texto: 'Cotizado' },
  cerrado:    { clase: 'etiqueta--proceso',    texto: 'Cerrado' },
  cancelado:  { clase: 'etiqueta--cancelado',  texto: 'Cancelado' },
};

const ICONO_FLECHA =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

// "23 sep · 06:30" (según la zona horaria del teléfono).
// Se arma por partes porque el separador entre día y mes cambia según el
// navegador ("23 sep" en unos, "23-sep" en otros).
const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

function formatearFechaHora(iso) {
  if (!iso) return '—';
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  const p = Object.fromEntries(FORMATO_FECHA.formatToParts(f).map(({ type, value }) => [type, value]));
  const hora = p.hour === '24' ? '00' : p.hour;   // algunos motores dan "24" a la medianoche
  return `${p.day} ${p.month.replace('.', '')} · ${hora}:${p.minute}`;
}

function mostrarSoloEstado(nombre) {
  elCargando.classList.toggle('oculto', nombre !== 'cargando');
  elError.classList.toggle('oculto',    nombre !== 'error');
  elVacio.classList.toggle('oculto',    nombre !== 'vacio');
  elLista.classList.toggle('oculto',    nombre !== 'con-datos');
}

function texto(etiqueta, contenido, clase, estilo) {
  const el = document.createElement(etiqueta);
  el.textContent = contenido;   // textContent: lo escrito por usuarios nunca se interpreta como HTML
  if (clase) el.className = clase;
  if (estilo) el.style.cssText = estilo;
  return el;
}

function crearTarjeta(evento) {
  const conEnlace = RUTA_HOJA_CARGA !== null;
  const tarjeta = document.createElement(conEnlace ? 'a' : 'div');
  tarjeta.className = 'tarjeta';
  tarjeta.style.cssText = 'display:flex; align-items:center; gap:var(--e-3); color:inherit; text-decoration:none';
  if (conEnlace) tarjeta.href = `${RUTA_HOJA_CARGA}?evento_id=${encodeURIComponent(evento.id)}`;

  const info = document.createElement('div');
  info.style.cssText = 'flex:1 1 0; min-width:0';
  info.append(
    texto('p', evento.nombre, 'mb-0', 'font-weight:700; overflow-wrap:anywhere'),
    texto('p', evento.sede, 'pequeno tenue mb-0', 'margin-top:var(--e-1); overflow-wrap:anywhere'),
  );

  const meta = document.createElement('div');
  meta.style.cssText = 'display:flex; align-items:center; justify-content:space-between; ' +
                       'flex-wrap:wrap; gap:var(--e-2); margin-top:var(--e-3)';
  const et = ETIQUETA_POR_ESTADO[evento.estado] ?? { clase: '', texto: evento.estado };
  meta.append(
    texto('span', `MONTAJE · ${formatearFechaHora(evento.fecha_montaje)}`, 'tenue',
          'font-size:var(--t-xs); font-weight:700; letter-spacing:.02em; text-transform:uppercase'),
    texto('span', et.texto, `etiqueta ${et.clase}`.trim()),
  );
  info.append(meta);
  tarjeta.append(info);

  if (conEnlace) {
    const flecha = document.createElement('span');
    flecha.className = 'tenue';
    flecha.style.cssText = 'flex:none; display:flex';
    flecha.innerHTML = ICONO_FLECHA;  // SVG fijo del código, sin datos de nadie
    tarjeta.append(flecha);
  }

  const item = document.createElement('li');
  item.append(tarjeta);
  return item;
}

function pintar(eventos) {
  elLista.replaceChildren(...eventos.map(crearTarjeta));
  elResumen.textContent = eventos.length === 0
    ? 'Sin eventos asignados'
    : `${eventos.length} asignado${eventos.length === 1 ? '' : 's'} · ordenados por montaje`;
  mostrarSoloEstado(eventos.length === 0 ? 'vacio' : 'con-datos');
}

async function cargarEventos() {
  mostrarSoloEstado('cargando');
  elAvisoDatos.classList.add('oculto');
  elResumen.textContent = '\u00a0';

  let resultado;
  try {
    // Con conexión: baja de Supabase y actualiza la copia local.
    // Sin conexión: usa la última copia guardada (datos-tecnico.js).
    // No se pide el cliente: un técnico no tiene permiso de leer esa tabla
    // (HU-16) y no lo necesita.
    resultado = await cargarMisEventos(perfil);
  } catch (error) {
    // Ni red ni base local (por ejemplo, el navegador bloquea IndexedDB).
    console.error('Error al cargar los eventos del técnico:', error);
    elErrorTitulo.textContent = TEXTO_ERROR_RED.titulo;
    elErrorTexto.textContent = TEXTO_ERROR_RED.texto;
    mostrarSoloEstado('error');
    return;
  }

  if (resultado.sinCopia) {
    // Sin conexión y sin nada guardado: es la primera vez en este teléfono.
    elErrorTitulo.textContent = 'Todavía no hay datos guardados';
    elErrorTexto.textContent = 'Conéctate a internet una vez para descargar tus eventos y su hoja de carga.';
    mostrarSoloEstado('error');
    return;
  }

  if (resultado.origen === 'local') {
    elAvisoDatos.textContent = `Mostrando los datos guardados el ${formatearFechaHora(resultado.descargadaEn)}.`;
    elAvisoDatos.classList.remove('oculto');
  }
  pintar(resultado.eventos);
}

document.getElementById('btn-reintentar').addEventListener('click', cargarEventos);
document.getElementById('btn-actualizar').addEventListener('click', cargarEventos);

cargarEventos();