import { supabase } from './supabaseClient.js';

// Referencias HTML
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

let tecnicosCache = [];

function mostrarSoloEstado(nombre) {
    const toggle = (elemento, mostrar) => {
        elemento.classList.toggle('oculto', !mostrar);
    };

    toggle(elCargando, nombre === 'cargando');
    toggle(elVacio, nombre === 'vacio');
    toggle(elError, nombre === 'error');
    toggle(elConDatos, nombre === 'con-datos');
}

function escapeHtml(valor) {
    const div = document.createElement('div');
    div.textContent = valor ?? '';
    return div.innerHTML;
}

function renderFila(tecnico) {
    const tr = document.createElement('tr');

    const estado = tecnico.activo
        ? 'Activo'
        : 'Inactivo';

    tr.innerHTML = `
        <td>${escapeHtml(tecnico.nombre)}</td>
        <td>${escapeHtml(tecnico.correo ?? '—')}</td>
        <td>${escapeHtml(tecnico.rol ?? '—')}</td>
        <td>${escapeHtml(tecnico.telefono ?? '—')}</td>
        <td>${estado}</td>
    `;

    return tr;
}

function renderLista(tecnicos) {
    tbody.innerHTML = '';

    tecnicos.forEach((tecnico) => {
        tbody.appendChild(renderFila(tecnico));
    });

    contador.textContent =
        `${tecnicos.length} resultado${tecnicos.length === 1 ? '' : 's'}`;

    if (tecnicos.length === 0) {
        mostrarSoloEstado('vacio');
    } else {
        mostrarSoloEstado('con-datos');
    }
}

async function cargarTecnicos() {
    mostrarSoloEstado('cargando');

    const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, correo, rol, telefono, activo')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error al cargar técnicos:', error);
        mostrarSoloEstado('error');
        return;
    }

    tecnicosCache = data ?? [];

    renderLista(tecnicosCache);
}

inputBuscar.addEventListener('input', () => {
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

        return (
            nombre.includes(termino) ||
            correo.includes(termino) ||
            telefono.includes(termino) ||
            rol.includes(termino)
        );
    });

    renderLista(filtrados);
});

function irANuevoTecnico() {
    window.location.href = '/nuevo-tecnico.html';
}

btnNuevo.addEventListener('click', irANuevoTecnico);
btnPrimerTecnico.addEventListener('click', irANuevoTecnico);

btnReintentar.addEventListener('click', cargarTecnicos);

cargarTecnicos();