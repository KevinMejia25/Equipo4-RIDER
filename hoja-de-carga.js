import { supabase } from './supabaseClient.js';

// ============================================================
// ELEMENTOS DEL DOM
// ============================================================

const btnAgregarEquipo = document.getElementById('btn-agregar-equipo');
const btnAgregarPrimerEquipo = document.getElementById('btn-agregar-primer-equipo');

const modalEquipo = document.getElementById('modal-equipo');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const modalOverlay = document.getElementById('modal-overlay');

const modalCargando = document.getElementById('modal-cargando');
const modalTablaContenedor = document.getElementById('modal-tabla-contenedor');
const modalEquipoBody = document.getElementById('modal-equipo-body');
const modalVacio = document.getElementById('modal-vacio');
const modalError = document.getElementById('modal-error');

const modalBorrado = document.getElementById('modal-confirmar-borrado');
const nombreEquipoBorrado = document.getElementById('borrado-nombre-equipo');
const errorBorrado = document.getElementById('borrado-error');
const btnCancelarBorrado = document.getElementById('btn-cancelar-borrado');
const btnConfirmarBorrado = document.getElementById('btn-confirmar-borrado');

const tablaEquipoContenedor = document.getElementById('tabla-equipo-contenedor');
const tablaEquipoBody = document.getElementById('tabla-equipo-body');
const equipoConteo = document.getElementById('equipo-conteo');

const estadoCargando = document.getElementById('estado-cargando');
const estadoError = document.getElementById('estado-error');
const estadoConDatos = document.getElementById('estado-con-datos');

const errorTitulo = document.getElementById('error-titulo');
const errorTexto = document.getElementById('error-texto');

// ============================================================
// ESTADO
// ============================================================

let eventoActual = null;
let equiposDisponibles = [];
let equiposAsignados = [];
let asignacionPendienteBorrar = null;

const ESTADOS_EDITABLES = ['cotizado', 'confirmado'];

const MAPA_CONDICION = {
    bueno: 'Bueno',
    regular: 'Regular',
    malo: 'Malo'
};

// ============================================================
// UTILIDADES
// ============================================================

function obtenerEventoId() {
    const params = new URLSearchParams(window.location.search);

    return params.get('id') || params.get('evento_id');
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function formatearFecha(fecha) {
    if (!fecha) {
        return '—';
    }

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) {
        return '—';
    }

    return fechaObj.toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function convertirAInputFecha(fecha) {
    if (!fecha) {
        return '';
    }

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) {
        return '';
    }

    const pad = numero => String(numero).padStart(2, '0');

    return `${fechaObj.getFullYear()}-${pad(fechaObj.getMonth() + 1)}-${pad(fechaObj.getDate())}T${pad(fechaObj.getHours())}:${pad(fechaObj.getMinutes())}`;
}

function obtenerCondicion(equipo) {
    const condicion = equipo?.condicion;

    if (!condicion) {
        return 'Sin especificar';
    }

    return MAPA_CONDICION[String(condicion).toLowerCase()]
        || condicion;
}

function eventoEsEditable() {
    return eventoActual
        && ESTADOS_EDITABLES.includes(eventoActual.estado);
}

function mostrarError(titulo, texto) {
    if (errorTitulo) {
        errorTitulo.textContent = titulo;
    }

    if (errorTexto) {
        errorTexto.textContent = texto;
    }

    estadoCargando?.classList.add('oculto');
    estadoConDatos?.classList.add('oculto');
    estadoError?.classList.remove('oculto');
}

// ============================================================
// MODALES
// ============================================================

function actualizarFondoModal() {
    const hayModalAbierto =
        !modalEquipo?.classList.contains('oculto')
        || !modalBorrado?.classList.contains('oculto');

    modalOverlay?.classList.toggle('oculto', !hayModalAbierto);
}

function abrirModal() {
    if (!eventoEsEditable()) {
        return;
    }

    modalBorrado?.classList.add('oculto');
    modalEquipo?.classList.remove('oculto');

    if (modalError) {
        modalError.textContent = '';
        modalError.classList.add('oculto');
    }

    actualizarFondoModal();
    cargarEquiposDisponibles();
}

function cerrarModal() {
    modalEquipo?.classList.add('oculto');
    actualizarFondoModal();
}

