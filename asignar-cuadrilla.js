
import { supabase } from './supabaseClient.js';

// =====================================================
// ELEMENTOS
// =====================================================

const elCargando = document.getElementById('estado-cargando');
const elError = document.getElementById('estado-error');
const elConDatos = document.getElementById('estado-con-datos');

const elNombreEvento = document.getElementById('evento-nombre');
const elSelectTecnico = document.getElementById('tecnico-id');
const elFuncion = document.getElementById('funcion');
const elFormulario = document.getElementById('form-asignar');
const elBotonAgregar = document.getElementById('btn-agregar');

const elAviso = document.getElementById('aviso-formulario');
const elAvisoTexto = document.getElementById('aviso-formulario-texto');

const elCuadrillaBody = document.getElementById('cuadrilla-body');
const elCuadrillaVacia = document.getElementById('cuadrilla-vacia');
const elCuadrillaTabla = document.getElementById('cuadrilla-tabla-contenedor');
const elCuadrillaConteo = document.getElementById('cuadrilla-conteo');
const elAyudaTecnicos = document.getElementById('ayuda-tecnicos');

const elModal = document.getElementById('modal-quitar');
const elModalTexto = document.getElementById('modal-quitar-texto');
const btnCancelarQuitar = document.getElementById('btn-cancelar-quitar');
const btnConfirmarQuitar = document.getElementById('btn-confirmar-quitar');

// =====================================================
// EVENTO ACTUAL
// =====================================================

const parametros = new URLSearchParams(window.location.search);
const eventoId = parametros.get('evento_id') || parametros.get('id');

const urlDetalle = eventoId
  ? `detalle-evento.html?id=${encodeURIComponent(eventoId)}`
  : 'eventos.html';

document.getElementById('enlace-volver').href = urlDetalle;
document.getElementById('btn-regresar').href = urlDetalle;

let eventoActual = null;
let tecnicos = [];
let asignacionesEvento = [];
let asignacionesTodosEventos = [];
let eventosCache = [];
let asignacionPorQuitar = null;

// Solo estos estados bloquean la disponibilidad.
const ESTADOS_QUE_OCUPAN = ['confirmado', 'en_montaje'];

// =====================================================
// ESTADOS Y AVISOS
// =====================================================

function mostrarSoloEstado(estado) {
  elCargando.classList.toggle('oculto', estado !== 'cargando');
  elError.classList.toggle('oculto', estado !== 'error');
  elConDatos.classList.toggle('oculto', estado !== 'datos');
}

function mostrarError(titulo, texto) {
  document.getElementById('error-titulo').textContent = titulo;
  document.getElementById('error-texto').textContent = texto;
  mostrarSoloEstado('error');
}

function mostrarAviso(texto, tipo = 'error') {
  elAviso.className = `aviso aviso--${tipo} aviso-cuadrilla`;
  elAvisoTexto.textContent = texto;
}

function ocultarAviso() {
  elAviso.className = 'aviso aviso-cuadrilla oculto';
  elAvisoTexto.textContent = '';
}

function crearCelda(texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  return td;
}

function eventoEditable() {
  return eventoActual &&
    ['cotizado', 'confirmado'].includes(eventoActual.estado);
}

// =====================================================
// FECHAS Y DISPONIBILIDAD
// =====================================================

function obtenerFechaInicio(evento) {
  return evento.fecha_montaje || evento.fecha_inicio || null;
}

function obtenerFechaFin(evento) {
  return evento.fecha_fin || null;
}

function hayCruceDeFechas(eventoA, eventoB) {
  const inicioA = obtenerFechaInicio(eventoA);
  const finA = obtenerFechaFin(eventoA);
  const inicioB = obtenerFechaInicio(eventoB);
  const finB = obtenerFechaFin(eventoB);

  // Si falta una fecha, no podemos confirmar que esté disponible.
  // Por seguridad se considera ocupado.
  if (!inicioA || !finA || !inicioB || !finB) {
    return true;
  }

  const inicioAms = new Date(inicioA).getTime();
  const finAms = new Date(finA).getTime();
  const inicioBms = new Date(inicioB).getTime();
  const finBms = new Date(finB).getTime();

  if (
    Number.isNaN(inicioAms) ||
    Number.isNaN(finAms) ||
    Number.isNaN(inicioBms) ||
    Number.isNaN(finBms)
  ) {
    return true;
  }

  // Hay cruce cuando el inicio de uno ocurre antes
  // de que termine el otro.
  return inicioAms <= finBms && inicioBms <= finAms;
}

