import { supabase } from './supabaseClient.js';

const elCargando = document.getElementById('estado-cargando');
const elError = document.getElementById('estado-error');
const elConDatos = document.getElementById('estado-con-datos');

// ── Cerrar sesión (mismo bloque que en eventos.js) ──
document.getElementById('btn-salir')?.addEventListener('click', async (evento) => {
  evento.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// Se usa la clase .oculto (display:none !important) y NO el atributo
// `hidden`: en ui.css varias clases traen display fijo y anulan `hidden`.
function mostrarSoloEstado(nombre) {
  elCargando.classList.toggle('oculto', nombre !== 'cargando');
  elError.classList.toggle('oculto', nombre !== 'error');
  elConDatos.classList.toggle('oculto', nombre !== 'con-datos');
}

function mostrarError(titulo, texto) {
  document.getElementById('error-titulo').textContent = titulo;
  document.getElementById('error-texto').textContent = texto;
  mostrarSoloEstado('error');
}

// Mismo mapeo de colores que en eventos.js (ui.css solo trae 4 etiquetas).
const ETIQUETA_POR_ESTADO = {
  cotizado:   { clase: 'etiqueta--pendiente',  texto: 'Cotizado' },
  confirmado: { clase: 'etiqueta--completado', texto: 'Confirmado' },
  en_montaje: { clase: 'etiqueta--proceso',    texto: 'En montaje' },
  cerrado:    { clase: 'etiqueta--proceso',    texto: 'Cerrado' },
  cancelado:  { clase: 'etiqueta--cancelado',  texto: 'Cancelado' },
};

// Botones que muestra el diseño de Figma en cada estado.
// Los que traen `accion` ya están conectados (HU-08: Confirmar). Los demás se
// dibujan deshabilitados hasta que les toque su historia (HU-12, HU-13, ...).
// Los estados finales (cerrado, cancelado) no tienen acciones.
const ACCIONES_POR_ESTADO = {
  cotizado:   [{ texto: 'Cancelar evento', clase: 'btn--peligro' }, { texto: 'Confirmar evento', clase: '', accion: 'confirmar' }],
  confirmado: [{ texto: 'Cancelar evento', clase: 'btn--peligro' }, { texto: 'Pasar a montaje', clase: '' }],
  en_montaje: [{ texto: 'Cerrar evento', clase: '' }],
  cerrado:    [],
  cancelado:  [],
};

// Regla de HU-06: la hoja de carga se edita mientras el evento no esté en montaje.
const ESTADOS_EDITABLES = ['cotizado', 'confirmado'];

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// Se arma con textContent (no innerHTML): estos textos los escribe una
// persona en un formulario y no deben interpretarse como HTML.
function celda(texto, clase) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  if (clase) td.className = clase;
  return td;
}

// ── Aviso con el resultado de confirmar (HU-08) ──
const elAviso = document.getElementById('aviso-confirmacion');
const elAvisoLista = document.getElementById('aviso-confirmacion-lista');

function limpiarAvisoConfirmacion() {
  elAviso.className = 'aviso oculto';
  elAvisoLista.innerHTML = '';
}

// tipo: 'exito' | 'error'. Todo con textContent: los nombres de equipo y de
// evento los escribe una persona y no deben interpretarse como HTML.
function mostrarAvisoConfirmacion(tipo, titulo, texto, conflictos = []) {
  elAviso.className = `aviso aviso--${tipo} mb-5`;
  document.getElementById('aviso-confirmacion-titulo').textContent = titulo;
  document.getElementById('aviso-confirmacion-texto').textContent = texto;
  elAvisoLista.innerHTML = '';

  conflictos.forEach((c) => {
    const estado = ETIQUETA_POR_ESTADO[c.evento_estado]?.texto ?? c.evento_estado;
    const li = document.createElement('li');
    li.textContent =
      `${c.equipo_clave} · ${c.equipo_nombre} — ya está en «${c.evento_nombre}» ` +
      `(${estado}), del ${formatearFecha(c.fecha_montaje)} al ${formatearFecha(c.fecha_fin)}`;
    elAvisoLista.appendChild(li);
  });
}

// La confirmación NO es un UPDATE desde el navegador: se llama a la función
// confirmar_evento del servidor, que revisa el traslape y cambia el estado en
// la misma transacción (hu08_confirmar_evento.sql). Lo que el navegador "sabía"
// al cargar la pantalla no cuenta; manda lo que responda el servidor.
async function confirmarEvento(boton, eventoId) {
  limpiarAvisoConfirmacion();
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Confirmando…';

  const { data, error } = await supabase.rpc('confirmar_evento', { p_evento_id: eventoId });

  if (error) {
    console.error('Error al confirmar el evento:', error);
    mostrarAvisoConfirmacion('error', 'No se pudo confirmar el evento.', 'Revisa tu conexión e inténtalo de nuevo.');
    boton.disabled = false;
    boton.textContent = textoOriginal;
    return;
  }

  if (data.ok) {
    await cargarDetalle(); // redibuja el estado y los botones del evento ya confirmado
    mostrarAvisoConfirmacion(
      'exito',
      'Evento confirmado.',
      data.piezas === 0
        ? 'Todavía no tiene equipo en su hoja de carga, así que por ahora no aparta ninguna pieza.'
        : `Sus ${data.piezas} pieza${data.piezas === 1 ? '' : 's'} quedan apartadas para estas fechas.`
    );
    return;
  }

  // El servidor lo rechazó.
  if (data.codigo === 'traslape') {
    mostrarAvisoConfirmacion(
      'error',
      'No se puede confirmar: hay equipo comprometido en fechas que se cruzan.',
      'Quita estas piezas de la hoja de carga o cambia las fechas del evento:',
      data.conflictos ?? []
    );
    boton.disabled = false;
    boton.textContent = textoOriginal;
    return;
  }

  if (data.codigo === 'estado_invalido') {
    // Alguien más lo cambió mientras esta pantalla estaba abierta: se recarga
    // para mostrar el estado real.
    await cargarDetalle();
    mostrarAvisoConfirmacion('error', 'No se pudo confirmar.', data.mensaje);
    return;
  }

  mostrarAvisoConfirmacion('error', 'No se pudo confirmar.', data.mensaje ?? 'Inténtalo de nuevo.');
  boton.disabled = false;
  boton.textContent = textoOriginal;
}

function pintarAcciones(estado, eventoId) {
  const contenedor = document.getElementById('acciones-estado');
  contenedor.innerHTML = '';

  const acciones = ACCIONES_POR_ESTADO[estado];
  if (!acciones) return; // estado desconocido: no se dibuja nada

  if (acciones.length === 0) {
    const nota = document.createElement('span');
    nota.className = 'pequeno tenue';
    nota.textContent = 'Estado final — ya no admite cambios';
    contenedor.appendChild(nota);
    return;
  }

  acciones.forEach(({ texto, clase, accion }) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `btn ${clase}`.trim();
    boton.textContent = texto;

    if (accion === 'confirmar') {
      boton.addEventListener('click', () => confirmarEvento(boton, eventoId));
    } else {
      boton.disabled = true; // todavía sin conectar (su historia es de otro sprint)
    }
    contenedor.appendChild(boton);
  });
}