function abrirModalBorrado(asignacionId) {
    if (!eventoEsEditable()) {
        return;
    }

    const asignacion = equiposAsignados.find(
        item => item.id === asignacionId
    );

    if (!asignacion) {
        return;
    }

    asignacionPendienteBorrar = asignacionId;

    nombreEquipoBorrado.textContent =
        asignacion.equipos?.nombre || 'Equipo sin nombre';

    errorBorrado?.classList.add('oculto');

    if (errorBorrado) {
        errorBorrado.textContent = '';
    }

    btnConfirmarBorrado.disabled = false;
    btnConfirmarBorrado.textContent = 'Sí, quitar equipo';

    modalEquipo?.classList.add('oculto');
    modalBorrado?.classList.remove('oculto');

    actualizarFondoModal();
}

function cerrarModalBorrado() {
    if (btnConfirmarBorrado?.disabled) {
        return;
    }

    modalBorrado?.classList.add('oculto');
    asignacionPendienteBorrar = null;

    actualizarFondoModal();
}

function mostrarErrorBorrado(mensaje) {
    if (!errorBorrado) {
        return;
    }

    errorBorrado.textContent = mensaje;
    errorBorrado.classList.remove('oculto');
}

// ============================================================
// CARGAR EVENTO
// ============================================================

async function cargarEvento(eventoId) {
    const { data, error } = await supabase
        .from('eventos')
        .select(`
            id,
            nombre,
            sede,
            fecha_montaje,
            fecha_inicio,
            fecha_fin,
            estado,
            motivo_cancelacion,
            clientes (
                id,
                nombre,
                contacto,
                telefono,
                correo
            )
        `)
        .eq('id', eventoId)
        .single();

    if (error) {
        console.error('Error cargando evento:', error);
        throw new Error(error.message || 'No se pudo cargar el evento.');
    }

    if (!data) {
        throw new Error('No se encontró el evento.');
    }

    eventoActual = data;

    pintarEvento(data);
    actualizarPermisos();
}

function pintarEvento(evento) {
    const elementos = {
        'evento-nombre': evento.nombre || 'Evento sin nombre',
        'evento-cliente': evento.clientes?.nombre || 'Sin cliente',
        'evento-estado': evento.estado || 'Sin estado',
        'dato-cliente': evento.clientes?.nombre || 'Sin cliente',
        'dato-sede': evento.sede || 'Sin sede',
        'dato-montaje': formatearFecha(evento.fecha_montaje),
        'dato-inicio': formatearFecha(evento.fecha_inicio),
        'dato-fin': formatearFecha(evento.fecha_fin),
        'dato-contacto':
            evento.clientes?.contacto
            || evento.clientes?.telefono
            || evento.clientes?.correo
            || 'Sin contacto'
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = valor;
        }
    });

    const volverEvento = document.getElementById('volver-evento');

    if (volverEvento) {
        volverEvento.href =
            `detalle-evento.html?id=${encodeURIComponent(evento.id)}`;
    }
}

// ============================================================
// PERMISOS
// ============================================================

function actualizarPermisos() {
    if (!eventoActual) {
        return;
    }

    const editable = eventoEsEditable();

    btnAgregarEquipo?.classList.toggle('oculto', !editable);
    btnAgregarPrimerEquipo?.classList.toggle('oculto', !editable);

    document.querySelectorAll('.btn-quitar-equipo').forEach(boton => {
        boton.classList.toggle('oculto', !editable);
    });

    document.querySelectorAll('.retorno-equipo').forEach(input => {
        input.disabled = !editable;
    });
}

// ============================================================
// CARGAR EQUIPOS ASIGNADOS
// ============================================================

async function cargarEquiposAsignados(eventoId) {
    const { data, error } = await supabase
        .from('evento_equipo')
        .select(`
            id,
            evento_id,
            equipo_id,
            salida_registrada,
            retorno_registrado,
            condicion_retorno,
            nota,
            pendiente_envio,
            equipos (
                id,
                clave,
                nombre,
                condicion,
                activo,
                categorias (
                    nombre
                )
            )
        `)
        .eq('evento_id', eventoId);

    if (error) {
        console.error('Error cargando equipos asignados:', error);
        throw new Error(
            error.message || 'No se pudieron cargar los equipos asignados.'
        );
    }

    equiposAsignados = data || [];

    pintarEquiposAsignados();
}

