import { exigirRol, cerrarSesion } from './guardia.js';
import { cargarHoja } from './datos-tecnico.js';

// Pantalla solo para técnicos (HU-09: ver la hoja de carga, con o sin conexión).
// Solo lectura: marcar salida (HU-10) y registrar retorno (HU-11) se agregan
// sobre esta misma pantalla.
const perfil = await exigirRol('tecnico');

document.getElementById('btn-salir')?.addEventListener('click', (evento) => {
  evento.preventDefault();
  cerrarSesion();
});

const elCargando  = document.getElementById('estado-cargando');
const elError     = document.getElementById('estado-error');
const elVacio     = document.getElementById('estado-vacio');
const elLista     = document.getElementById('lista-piezas');
const elSubtitulo = document.getElementById('subtitulo');
const elAvisoDatos = document.getElementById('aviso-datos');
const elErrorTitulo = document.getElementById('error-titulo');
const elErrorTexto  = document.getElementById('error-texto');

// Fecha y hora en la zona horaria del teléfono. Se arma por partes porque
// el separador entre día y mes cambia según el navegador ("23 sep" / "23-sep").
const FORMATO_DIA   = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' });
const FORMATO_HORA  = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

function partes(formato, iso) {
  const f = new Date(iso);
  if (!iso || Number.isNaN(f.getTime())) return null;
  return Object.fromEntries(formato.formatToParts(f).map(({ type, value }) => [type, value]));
}
function dia(iso) {
  const p = partes(FORMATO_DIA, iso);
  return p ? `${p.day} ${p.month.replace('.', '')}` : '';
}
function hora(iso) {
  const p = partes(FORMATO_HORA, iso);
  return p ? `${p.hour === '24' ? '00' : p.hour}:${p.minute}` : '';
}

function mostrarSoloEstado(nombre) {
  elCargando.classList.toggle('oculto', nombre !== 'cargando');
  elError.classList.toggle('oculto',    nombre !== 'error');
  elVacio.classList.toggle('oculto',    nombre !== 'vacio');
  elLista.classList.toggle('oculto',    nombre !== 'con-datos');
}

function mostrarError(titulo, textoError) {
  elErrorTitulo.textContent = titulo;
  elErrorTexto.textContent = textoError;
  elSubtitulo.textContent = ' ';
  mostrarSoloEstado('error');
}

const TEXTO_CONDICION = { buen_estado: 'buen estado', 'dañado': 'dañado', faltante: 'faltante' };

// Cada pieza tiene un estado, y se dice con TEXTO (no solo con color):
//   retorno registrado → "Retorno · buen estado"
//   salida registrada  → "Salida · 08:42"  (o "Salida · sin enviar" si aún no se sincroniza)
//   nada registrado    → "Pendiente"
function estadoDePieza(pieza) {
  if (pieza.retorno_registrado) {
    const condicion = TEXTO_CONDICION[pieza.condicion_retorno] ?? 'sin condición';
    return { clase: pieza.condicion_retorno === 'buen_estado' ? 'etiqueta--completado' : 'etiqueta--cancelado',
             texto: `Retorno · ${condicion}` };
  }
  if (pieza.salida_registrada) {
    return pieza.pendiente_envio
      ? { clase: 'etiqueta--pendiente', texto: 'Salida · sin enviar' }
      : { clase: '', texto: `Salida · ${hora(pieza.salida_registrada)}` };
  }
  return { clase: '', texto: 'Pendiente' };
}

function texto(etiqueta, contenido, clase, estilo) {
  const el = document.createElement(etiqueta);
  el.textContent = contenido;   // textContent: lo escrito por usuarios nunca se interpreta como HTML
  if (clase) el.className = clase;
  if (estilo) el.style.cssText = estilo;
  return el;
}

function crearTarjeta(pieza) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta';

  const estado = estadoDePieza(pieza);
  tarjeta.append(
    texto('p', pieza.clave, 'tenue mb-0',
          'font-size:var(--t-xs); font-weight:700; letter-spacing:.02em; text-transform:uppercase'),
    texto('p', pieza.nombre, 'mb-0', 'font-weight:700; margin-top:var(--e-1); overflow-wrap:anywhere'),
  );
  if (pieza.categoria) {
    tarjeta.append(texto('p', pieza.categoria, 'pequeno tenue mb-0', 'margin-top:var(--e-1)'));
  }
  const fila = document.createElement('div');
  fila.style.cssText = 'margin-top:var(--e-3)';
  fila.append(texto('span', estado.texto, `etiqueta ${estado.clase}`.trim()));
  tarjeta.append(fila);

  const item = document.createElement('li');
  item.append(tarjeta);
  return item;
}

async function cargar() {
  const eventoId = new URLSearchParams(window.location.search).get('evento_id');
  if (!eventoId) {
    mostrarError('Falta el evento', 'Abre la hoja de carga desde la lista de Mis eventos.');
    return;
  }

  mostrarSoloEstado('cargando');

  let r;
  try {
    // Con conexión: baja de Supabase y actualiza la copia local.
    // Sin conexión: usa la copia guardada (datos-tecnico.js).
    r = await cargarHoja(eventoId, perfil);
  } catch (error) {
    console.error('Error al cargar la hoja de carga:', error);
    mostrarError('No pudimos cargar la hoja de carga', 'Revisa tu conexión e inténtalo de nuevo.');
    return;
  }

  if (r.noExiste) {
    r.origen === 'local'
      ? mostrarError('Esta hoja no está guardada', 'Conéctate a internet para descargarla.')
      : mostrarError('No encontramos este evento', 'Puede que ya no esté asignado a ti.');
    return;
  }

  elSubtitulo.textContent = `${r.evento.nombre} · ${dia(r.evento.fecha_montaje)}`;

  if (r.origen === 'local') {
    elAvisoDatos.textContent = 'Mostrando la hoja guardada en este dispositivo.';
    elAvisoDatos.classList.remove('oculto');
  } else {
    elAvisoDatos.classList.add('oculto');
  }

  if (r.piezas.length === 0) {
    mostrarSoloEstado('vacio');
    return;
  }
  elLista.replaceChildren(...r.piezas.map(crearTarjeta));
  mostrarSoloEstado('con-datos');
}

cargar();