function pintarEvento(evento) {
  document.getElementById('evento-nombre').textContent = evento.nombre;

  const info = ETIQUETA_POR_ESTADO[evento.estado] ?? { clase: '', texto: evento.estado };
  const etiqueta = document.getElementById('evento-estado');
  etiqueta.className = `etiqueta ${info.clase}`;
  etiqueta.textContent = info.texto;

  pintarAcciones(evento.estado, evento.id);

  document.getElementById('dato-cliente').textContent = evento.clientes?.nombre ?? '—';
  document.getElementById('dato-sede').textContent = evento.sede ?? '—';
  document.getElementById('dato-montaje').textContent = formatearFecha(evento.fecha_montaje);
  document.getElementById('dato-inicio').textContent = formatearFecha(evento.fecha_inicio);
  document.getElementById('dato-fin').textContent = formatearFecha(evento.fecha_fin);
  document.getElementById('dato-contacto').textContent = evento.clientes?.contacto || '—';

  if (evento.estado === 'cancelado') {
    document.getElementById('dato-motivo').textContent = evento.motivo_cancelacion || 'Sin motivo registrado';
    document.getElementById('aviso-cancelacion').classList.remove('oculto');
  }

  // Enlaces a las páginas de Emiliano; reciben el id del evento por la URL.
  const editable = ESTADOS_EDITABLES.includes(evento.estado);
  const id = encodeURIComponent(evento.id);

  const enlaceHoja = document.getElementById('enlace-hoja-carga');
  enlaceHoja.href = `hoja-de-carga.html?evento_id=${id}`;
  enlaceHoja.classList.toggle('oculto', !editable);

  const enlaceCuadrilla = document.getElementById('enlace-cuadrilla');
  enlaceCuadrilla.href = `asignar-cuadrilla.html?evento_id=${id}`;
  enlaceCuadrilla.classList.toggle('oculto', !editable);
}