function tecnicoEstaOcupado(usuarioId, asignaciones, eventos) {
  const asignacionesTecnico = asignaciones.filter(
    asignacion =>
      asignacion.usuario_id === usuarioId &&
      asignacion.evento_id !== eventoId
  );

  for (const asignacion of asignacionesTecnico) {
    const eventoAsignado = eventos.find(
      evento => evento.id === asignacion.evento_id
    );

    // Si no encontramos el evento, bloqueamos por seguridad.
    if (!eventoAsignado) {
      return true;
    }

    // Cotizado, cerrado y cancelado no bloquean.
    if (!ESTADOS_QUE_OCUPAN.includes(eventoAsignado.estado)) {
      continue;
    }

    // Confirmado o en montaje bloquean únicamente
    // cuando sus fechas se cruzan con el evento actual.
    if (hayCruceDeFechas(eventoActual, eventoAsignado)) {
      return true;
    }
  }

  return false;
}

function obtenerTecnicosDisponibles(
  asignaciones = asignacionesTodosEventos,
  eventos = eventosCache
) {
  return tecnicos.filter(tecnico => {
    if (tecnico.activo !== true || tecnico.rol !== 'tecnico') {
      return false;
    }

    return !tecnicoEstaOcupado(tecnico.id, asignaciones, eventos);
  });
}

// =====================================================
// CERRAR SESIÓN
// =====================================================