// ============================================================
// PINTAR EQUIPOS ASIGNADOS
// ============================================================

function pintarEquiposAsignados() {
    if (!tablaEquipoBody) {
        return;
    }

    tablaEquipoBody.innerHTML = '';

    const cantidad = equiposAsignados.length;

    if (equipoConteo) {
        equipoConteo.textContent =
            `${cantidad} equipo${cantidad === 1 ? '' : 's'}`;
    }

    if (cantidad === 0) {
        tablaEquipoContenedor?.classList.add('oculto');
        document.getElementById('estado-sin-equipo')
            ?.classList.remove('oculto');

        actualizarPermisos();
        return;
    }

    tablaEquipoContenedor?.classList.remove('oculto');
    document.getElementById('estado-sin-equipo')
        ?.classList.add('oculto');

    equiposAsignados.forEach(asignacion => {
        const equipo = asignacion.equipos;
        const fila = document.createElement('tr');
        const fechaRetorno = convertirAInputFecha(
            asignacion.retorno_registrado
        );

        fila.innerHTML = `
            <td>
                <span class="equipo-clave">
                    ${escaparHTML(equipo?.clave || '—')}
                </span>
            </td>

            <td>
                <strong>
                    ${escaparHTML(equipo?.nombre || 'Sin nombre')}
                </strong>
            </td>

            <td>
                <span class="condicion-equipo">
                    ${escaparHTML(obtenerCondicion(equipo))}
                </span>
            </td>

            <td>
                <span class="pequeno">
                    ${escaparHTML(formatearFecha(asignacion.salida_registrada))}
                </span>
            </td>

            <td class="retorno-celda">
                <label
                    class="retorno-etiqueta"
                    for="retorno-${escaparHTML(asignacion.id)}"
                >
                    <span aria-hidden="true">📅</span>
                    Fecha y hora de devolución
                </label>

                <input
                    id="retorno-${escaparHTML(asignacion.id)}"
                    type="datetime-local"
                    class="retorno-equipo"
                    data-id="${escaparHTML(asignacion.id)}"
                    value="${escaparHTML(fechaRetorno)}"
                    aria-label="Fecha y hora de retorno de ${escaparHTML(equipo?.nombre || 'equipo')}"
                >

                <span class="retorno-ayuda">
                    Se guarda al cambiar la fecha.
                </span>

                <span
                    class="retorno-estado"
                    id="retorno-estado-${escaparHTML(asignacion.id)}"
                    aria-live="polite"
                ></span>
            </td>

            <td>
                <button
                    type="button"
                    class="btn btn--pequeno btn--secundario btn-quitar-equipo btn-borrar-equipo"
                    data-id="${escaparHTML(asignacion.id)}"
                >
                    Quitar
                </button>
            </td>
        `;

        tablaEquipoBody.appendChild(fila);
    });

    actualizarPermisos();
}

// ============================================================
// GUARDAR FECHA DE RETORNO
// ============================================================

async function guardarRetorno(asignacionId, valorInput, input) {
    if (!asignacionId || !eventoEsEditable()) {
        return;
    }

    const asignacion = equiposAsignados.find(
        item => item.id === asignacionId
    );

    if (!asignacion) {
        return;
    }

    const estado = document.getElementById(
        `retorno-estado-${asignacionId}`
    );

    const valorAnterior = asignacion.retorno_registrado;
    let valorISO = null;

    if (valorInput) {
        const fecha = new Date(valorInput);

        if (Number.isNaN(fecha.getTime())) {
            if (estado) {
                estado.textContent = 'Fecha no válida.';
                estado.className = 'retorno-estado error';
            }
            return;
        }

        valorISO = fecha.toISOString();
    }

    input.disabled = true;

    if (estado) {
        estado.textContent = 'Guardando...';
        estado.className = 'retorno-estado';
    }

    const { error } = await supabase
        .from('evento_equipo')
        .update({
            retorno_registrado: valorISO
        })
        .eq('id', asignacionId);

    input.disabled = !eventoEsEditable();

    if (error) {
        console.error('Error guardando retorno:', error);

        input.value = convertirAInputFecha(valorAnterior);

        if (estado) {
            estado.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
            estado.className = 'retorno-estado error';
        }

        return;
    }

    asignacion.retorno_registrado = valorISO;

    if (estado) {
        estado.textContent = valorISO ? '✓ Fecha guardada' : '✓ Fecha eliminada';
        estado.className = 'retorno-estado guardado';
    }
}

