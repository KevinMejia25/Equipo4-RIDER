
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
let asignacionPorQuitar = null;

// =====================================================
// ESTADOS
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
// CERRAR SESIÓN
// =====================================================

document.getElementById('btn-salir').addEventListener('click', async (evento) => {
  evento.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// =====================================================
// CARGAR EVENTO, TÉCNICOS Y ASIGNACIONES
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
    const [resEvento, resTecnicos, resAsignaciones] = await Promise.all([
      supabase
        .from('eventos')
        .select('id, nombre, estado')
        .eq('id', eventoId)
        .maybeSingle(),

      supabase
        .from('usuarios')
        .select('id, nombre, correo, rol, telefono, activo')
        .eq('rol', 'tecnico')
        .order('nombre', { ascending: true }),

      // Se consultan todas las asignaciones para saber qué técnicos
      // ya están ocupados en otros eventos.
      supabase
        .from('evento_personal')
        .select('id, evento_id, usuario_id, funcion')
    ]);

    if (resEvento.error) throw resEvento.error;
    if (resTecnicos.error) throw resTecnicos.error;
    if (resAsignaciones.error) throw resAsignaciones.error;

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

    asignacionesEvento = asignacionesTodosEventos.filter(
      (asignacion) => asignacion.evento_id === eventoId
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

  // Un técnico ocupado en cualquier evento visible no se ofrece
  // como disponible para una nueva asignación.
  const idsOcupados = new Set(
    asignacionesTodosEventos.map((asignacion) => asignacion.usuario_id)
  );

  const disponibles = tecnicos.filter((tecnico) => {
    return tecnico.activo === true && !idsOcupados.has(tecnico.id);
  });

  disponibles.forEach((tecnico) => {
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
      'Los técnicos asignados a otros eventos no aparecen disponibles.';
  } else {
    elAyudaTecnicos.textContent =
      'Solo aparecen técnicos activos que no estén asignados a otro evento.';

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
    tecnicos.map((tecnico) => [tecnico.id, tecnico])
  );

  asignacionesEvento.forEach((asignacion) => {
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

elFormulario.addEventListener('submit', async (evento) => {
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

  // Verificación inmediata contra los datos cargados.
  const yaOcupado = asignacionesTodosEventos.some(
    (asignacion) => asignacion.usuario_id === usuarioId
  );

  if (yaOcupado) {
    mostrarAviso('Este técnico ya está asignado a un evento. Actualiza la página.');
    await cargarDatos();
    return;
  }

  const tecnico = tecnicos.find((item) => item.id === usuarioId);

  if (!tecnico || tecnico.activo !== true || tecnico.rol !== 'tecnico') {
    mostrarAviso('El técnico ya no está disponible.');
    await cargarDatos();
    return;
  }

  elBotonAgregar.disabled = true;
  elBotonAgregar.textContent = 'Guardando...';

  try {
    // Segunda comprobación para reducir la posibilidad de duplicados.
    const { data: existentes, error: errorExistentes } = await supabase
      .from('evento_personal')
      .select('id, evento_id')
      .eq('usuario_id', usuarioId);

    if (errorExistentes) throw errorExistentes;

    if (existentes?.length) {
      mostrarAviso(
        'Este técnico ya tiene una asignación registrada y no aparece disponible.'
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
        ? 'Este técnico ya está asignado a un evento.'
        : error.message || 'No se pudo guardar la asignación.'
    );

    await cargarDatos();

  } finally {
    elBotonAgregar.textContent = '+ Agregar a la cuadrilla';

    if (eventoEditable()) {
      const idsOcupados = new Set(
        asignacionesTodosEventos.map((item) => item.usuario_id)
      );

      const hayDisponibles = tecnicos.some(
        (item) => item.activo === true && !idsOcupados.has(item.id)
      );

      elBotonAgregar.disabled = !hayDisponibles;
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

// Cerrar si se pulsa fuera del cuadro.
elModal.addEventListener('click', (evento) => {
  if (evento.target === elModal) {
    cerrarModalQuitar();
  }
});

// Cerrar con Escape.
document.addEventListener('keydown', (evento) => {
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
      'El técnico se quitó de la cuadrilla y quedó disponible si no tiene otras asignaciones.',
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