document.getElementById('btn-salir').addEventListener('click', async evento => {
  evento.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// =====================================================
// CARGAR EVENTO, TÉCNICOS, ASIGNACIONES Y FECHAS
// =====================================================

async function cargarDatos() {
  if (!eventoId) {
    mostrarError(
      'Falta el evento',
      'Abre esta página desde el detalle de un evento.'
    );
    return;
  }

  mostrarSoloEstado('cargando');
  ocultarAviso();

  try {
    const [resEvento, resTecnicos, resAsignaciones, resEventos] =
      await Promise.all([
        supabase
          .from('eventos')
          .select('id, nombre, estado, fecha_montaje, fecha_inicio, fecha_fin')
          .eq('id', eventoId)
          .maybeSingle(),

        supabase
          .from('usuarios')
          .select('id, nombre, correo, rol, telefono, activo')
          .eq('rol', 'tecnico')
          .order('nombre', { ascending: true }),

        supabase
          .from('evento_personal')
          .select('id, evento_id, usuario_id, funcion'),

        supabase
          .from('eventos')
          .select('id, estado, fecha_montaje, fecha_inicio, fecha_fin')
      ]);

    if (resEvento.error) throw resEvento.error;
    if (resTecnicos.error) throw resTecnicos.error;
    if (resAsignaciones.error) throw resAsignaciones.error;
    if (resEventos.error) throw resEventos.error;

    if (!resEvento.data) {
      mostrarError(
        'No encontramos este evento',
        'Puede que no exista o que no tengas acceso a él.'
      );
      return;
    }

    eventoActual = resEvento.data;
    tecnicos = resTecnicos.data ?? [];
    asignacionesTodosEventos = resAsignaciones.data ?? [];
    eventosCache = resEventos.data ?? [];

    asignacionesEvento = asignacionesTodosEventos.filter(
      asignacion => asignacion.evento_id === eventoId
    );

    elNombreEvento.textContent = eventoActual.nombre;

    const editable = eventoEditable();

    elFuncion.disabled = !editable;
    elBotonAgregar.disabled = !editable;
    elSelectTecnico.disabled = !editable;

    pintarTecnicosDisponibles();
    pintarCuadrilla();

    if (!editable) {
      mostrarAviso(
        'Este evento ya no admite cambios en su cuadrilla.'
      );
    }

    mostrarSoloEstado('datos');

  } catch (error) {
    console.error('Error al cargar la cuadrilla:', error);

    mostrarError(
      'No pudimos cargar la información',
      error.message || 'Revisa tu conexión con Supabase e inténtalo de nuevo.'
    );
  }
}

// =====================================================
// TÉCNICOS DISPONIBLES
// =====================================================

function pintarTecnicosDisponibles() {
  elSelectTecnico.replaceChildren();

  const opcionInicial = document.createElement('option');
  opcionInicial.value = '';
  opcionInicial.textContent = 'Selecciona un técnico';
  elSelectTecnico.appendChild(opcionInicial);

  const disponibles = obtenerTecnicosDisponibles();

  disponibles.forEach(tecnico => {
    const opcion = document.createElement('option');
    opcion.value = tecnico.id;
    opcion.textContent = tecnico.nombre;
    elSelectTecnico.appendChild(opcion);
  });

  if (disponibles.length === 0) {
    opcionInicial.textContent = tecnicos.length === 0
      ? 'No hay técnicos registrados'
      : 'No hay técnicos activos disponibles';

    elSelectTecnico.disabled = true;
    elBotonAgregar.disabled = true;

    elAyudaTecnicos.textContent =
      'Los técnicos asignados a eventos confirmados o en montaje con fechas cruzadas no aparecen disponibles.';
  } else {
    elAyudaTecnicos.textContent =
      'Solo aparecen técnicos activos que no tengan cruces de fechas con eventos confirmados o en montaje.';

    elSelectTecnico.disabled = !eventoEditable();
    elBotonAgregar.disabled = !eventoEditable();
  }
}

// =====================================================
// TABLA DE CUADRILLA
// =====================================================

function pintarCuadrilla() {
  elCuadrillaBody.replaceChildren();

  const tecnicosPorId = new Map(
    tecnicos.map(tecnico => [tecnico.id, tecnico])
  );

  asignacionesEvento.forEach(asignacion => {
    const tecnico = tecnicosPorId.get(asignacion.usuario_id);
    const tr = document.createElement('tr');

    tr.appendChild(crearCelda(tecnico?.nombre ?? 'Técnico asignado'));
    tr.appendChild(crearCelda(asignacion.funcion));

    const tdAcciones = document.createElement('td');
    const botonQuitar = document.createElement('button');

    botonQuitar.type = 'button';
    botonQuitar.className = 'btn btn--pequeno btn--secundario';
    botonQuitar.textContent = 'Quitar';
    botonQuitar.disabled = !eventoEditable();

    botonQuitar.addEventListener('click', () => {
      abrirModalQuitar(asignacion, tecnico?.nombre ?? 'este técnico');
    });

    tdAcciones.appendChild(botonQuitar);
    tr.appendChild(tdAcciones);
    elCuadrillaBody.appendChild(tr);
  });

  const cantidad = asignacionesEvento.length;

  elCuadrillaConteo.textContent =
    `${cantidad} ${cantidad === 1 ? 'técnico' : 'técnicos'}`;

  elCuadrillaVacia.classList.toggle('oculto', cantidad > 0);
  elCuadrillaTabla.classList.toggle('oculto', cantidad === 0);
}

// =====================================================
// AGREGAR TÉCNICO
// =====================================================

elFormulario.addEventListener('submit', async evento => {
  evento.preventDefault();
  ocultarAviso();

  if (!eventoEditable()) {
    mostrarAviso('Este evento ya no admite cambios en su cuadrilla.');
    return;
  }

  const usuarioId = elSelectTecnico.value;
  const funcion = elFuncion.value.trim();

  if (!usuarioId) {
    mostrarAviso('Selecciona un técnico disponible.');
    return;
  }

  if (!funcion) {
    mostrarAviso('Escribe la función que realizará el técnico.');
    return;
  }

  const tecnico = tecnicos.find(item => item.id === usuarioId);

  if (!tecnico || tecnico.activo !== true || tecnico.rol !== 'tecnico') {
    mostrarAviso('El técnico ya no está disponible.');
    await cargarDatos();
    return;
  }

  elBotonAgregar.disabled = true;
  elBotonAgregar.textContent = 'Verificando...';

  try {
    // Volvemos a consultar las asignaciones y los eventos
    // para comprobar la disponibilidad antes de guardar.
    const [resAsignaciones, resEventos] = await Promise.all([
      supabase
        .from('evento_personal')
        .select('id, evento_id, usuario_id, funcion'),

      supabase
        .from('eventos')
        .select('id, estado, fecha_montaje, fecha_inicio, fecha_fin')
    ]);

    if (resAsignaciones.error) throw resAsignaciones.error;
    if (resEventos.error) throw resEventos.error;

    const asignacionesActualizadas = resAsignaciones.data ?? [];
    const eventosActualizados = resEventos.data ?? [];

    const ocupado = tecnicoEstaOcupado(
      usuarioId,
      asignacionesActualizadas,
      eventosActualizados
    );

    if (ocupado) {
      mostrarAviso(
        'Este técnico está ocupado en otro evento confirmado o en montaje durante esas fechas.'
      );
      await cargarDatos();
      return;
    }

    const { error } = await supabase
      .from('evento_personal')
      .insert({
        evento_id: eventoId,
        usuario_id: usuarioId,
        funcion
      });

    if (error) throw error;

    elFormulario.reset();
    await cargarDatos();

    mostrarAviso(
      'El técnico se agregó correctamente a la cuadrilla.',
      'exito'
    );

  } catch (error) {
    console.error('Error al asignar técnico:', error);

    mostrarAviso(
      error.code === '23505'
        ? 'Este técnico ya está asignado a este evento.'
        : error.message || 'No se pudo guardar la asignación.'
    );

    await cargarDatos();

  } finally {
    elBotonAgregar.textContent = '+ Agregar a la cuadrilla';

    if (eventoEditable()) {
      const disponibles = obtenerTecnicosDisponibles();
      elBotonAgregar.disabled = disponibles.length === 0;
    }
  }
});

// =====================================================
// MODAL PERSONALIZADO PARA QUITAR TÉCNICO
// =====================================================

function abrirModalQuitar(asignacion, nombreTecnico) {
  if (!eventoEditable()) return;

  asignacionPorQuitar = asignacion;

  elModalTexto.textContent =
    `¿Estás seguro de que deseas quitar a ${nombreTecnico} de este evento?`;

  btnConfirmarQuitar.disabled = false;
  btnConfirmarQuitar.textContent = 'Sí, quitar técnico';

  elModal.classList.remove('oculto');
  btnCancelarQuitar.focus();
}

function cerrarModalQuitar() {
  elModal.classList.add('oculto');
  asignacionPorQuitar = null;
}

btnCancelarQuitar.addEventListener('click', cerrarModalQuitar);

elModal.addEventListener('click', evento => {
  if (evento.target === elModal) {
    cerrarModalQuitar();
  }
});

document.addEventListener('keydown', evento => {
  if (evento.key === 'Escape' && !elModal.classList.contains('oculto')) {
    cerrarModalQuitar();
  }
});

btnConfirmarQuitar.addEventListener('click', async () => {
  if (!asignacionPorQuitar || !eventoEditable()) return;

  const asignacion = asignacionPorQuitar;

  btnConfirmarQuitar.disabled = true;
  btnCancelarQuitar.disabled = true;
  btnConfirmarQuitar.textContent = 'Quitando...';

  try {
    const { error } = await supabase
      .from('evento_personal')
      .delete()
      .eq('id', asignacion.id)
      .eq('evento_id', eventoId);

    if (error) throw error;

    cerrarModalQuitar();
    await cargarDatos();

    mostrarAviso(
      'El técnico se quitó de la cuadrilla y quedó disponible si no tiene otras asignaciones que coincidan en fechas.',
      'exito'
    );

  } catch (error) {
    console.error('Error al quitar técnico:', error);

    cerrarModalQuitar();

    mostrarAviso(
      error.message || 'No se pudo quitar al técnico. Inténtalo de nuevo.'
    );

    await cargarDatos();

  } finally {
    btnConfirmarQuitar.disabled = false;
    btnCancelarQuitar.disabled = false;
    btnConfirmarQuitar.textContent = 'Sí, quitar técnico';
  }
});

// =====================================================
// REINTENTAR E INICIAR
// =====================================================

document.getElementById('btn-reintentar')
  .addEventListener('click', cargarDatos);

cargarDatos();