// ============================================================
// CARGAR EQUIPOS DISPONIBLES
// ============================================================

async function cargarEquiposDisponibles() {
    modalCargando?.classList.remove('oculto');
    modalTablaContenedor?.classList.add('oculto');
    modalVacio?.classList.add('oculto');
    modalError?.classList.add('oculto');

    if (modalEquipoBody) {
        modalEquipoBody.innerHTML = '';
    }

    const { data, error } = await supabase
        .from('equipos')
        .select(`
            id,
            clave,
            nombre,
            condicion,
            activo,
            categorias (
                nombre
            )
        `)
        .eq('activo', true)
        .order('clave', { ascending: true });

    modalCargando?.classList.add('oculto');

    if (error) {
        console.error('Error cargando equipos disponibles:', error);

        if (modalError) {
            modalError.textContent = 'No se pudieron cargar los equipos. Inténtalo de nuevo.';
            modalError.classList.remove('oculto');
        }

        return;
    }

    const idsAsignados = new Set(
        equiposAsignados.map(asignacion => asignacion.equipo_id)
    );

    equiposDisponibles = (data || []).filter(
        equipo => !idsAsignados.has(equipo.id)
    );

    if (equiposDisponibles.length === 0) {
        modalTablaContenedor?.classList.add('oculto');
        modalVacio?.classList.remove('oculto');
        return;
    }

    pintarEquiposDisponibles();
}

// ============================================================
// PINTAR EQUIPOS DISPONIBLES
// Sin columnas adicionales de Retorno ni Acción.
// El botón Agregar va dentro de la columna Equipo.
// ============================================================

