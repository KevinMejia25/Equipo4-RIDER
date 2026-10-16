
import { supabase } from './supabaseClient.js';

// =====================================================
// REFERENCIAS HTML
// =====================================================

const elCargando = document.getElementById('estado-cargando');
const elVacio = document.getElementById('estado-vacio');
const elError = document.getElementById('estado-error');
const elConDatos = document.getElementById('estado-con-datos');

const tbody = document.getElementById('tabla-tecnicos-body');
const inputBuscar = document.getElementById('buscar-tecnico');
const contador = document.getElementById('contador-resultados');

const btnReintentar = document.getElementById('btn-reintentar');
const btnNuevo = document.getElementById('btn-nuevo-tecnico');
const btnPrimerTecnico = document.getElementById('btn-primer-tecnico');

// =====================================================
// DATOS
// =====================================================

let tecnicosCache = [];
let idsAsignados = new Set();

// =====================================================
// MOSTRAR ESTADOS
// =====================================================

function mostrarSoloEstado(nombre) {
  const toggle = (elemento, mostrar) => {
    elemento.classList.toggle('oculto', !mostrar);
  };

  toggle(elCargando, nombre === 'cargando');
  toggle(elVacio, nombre === 'vacio');
  toggle(elError, nombre === 'error');
  toggle(elConDatos, nombre === 'con-datos');
}

// =====================================================
// CREAR FILA
// =====================================================

function renderFila(tecnico) {
  const tr = document.createElement('tr');

  const ocupado = idsAsignados.has(tecnico.id);

  // El técnico aparece inactivo visualmente cuando tiene una
  // asignación en evento_personal o cuando su cuenta está desactivada.
  const estaActivo = tecnico.activo === true && !ocupado;

  const datos = [
    tecnico.nombre ?? '—',
    tecnico.correo ?? '—',
    tecnico.rol ?? '—',
    tecnico.telefono ?? '—'
  ];

  datos.forEach((dato) => {
    const td = document.createElement('td');
    td.textContent = dato;
    tr.appendChild(td);
  });

  const tdEstado = document.createElement('td');
  const etiquetaEstado = document.createElement('span');

  etiquetaEstado.className = 'etiqueta';
  etiquetaEstado.textContent = estaActivo ? 'Activo' : 'Inactivo';

  // Reutiliza las clases de estado existentes en ui.css.
  etiquetaEstado.classList.add(
    estaActivo ? 'etiqueta--completado' : 'etiqueta--cancelado'
  );

  if (ocupado) {
    etiquetaEstado.title = 'Este técnico tiene una asignación registrada.';
  } else if (tecnico.activo !== true) {
    etiquetaEstado.title = 'La cuenta de este técnico está desactivada.';
  }

  tdEstado.appendChild(etiquetaEstado);
  tr.appendChild(tdEstado);

  return tr;
}

// =====================================================
// MOSTRAR LISTA Y BUSCADOR
// =====================================================

function renderLista(tecnicos) {
  tbody.replaceChildren();

  tecnicos.forEach((tecnico) => {
    tbody.appendChild(renderFila(tecnico));
  });

  contador.textContent =
    `${tecnicos.length} resultado${tecnicos.length === 1 ? '' : 's'}`;

  mostrarSoloEstado(tecnicos.length === 0 ? 'vacio' : 'con-datos');
}

function aplicarBusqueda() {
  const termino = inputBuscar.value.trim().toLowerCase();

  if (!termino) {
    renderLista(tecnicosCache);
    return;
  }

  const filtrados = tecnicosCache.filter((tecnico) => {
    const nombre = tecnico.nombre?.toLowerCase() ?? '';
    const correo = tecnico.correo?.toLowerCase() ?? '';
    const telefono = tecnico.telefono?.toLowerCase() ?? '';
    const rol = tecnico.rol?.toLowerCase() ?? '';

    const estado = (
      tecnico.activo === true && !idsAsignados.has(tecnico.id)
        ? 'activo'
        : 'inactivo'
    );

    return (
      nombre.includes(termino) ||
      correo.includes(termino) ||
      telefono.includes(termino) ||
      rol.includes(termino) ||
      estado.includes(termino)
    );
  });

  renderLista(filtrados);
}

// =====================================================
// CARGAR TÉCNICOS Y ASIGNACIONES
// =====================================================

async function cargarTecnicos() {
  mostrarSoloEstado('cargando');

  try {
    const [resTecnicos, resAsignaciones] = await Promise.all([
      supabase
        .from('usuarios')
        .select('id, nombre, correo, rol, telefono, activo')
        .order('nombre', { ascending: true }),

      supabase
        .from('evento_personal')
        .select('usuario_id')
    ]);

    if (resTecnicos.error) {
      throw resTecnicos.error;
    }

    if (resAsignaciones.error) {
      throw resAsignaciones.error;
    }

    tecnicosCache = resTecnicos.data ?? [];

    // Un técnico con una o más asignaciones se muestra inactivo.
    idsAsignados = new Set(
      (resAsignaciones.data ?? []).map((asignacion) => asignacion.usuario_id)
    );

    aplicarBusqueda();

  } catch (error) {
    console.error('Error al cargar técnicos y asignaciones:', error);

    mostrarSoloEstado('error');
  }
}

// =====================================================
// ACCIONES
// =====================================================

inputBuscar.addEventListener('input', aplicarBusqueda);

function irANuevoTecnico() {
  window.location.href = '/nuevo-tecnico.html';
}

btnNuevo.addEventListener('click', irANuevoTecnico);
btnPrimerTecnico.addEventListener('click', irANuevoTecnico);
btnReintentar.addEventListener('click', cargarTecnicos);

// Actualiza la lista cuando el usuario vuelve a esta pestaña.
window.addEventListener('focus', cargarTecnicos);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    cargarTecnicos();
  }
});

// =====================================================
// INICIO
// =====================================================

cargarTecnicos();
