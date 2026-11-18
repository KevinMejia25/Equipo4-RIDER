
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
let idsOcupados = new Set();

const ESTADOS_QUE_OCUPAN = ['confirmado', 'en_montaje'];

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
// VERIFICAR SI UN EVENTO SIGUE OCUPANDO AL TÉCNICO
// =====================================================

function eventoSigueOcupando(evento) {
    if (!evento) return true;

    if (!ESTADOS_QUE_OCUPAN.includes(evento.estado)) {
        return false;
    }

    if (!evento.fecha_fin) {
        return true;
    }

    const fechaFin = new Date(evento.fecha_fin).getTime();

    if (Number.isNaN(fechaFin)) {
        return true;
    }

    return fechaFin >= Date.now();
}

// =====================================================
// CREAR FILA
// =====================================================

function renderFila(tecnico) {
    const tr = document.createElement('tr');

    const ocupado = idsOcupados.has(tecnico.id);

    const estaActivo = tecnico.activo === true && !ocupado;

    const datos = [
        tecnico.nombre ?? '—',
        tecnico.correo ?? '—',
        tecnico.rol ?? '—',
        tecnico.telefono ?? '—'
    ];

    datos.forEach(dato => {
        const td = document.createElement('td');
        td.textContent = dato;
        tr.appendChild(td);
    });

    const tdEstado = document.createElement('td');
    const etiquetaEstado = document.createElement('span');

    etiquetaEstado.className = 'etiqueta';

    etiquetaEstado.textContent = estaActivo ? 'Activo' : 'Inactivo';

    etiquetaEstado.classList.add(
        estaActivo ? 'etiqueta--completado' : 'etiqueta--cancelado'
    );

    if (ocupado) {
        etiquetaEstado.title =
            'Este técnico está asignado a un evento confirmado o en montaje.';
    } else if (tecnico.activo !== true) {
        etiquetaEstado.title =
            'La cuenta de este técnico está desactivada.';
    } else {
        etiquetaEstado.title =
            'Este técnico está disponible.';
    }

    tdEstado.appendChild(etiquetaEstado);
    tr.appendChild(tdEstado);

    return tr;
}

// =====================================================
// MOSTRAR LISTA
// =====================================================

function renderLista(tecnicos) {
    tbody.replaceChildren();

    tecnicos.forEach(tecnico => {
        tbody.appendChild(renderFila(tecnico));
    });

    contador.textContent =
        `${tecnicos.length} resultado${tecnicos.length === 1 ? '' : 's'}`;

    mostrarSoloEstado(tecnicos.length === 0 ? 'vacio' : 'con-datos');
}

// =====================================================
// BUSCADOR
// =====================================================

function aplicarBusqueda() {
    const termino = inputBuscar.value.trim().toLowerCase();

    if (!termino) {
        renderLista(tecnicosCache);
        return;
    }

    const filtrados = tecnicosCache.filter(tecnico => {
        const nombre = tecnico.nombre?.toLowerCase() ?? '';
        const correo = tecnico.correo?.toLowerCase() ?? '';
        const telefono = tecnico.telefono?.toLowerCase() ?? '';
        const rol = tecnico.rol?.toLowerCase() ?? '';

        const estado = (
            tecnico.activo === true && !idsOcupados.has(tecnico.id)
        ) ? 'activo' : 'inactivo';

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
// CARGAR TÉCNICOS, ASIGNACIONES Y EVENTOS
// =====================================================

async function cargarTecnicos() {
    mostrarSoloEstado('cargando');

    try {
        const [resTecnicos, resAsignaciones, resEventos] =
            await Promise.all([

                supabase
                    .from('usuarios')
                    .select('id, nombre, correo, rol, telefono, activo')
                    .order('nombre', { ascending: true }),

                supabase
                    .from('evento_personal')
                    .select('usuario_id, evento_id'),

                supabase
                    .from('eventos')
                    .select('id, estado, fecha_fin')
            ]);

        if (resTecnicos.error) throw resTecnicos.error;
        if (resAsignaciones.error) throw resAsignaciones.error;
        if (resEventos.error) throw resEventos.error;

        tecnicosCache = resTecnicos.data ?? [];

        const asignaciones = resAsignaciones.data ?? [];
        const eventos = resEventos.data ?? [];

        const eventosPorId = new Map(
            eventos.map(evento => [evento.id, evento])
        );

        idsOcupados = new Set();

        asignaciones.forEach(asignacion => {
            const evento = eventosPorId.get(asignacion.evento_id);

            if (eventoSigueOcupando(evento)) {
                idsOcupados.add(asignacion.usuario_id);
            }
        });

        aplicarBusqueda();

    } catch (error) {
        console.error('Error al cargar técnicos y disponibilidad:', error);

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

// Actualizar al regresar a la pestaña.
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
