import { supabase } from './supabaseClient.js';

// Referencias HTML
const elCargando = document.getElementById('estado-cargando');
const elVacio = document.getElementById('estado-vacio');
const elError = document.getElementById('estado-error');
const elConDatos = document.getElementById('estado-con-datos');

const tbody = document.getElementById('tabla-clientes-body');
const inputBuscar = document.getElementById('buscar-cliente');
const contador = document.getElementById('contador-resultados');

const btnReintentar = document.getElementById('btn-reintentar');
const btnNuevo = document.getElementById('btn-nuevo-cliente');
const btnPrimerCliente = document.getElementById('btn-primer-cliente');

let clientesCache = [];

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

function renderFila(cliente) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${escapeHtml(cliente.nombre)}</td>
        <td>${escapeHtml(cliente.contacto ?? '—')}</td>
        <td>${escapeHtml(cliente.telefono ?? '—')}</td>
        <td>${escapeHtml(cliente.correo ?? '—')}</td>
        <td>${escapeHtml(cliente.notas ?? '—')}</td>
    `;

    return tr;
}

function renderLista(clientes) {
    tbody.innerHTML = '';

    clientes.forEach((cliente) => {
        tbody.appendChild(renderFila(cliente));
    });

    contador.textContent =
        `${clientes.length} resultado${clientes.length === 1 ? '' : 's'}`;

    if (clientes.length === 0) {
        mostrarSoloEstado('vacio');
    } else {
        mostrarSoloEstado('con-datos');
    }
}

async function cargarClientes() {
    mostrarSoloEstado('cargando');

    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, contacto, telefono, correo, notas')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error al cargar clientes:', error);
        mostrarSoloEstado('error');
        return;
    }

    clientesCache = data ?? [];

    renderLista(clientesCache);
}

inputBuscar.addEventListener('input', () => {
    const termino = inputBuscar.value.trim().toLowerCase();

    if (!termino) {
        renderLista(clientesCache);
        return;
    }

    const filtrados = clientesCache.filter((cliente) => {
        const nombre = cliente.nombre?.toLowerCase() ?? '';
        const contacto = cliente.contacto?.toLowerCase() ?? '';
        const telefono = cliente.telefono?.toLowerCase() ?? '';
        const correo = cliente.correo?.toLowerCase() ?? '';

        return (
            nombre.includes(termino) ||
            contacto.includes(termino) ||
            telefono.includes(termino) ||
            correo.includes(termino)
        );
    });

    renderLista(filtrados);
});

function irANuevoCliente() {
    window.location.href = '/nuevo-cliente.html';
}

btnNuevo.addEventListener('click', irANuevoCliente);
btnPrimerCliente.addEventListener('click', irANuevoCliente);

btnReintentar.addEventListener('click', cargarClientes);

cargarClientes();