function pintarEquiposDisponibles() {
    if (!modalEquipoBody) {
        return;
    }

    modalEquipoBody.innerHTML = '';

    equiposDisponibles.forEach(equipo => {
        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>
                <span class="equipo-clave">
                    ${escaparHTML(equipo.clave || '—')}
                </span>
            </td>

            <td>
                <div class="equipo-disponible">
                    <span class="equipo-disponible__nombre">
                        ${escaparHTML(equipo.nombre || 'Sin nombre')}
                    </span>

                    <button
                        type="button"
                        class="btn btn--pequeno equipo-disponible__boton btn-agregar-equipo-modal"
                        data-id="${escaparHTML(equipo.id)}"
                    >
                        + Agregar
                    </button>
                </div>
            </td>

            <td>
                <span class="condicion-equipo">
                    ${escaparHTML(obtenerCondicion(equipo))}
                </span>
            </td>
        `;

        modalEquipoBody.appendChild(fila);
    });

    modalTablaContenedor?.classList.remove('oculto');
}

// ============================================================
// AGREGAR EQUIPO
// ============================================================

async function agregarEquipo(equipo) {
    if (!eventoEsEditable()) {
        return false;
    }

    const { data, error } = await supabase
        .from('evento_equipo')
        .insert({
            evento_id: eventoActual.id,
            equipo_id: equipo.id,
            salida_registrada: new Date().toISOString(),
            retorno_registrado: null,
            pendiente_envio: false
        })
        .select(`
            id,
            evento_id,
            equipo_id,
            salida_registrada,
            retorno_registrado,
            condicion_retorno,
            nota,
            pendiente_envio,
            equipos (
                id,
                clave,
                nombre,
                condicion,
                activo,
                categorias (
                    nombre
                )
            )
        `)
        .single();

    if (error) {
        console.error('Error agregando equipo:', error);

        if (modalError) {
            modalError.textContent =
                `No se pudo agregar el equipo: ${error.message}`;
            modalError.classList.remove('oculto');
        }

        return false;
    }

    equiposAsignados.push(data);

    pintarEquiposAsignados();

    await cargarEquiposDisponibles();

    return true;
}

// ============================================================
// BORRAR EQUIPO DEL EVENTO
// ============================================================

async function quitarEquipo(asignacionId) {
    if (!eventoEsEditable()) {
        return false;
    }

    const { error } = await supabase
        .from('evento_equipo')
        .delete()
        .eq('id', asignacionId);

    if (error) {
        console.error('Error borrando equipo:', error);
        mostrarErrorBorrado(
            `No se pudo quitar el equipo. ${error.message}`
        );
        return false;
    }

    equiposAsignados = equiposAsignados.filter(
        item => item.id !== asignacionId
    );

    pintarEquiposAsignados();

    await cargarEquiposDisponibles();

    return true;
}

async function confirmarBorrado() {
    if (!asignacionPendienteBorrar || !eventoEsEditable()) {
        return;
    }

    btnConfirmarBorrado.disabled = true;
    btnConfirmarBorrado.textContent = 'Quitando...';

    if (errorBorrado) {
        errorBorrado.textContent = '';
        errorBorrado.classList.add('oculto');
    }

    const borradoCorrecto = await quitarEquipo(
        asignacionPendienteBorrar
    );

    if (!borradoCorrecto) {
        btnConfirmarBorrado.disabled = false;
        btnConfirmarBorrado.textContent = 'Intentar de nuevo';
        return;
    }

    modalBorrado?.classList.add('oculto');
    asignacionPendienteBorrar = null;

    btnConfirmarBorrado.disabled = false;
    btnConfirmarBorrado.textContent = 'Sí, quitar equipo';

    actualizarFondoModal();
}

// ============================================================
// EVENTOS DE BOTONES
// ============================================================

btnAgregarEquipo?.addEventListener('click', abrirModal);
btnAgregarPrimerEquipo?.addEventListener('click', abrirModal);

btnCerrarModal?.addEventListener('click', cerrarModal);

btnCancelarBorrado?.addEventListener(
    'click',
    cerrarModalBorrado
);

btnConfirmarBorrado?.addEventListener(
    'click',
    confirmarBorrado
);

modalOverlay?.addEventListener('click', () => {
    if (!modalBorrado?.classList.contains('oculto')) {
        cerrarModalBorrado();
    } else {
        cerrarModal();
    }
});

// ============================================================
// EVENTOS DE LA TABLA DE EQUIPOS ASIGNADOS
// ============================================================

tablaEquipoBody?.addEventListener('click', event => {
    const boton = event.target.closest('.btn-quitar-equipo');

    if (!boton) {
        return;
    }

    abrirModalBorrado(boton.dataset.id);
});

tablaEquipoBody?.addEventListener('change', async event => {
    const input = event.target.closest('.retorno-equipo');

    if (!input) {
        return;
    }

    await guardarRetorno(
        input.dataset.id,
        input.value,
        input
    );
});

// ============================================================
// EVENTOS DEL MODAL DE AGREGAR
// ============================================================

modalEquipoBody?.addEventListener('click', async event => {
    const boton = event.target.closest('.btn-agregar-equipo-modal');

    if (!boton) {
        return;
    }

    const equipo = equiposDisponibles.find(
        item => item.id === boton.dataset.id
    );

    if (!equipo) {
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Agregando...';

    const agregado = await agregarEquipo(equipo);

    if (agregado) {
        cerrarModal();
    } else {
        boton.disabled = false;
        boton.textContent = '+ Agregar';
    }
});

// ============================================================
// CERRAR CON ESCAPE
// ============================================================

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') {
        return;
    }

    if (!modalBorrado?.classList.contains('oculto')) {
        cerrarModalBorrado();
    } else {
        cerrarModal();
    }
});

// ============================================================
// INICIAR
// ============================================================

async function iniciar() {
    const eventoId = obtenerEventoId();

    if (!eventoId) {
        mostrarError(
            'Evento no especificado',
            'No se recibió el ID del evento en la URL.'
        );

        return;
    }

    try {
        estadoCargando?.classList.remove('oculto');
        estadoError?.classList.add('oculto');
        estadoConDatos?.classList.add('oculto');

        await cargarEvento(eventoId);
        await cargarEquiposAsignados(eventoId);

        estadoCargando?.classList.add('oculto');
        estadoConDatos?.classList.remove('oculto');
    } catch (error) {
        console.error('Error iniciando hoja de carga:', error);

        mostrarError(
            'No se pudo cargar la hoja de carga',
            error.message || 'Ocurrió un error inesperado.'
        );
    }
}

iniciar();