function pintarEquipo(filas) {
  const body = document.getElementById('equipo-body');
  body.innerHTML = '';
  filas.forEach((fila) => {
    const tr = document.createElement('tr');
    tr.appendChild(celda(fila.equipos?.clave, 'mono'));
    tr.appendChild(celda(fila.equipos?.nombre));
    tr.appendChild(celda(fila.equipos?.categorias?.nombre));
    body.appendChild(tr);
  });
  document.getElementById('equipo-conteo').textContent =
    `${filas.length} pieza${filas.length === 1 ? '' : 's'}`;
  document.getElementById('equipo-vacio').classList.toggle('oculto', filas.length > 0);
  document.getElementById('equipo-tabla-contenedor').classList.toggle('oculto', filas.length === 0);
}

function pintarCuadrilla(filas) {
  const body = document.getElementById('cuadrilla-body');
  body.innerHTML = '';
  filas.forEach((fila) => {
    const tr = document.createElement('tr');
    tr.appendChild(celda(fila.usuarios?.nombre));
    tr.appendChild(celda(fila.funcion));
    body.appendChild(tr);
  });
  document.getElementById('cuadrilla-conteo').textContent =
    `${filas.length} técnico${filas.length === 1 ? '' : 's'}`;
  document.getElementById('cuadrilla-vacia').classList.toggle('oculto', filas.length > 0);
  document.getElementById('cuadrilla-tabla-contenedor').classList.toggle('oculto', filas.length === 0);
}

async function cargarDetalle() {
  const eventoId = new URLSearchParams(window.location.search).get('id');
  if (!eventoId) {
    mostrarError('Falta el evento', 'Abre esta página desde el listado de eventos.');
    return;
  }

  mostrarSoloEstado('cargando');
  limpiarAvisoConfirmacion();

  // Las tres consultas son independientes: se piden al mismo tiempo.
  const [resEvento, resEquipo, resCuadrilla] = await Promise.all([
    supabase
      .from('eventos')
      .select('id, nombre, sede, fecha_montaje, fecha_inicio, fecha_fin, estado, motivo_cancelacion, clientes(nombre, contacto)')
      .eq('id', eventoId)
      .maybeSingle(),
    supabase
      .from('evento_equipo')
      .select('id, equipos(clave, nombre, categorias(nombre))')
      .eq('evento_id', eventoId),
    supabase
      .from('evento_personal')
      .select('id, funcion, usuarios(nombre)')
      .eq('evento_id', eventoId),
  ]);

  if (resEvento.error || resEquipo.error || resCuadrilla.error) {
    console.error('Error al cargar el detalle:', resEvento.error, resEquipo.error, resCuadrilla.error);
    mostrarError('No pudimos cargar el evento', 'Revisa tu conexión e inténtalo de nuevo.');
    return;
  }

  // Con RLS activo, sin sesión la consulta no falla: regresa vacío.
  if (!resEvento.data) {
    mostrarError('No encontramos este evento', 'Puede que no exista, o que no hayas iniciado sesión.');
    return;
  }

  pintarEvento(resEvento.data);
  pintarEquipo(resEquipo.data ?? []);
  pintarCuadrilla(resCuadrilla.data ?? []);
  mostrarSoloEstado('con-datos');
}

cargarDetalle();
