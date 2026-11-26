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

const ESTADOS_QUE_RESERVAN_EQUIPO = [
    'cotizado',
    'confirmado',
    'en_montaje'
];

const MAPA_CONDICION = {
    bueno: 'Bueno',
    regular: 'Regular',
    malo: 'Malo',
    buen_estado: 'Buen estado',
    dañado: 'Dañado',
    faltante: 'Faltante'
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
    if (!fecha) return '—';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) return '—';

    return fechaObj.toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function obtenerCondicion(equipo) {
    const condicion = equipo?.condicion;

    if (!condicion) return 'Sin especificar';

    const clave = String(condicion).trim().toLowerCase();

    return MAPA_CONDICION[clave] || condicion;
}

// Detecta equipos dañados aunque tengan mayúsculas o acentos.
function equipoEstaDanado(equipo) {
    const condicion = String(equipo?.condicion ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return [
        'danado',
        'malo',
        'fuera de servicio',
        'fuera_de_servicio'
    ].includes(condicion);
}

function obtenerCondicionRetorno(condicion) {
    if (!condicion) return 'Sin registrar';

    return MAPA_CONDICION[String(condicion).toLowerCase()]
        || condicion;
}

function eventoEsEditable() {
    return eventoActual &&
        ESTADOS_EDITABLES.includes(eventoActual.estado);
}

function mostrarError(titulo, texto) {
    if (errorTitulo) errorTitulo.textContent = titulo;
    if (errorTexto) errorTexto.textContent = texto;

    estadoCargando?.classList.add('oculto');
    estadoConDatos?.classList.add('oculto');
    estadoError?.classList.remove('oculto');
}

// ============================================================
// VALIDACIÓN DE DISPONIBILIDAD DE EQUIPOS
// ============================================================

// Convierte fechas de Supabase a fechas comparables.
// Las columnas DATE se interpretan como fechas locales.
function convertirFechaComparacion(valor, esFin = false) {
    if (!valor) return null;

    const texto = String(valor).trim();
    let fecha;

    const soloFecha = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (soloFecha) {
        const anio = Number(soloFecha[1]);
        const mes = Number(soloFecha[2]) - 1;
        const dia = Number(soloFecha[3]);

        fecha = esFin
            ? new Date(anio, mes, dia, 23, 59, 59, 999)
            : new Date(anio, mes, dia, 0, 0, 0, 0);
    } else {
        fecha = new Date(texto);

        if (
            esFin &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)
        ) {
            fecha.setSeconds(59, 999);
        }
    }

    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Obtiene el periodo que ocupa un evento.
// El montaje cuenta como inicio de la ocupación.
function obtenerPeriodoEvento(evento) {
    if (!evento) return null;

    const inicioValor =
        evento.fecha_montaje || evento.fecha_inicio;

    const finValor =
        evento.fecha_fin || evento.fecha_inicio;

    const inicio = convertirFechaComparacion(inicioValor, false);
    const fin = convertirFechaComparacion(finValor, true);

    if (!inicio || !fin || inicio > fin) {
        return null;
    }

    return { inicio, fin };
}

// Comprueba si dos eventos ocupan fechas coincidentes.
function eventosSeTraslapan(eventoA, eventoB) {
    const periodoA = obtenerPeriodoEvento(eventoA);
    const periodoB = obtenerPeriodoEvento(eventoB);

    // Si faltan fechas, se bloquea por seguridad.
    if (!periodoA || !periodoB) {
        return true;
    }

    return (
        periodoA.inicio <= periodoB.fin &&
        periodoB.inicio <= periodoA.fin
    );
}

// Consulta los equipos asignados a otros eventos y determina
// cuáles están reservados durante las fechas del evento actual.
async function obtenerIdsEquiposOcupadosEnOtrosEventos() {
    if (!eventoActual) return new Set();

    const [
        resultadoAsignaciones,
        resultadoEventos
    ] = await Promise.all([
        supabase
            .from('evento_equipo')
            .select('equipo_id, evento_id'),

        supabase
            .from('eventos')
            .select(`
                id,
                estado,
                fecha_montaje,
                fecha_inicio,
                fecha_fin
            `)
    ]);

    if (resultadoAsignaciones.error) {
        throw new Error(
            `No se pudieron consultar las reservas de equipos: ${resultadoAsignaciones.error.message}`
        );
    }

    if (resultadoEventos.error) {
        throw new Error(
            `No se pudieron consultar las fechas de los eventos: ${resultadoEventos.error.message}`
        );
    }

    const eventosPorId = new Map(
        (resultadoEventos.data || []).map(evento => [
            String(evento.id),
            evento
        ])
    );

    const idsOcupados = new Set();

    (resultadoAsignaciones.data || []).forEach(asignacion => {
        // Ignora los equipos que ya pertenecen al evento actual.
        if (
            String(asignacion.evento_id) ===
            String(eventoActual.id)
        ) {
            return;
        }

        const eventoReserva = eventosPorId.get(
            String(asignacion.evento_id)
        );

        // Si no se encuentra el evento de la asignación,
        // se bloquea el equipo por seguridad.
        if (!eventoReserva) {
            idsOcupados.add(String(asignacion.equipo_id));
            return;
        }

        const estado = String(eventoReserva.estado || '')
            .trim()
            .toLowerCase();

        // Los eventos cerrados o cancelados liberan el equipo.
        if (!ESTADOS_QUE_RESERVAN_EQUIPO.includes(estado)) {
            return;
        }

        // Solo bloquea si las fechas coinciden.
        if (eventosSeTraslapan(eventoActual, eventoReserva)) {
            idsOcupados.add(String(asignacion.equipo_id));
        }
    });

    return idsOcupados;
}

// ============================================================
// MODALES
// ============================================================

function actualizarFondoModal() {
    const hayModalAbierto =
        !modalEquipo?.classList.contains('oculto') ||
        !modalBorrado?.classList.contains('oculto');

    modalOverlay?.classList.toggle('oculto', !hayModalAbierto);
}

function abrirModal() {
    if (!eventoEsEditable()) return;

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
    if (!eventoEsEditable()) return;

    const asignacion = equiposAsignados.find(
        item => item.id === asignacionId
    );

    if (!asignacion) return;

    // Evita quitar equipos que ya tienen movimientos.
    if (
        asignacion.salida_registrada ||
        asignacion.retorno_registrado
    ) {
        alert(
            'No puedes quitar un equipo que ya tiene una salida o retorno registrado.'
        );

        return;
    }

    asignacionPendienteBorrar = asignacionId;

    if (nombreEquipoBorrado) {
        nombreEquipoBorrado.textContent =
            asignacion.equipos?.nombre || 'Equipo sin nombre';
    }

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
    if (btnConfirmarBorrado?.disabled) return;

    modalBorrado?.classList.add('oculto');
    asignacionPendienteBorrar = null;

    actualizarFondoModal();
}

function mostrarErrorBorrado(mensaje) {
    if (!errorBorrado) return;

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

        throw new Error(
            error.message || 'No se pudo cargar el evento.'
        );
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
            evento.clientes?.contacto ||
            evento.clientes?.telefono ||
            evento.clientes?.correo ||
            'Sin contacto'
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
    if (!eventoActual) return;

    const editable = eventoEsEditable();

    btnAgregarEquipo?.classList.toggle('oculto', !editable);
    btnAgregarPrimerEquipo?.classList.toggle('oculto', !editable);

    document.querySelectorAll('.btn-quitar-equipo').forEach(boton => {
        boton.classList.toggle('oculto', !editable);
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
    if (!tablaEquipoBody) return;

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

        const salida = formatearFecha(
            asignacion.salida_registrada
        );

        const retorno = formatearFecha(
            asignacion.retorno_registrado
        );

        const condicionRetorno = obtenerCondicionRetorno(
            asignacion.condicion_retorno
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
                    ${escaparHTML(salida)}
                </span>
            </td>

            <td>
                <div class="retorno-informacion">
                    <span class="pequeno">
                        ${escaparHTML(retorno)}
                    </span>

                    <span class="pequeno">
                        Condición: ${escaparHTML(condicionRetorno)}
                    </span>

                    ${
                        asignacion.nota
                            ? `<span class="pequeno">Nota: ${escaparHTML(asignacion.nota)}</span>`
                            : ''
                    }

                    ${
                        asignacion.pendiente_envio
                            ? '<span class="etiqueta etiqueta--pendiente">Pendiente de sincronizar</span>'
                            : ''
                    }
                </div>
            </td>

            <td>
                <button
                    type="button"
                    class="btn btn--pequeno btn--secundario btn-quitar-equipo"
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

    try {
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

        if (error) throw error;

        // Consultamos las reservas de los demás eventos.
        const idsOcupados =
            await obtenerIdsEquiposOcupadosEnOtrosEventos();

        const idsAsignadosActuales = new Set(
            equiposAsignados.map(asignacion =>
                String(asignacion.equipo_id)
            )
        );

        // Quitamos los equipos que ya están asignados al evento actual
        // o reservados en otro evento con fechas coincidentes.
        equiposDisponibles = (data || []).filter(equipo => {
            const id = String(equipo.id);

            return (
                !idsAsignadosActuales.has(id) &&
                !idsOcupados.has(id)
            );
        });

        modalCargando?.classList.add('oculto');

        if (equiposDisponibles.length === 0) {
            modalTablaContenedor?.classList.add('oculto');
            modalVacio?.classList.remove('oculto');
            return;
        }

        pintarEquiposDisponibles();

    } catch (error) {
        console.error('Error cargando equipos disponibles:', error);

        modalCargando?.classList.add('oculto');

        if (modalError) {
            modalError.textContent =
                `No se pudieron verificar los equipos disponibles: ${error.message || 'Error desconocido'}`;

            modalError.classList.remove('oculto');
        }
    }
}

// ============================================================
// PINTAR EQUIPOS DISPONIBLES
// ============================================================

function pintarEquiposDisponibles() {
    if (!modalEquipoBody) return;

    modalEquipoBody.innerHTML = '';

    equiposDisponibles.forEach(equipo => {
        const fila = document.createElement('tr');
        const estaDanado = equipoEstaDanado(equipo);

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
                        ${estaDanado ? 'disabled aria-disabled="true" title="No se puede agregar: equipo dañado"' : ''}
                    >
                        ${estaDanado ? 'Dañado' : '+ Agregar'}
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
    if (!eventoEsEditable()) return false;

    // Nunca permite agregar un equipo dañado.
    if (equipoEstaDanado(equipo)) {
        if (modalError) {
            modalError.textContent =
                'No se puede agregar un equipo dañado al evento.';

            modalError.classList.remove('oculto');
        }

        return false;
    }

    // Volvemos a consultar la disponibilidad antes de guardar.
    // Así evitamos utilizar una lista que ya quedó desactualizada.
    try {
        const idsOcupados =
            await obtenerIdsEquiposOcupadosEnOtrosEventos();

        const idsAsignadosActuales = new Set(
            equiposAsignados.map(asignacion =>
                String(asignacion.equipo_id)
            )
        );

        if (
            idsOcupados.has(String(equipo.id)) ||
            idsAsignadosActuales.has(String(equipo.id))
        ) {
            if (modalError) {
                modalError.textContent =
                    'Este equipo ya está reservado para otro evento en fechas que se cruzan. Actualiza la lista y selecciona otro equipo.';

                modalError.classList.remove('oculto');
            }

            await cargarEquiposDisponibles();
            return false;
        }

    } catch (error) {
        console.error(
            'No se pudo verificar la disponibilidad del equipo:',
            error
        );

        if (modalError) {
            modalError.textContent =
                `No se pudo verificar la disponibilidad: ${error.message || 'Error desconocido'}`;

            modalError.classList.remove('oculto');
        }

        return false;
    }

    const { data, error } = await supabase
        .from('evento_equipo')
        .insert({
            evento_id: eventoActual.id,
            equipo_id: equipo.id,

            // El coordinador solamente asigna el equipo.
            // El técnico registra la salida desde su hoja.
            salida_registrada: null,
            retorno_registrado: null,
            condicion_retorno: null,
            nota: null,
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
    if (!eventoEsEditable()) return false;

    const asignacion = equiposAsignados.find(
        item => item.id === asignacionId
    );

    if (
        asignacion?.salida_registrada ||
        asignacion?.retorno_registrado
    ) {
        mostrarErrorBorrado(
            'No puedes quitar un equipo que ya tiene una salida o retorno registrado.'
        );

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
    if (
        !asignacionPendienteBorrar ||
        !eventoEsEditable()
    ) {
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
btnCancelarBorrado?.addEventListener('click', cerrarModalBorrado);
btnConfirmarBorrado?.addEventListener('click', confirmarBorrado);

modalOverlay?.addEventListener('click', () => {
    if (!modalBorrado?.classList.contains('oculto')) {
        cerrarModalBorrado();
    } else {
        cerrarModal();
    }
});

// ============================================================
// EVENTOS DE LA TABLA
// ============================================================

tablaEquipoBody?.addEventListener('click', event => {
    const boton = event.target.closest('.btn-quitar-equipo');

    if (!boton) return;

    abrirModalBorrado(boton.dataset.id);
});

// ============================================================
// EVENTOS DEL MODAL
// ============================================================

modalEquipoBody?.addEventListener('click', async event => {
    const boton = event.target.closest('.btn-agregar-equipo-modal');

    if (!boton || boton.disabled) return;

    const equipo = equiposDisponibles.find(
        item => item.id === boton.dataset.id
    );

    if (!equipo) return;

    // Protección adicional para equipos dañados.
    if (equipoEstaDanado(equipo)) {
        boton.disabled = true;
        boton.textContent = 'Dañado';
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Agregando...';

    const agregado = await agregarEquipo(equipo);

    if (agregado) {
        cerrarModal();
    } else if (!equipoEstaDanado(equipo)) {
        boton.disabled = false;
        boton.textContent = '+ Agregar';
    }
});

// ============================================================
// CERRAR CON ESCAPE
// ============================================================

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    if (!modalBorrado?.classList.contains('oculto')) {
        cerrarModalBorrado();
    } else {
        cerrarModal();
    }
});

// ============================================================
// ACTUALIZAR DATOS DEL RETORNO
// ============================================================

// Si el técnico registra un retorno mientras el coordinador
// tiene abierta la hoja, se actualiza la tabla automáticamente.

supabase
    .channel('cambios-evento-equipo')
    .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'evento_equipo'
        },
        payload => {
            if (
                payload.new?.evento_id === eventoActual?.id ||
                payload.old?.evento_id === eventoActual?.id
            ) {
                cargarEquiposAsignados(eventoActual.id);
            }
        }
    )
    .subscribe();

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