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

const ESTADOS_EDITABLES = ['cotizado', 'confirmado'];

const MAPA_CONDICION = {
    bueno: 'Bueno',
    regular: 'Regular',
    malo: 'Malo'
};


// ============================================================
// OBTENER ID DEL EVENTO
// ============================================================

function obtenerEventoId() {
    const params = new URLSearchParams(window.location.search);

    return (
        params.get('id') ||
        params.get('evento_id')
    );
}


// ============================================================
// FORMATEAR FECHAS
// ============================================================

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


// ============================================================
// CONVERTIR FECHA PARA INPUT DATETIME-LOCAL
// ============================================================

function convertirAInputFecha(fecha) {

    if (!fecha) {
        return '';
    }

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) {
        return '';
    }

    const pad = numero => String(numero).padStart(2, '0');

    const anio = fechaObj.getFullYear();
    const mes = pad(fechaObj.getMonth() + 1);
    const dia = pad(fechaObj.getDate());
    const hora = pad(fechaObj.getHours());
    const minutos = pad(fechaObj.getMinutes());

    return `${anio}-${mes}-${dia}T${hora}:${minutos}`;
}


// ============================================================
// MOSTRAR ERROR
// ============================================================

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

        console.error(
            'Error cargando evento:',
            error
        );

        throw new Error(
            error.message ||
            'No se pudo cargar el evento.'
        );
    }

    if (!data) {
        throw new Error('No se encontró el evento.');
    }

    eventoActual = data;

    pintarEvento(data);
    actualizarPermisos();
}


// ============================================================
// PINTAR INFORMACIÓN DEL EVENTO
// ============================================================

function pintarEvento(evento) {

    const nombreEvento =
        document.getElementById('evento-nombre');

    const clienteEvento =
        document.getElementById('evento-cliente');

    const estadoEvento =
        document.getElementById('evento-estado');

    const datoCliente =
        document.getElementById('dato-cliente');

    const datoSede =
        document.getElementById('dato-sede');

    const datoMontaje =
        document.getElementById('dato-montaje');

    const datoInicio =
        document.getElementById('dato-inicio');

    const datoFin =
        document.getElementById('dato-fin');

    const datoContacto =
        document.getElementById('dato-contacto');


    if (nombreEvento) {
        nombreEvento.textContent =
            evento.nombre || 'Evento sin nombre';
    }


    if (clienteEvento) {
        clienteEvento.textContent =
            evento.clientes?.nombre || 'Sin cliente';
    }


    if (estadoEvento) {
        estadoEvento.textContent =
            evento.estado || 'Sin estado';
    }


    if (datoCliente) {
        datoCliente.textContent =
            evento.clientes?.nombre || 'Sin cliente';
    }


    if (datoSede) {
        datoSede.textContent =
            evento.sede || 'Sin sede';
    }


    if (datoMontaje) {
        datoMontaje.textContent =
            formatearFecha(evento.fecha_montaje);
    }


    if (datoInicio) {
        datoInicio.textContent =
            formatearFecha(evento.fecha_inicio);
    }


    if (datoFin) {
        datoFin.textContent =
            formatearFecha(evento.fecha_fin);
    }


    if (datoContacto) {

        datoContacto.textContent =
            evento.clientes?.contacto ||
            evento.clientes?.telefono ||
            evento.clientes?.correo ||
            'Sin contacto';
    }


    const volverEvento =
        document.getElementById('volver-evento');


    if (volverEvento) {

        volverEvento.href =
            `detalle-evento.html?id=${encodeURIComponent(evento.id)}`;
    }
}


// ============================================================
// PERMISOS SEGÚN ESTADO
// ============================================================

function actualizarPermisos() {

    if (!eventoActual) {
        return;
    }

    const editable =
        ESTADOS_EDITABLES.includes(eventoActual.estado);


    if (btnAgregarEquipo) {

        btnAgregarEquipo.classList.toggle(
            'oculto',
            !editable
        );
    }


    if (btnAgregarPrimerEquipo) {

        btnAgregarPrimerEquipo.classList.toggle(
            'oculto',
            !editable
        );
    }


    document
        .querySelectorAll('.btn-quitar-equipo')
        .forEach(btn => {

            btn.classList.toggle(
                'oculto',
                !editable
            );
        });


    document
        .querySelectorAll('.retorno-equipo')
        .forEach(input => {

            input.disabled = !editable;
        });
}


// ============================================================
// PINTAR EQUIPOS ASIGNADOS
// ============================================================

function pintarEquiposAsignados() {

    if (!tablaEquipoBody) {
        return;
    }


    tablaEquipoBody.innerHTML = '';


    const cantidad =
        equiposAsignados.length;


    if (equipoConteo) {

        equipoConteo.textContent =
            `${cantidad} equipo${cantidad === 1 ? '' : 's'}`;
    }


    if (cantidad === 0) {

        tablaEquipoContenedor?.classList.add(
            'oculto'
        );

        document
            .getElementById('estado-sin-equipo')
            ?.classList.remove('oculto');

        actualizarPermisos();

        return;
    }


    tablaEquipoContenedor?.classList.remove(
        'oculto'
    );


    document
        .getElementById('estado-sin-equipo')
        ?.classList.add('oculto');


    equiposAsignados.forEach(asignacion => {

        const equipo =
            asignacion.equipos;


        const fila =
            document.createElement('tr');


        const condicion =
            MAPA_CONDICION[equipo?.condicion] ||
            equipo?.condicion ||
            '—';


        const fechaRetorno =
            convertirAInputFecha(
                asignacion.retorno_registrado
            );


        fila.innerHTML = `

            <td>
                ${equipo?.clave || '—'}
            </td>

            <td>
                ${equipo?.nombre || 'Sin nombre'}
            </td>

            <td>
                ${condicion}
            </td>

            <td>
                ${formatearFecha(
                    asignacion.salida_registrada
                )}
            </td>

            <td>

                <input
                    type="datetime-local"
                    class="campo retorno-equipo"
                    data-id="${asignacion.id}"
                    value="${fechaRetorno}"
                    title="Selecciona cuándo debe regresar este equipo"
                >

            </td>

            <td>

                <button
                    type="button"
                    class="btn btn--pequeno btn--secundario btn-quitar-equipo"
                    data-id="${asignacion.id}"
                >
                    Borrar
                </button>

            </td>
        `;


        tablaEquipoBody.appendChild(fila);
    });


    actualizarPermisos();
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

        console.error(
            'Error cargando equipos asignados:',
            error
        );

        throw new Error(
            error.message ||
            'No se pudieron cargar los equipos asignados.'
        );
    }


    equiposAsignados =
        data || [];


    pintarEquiposAsignados();
}


// ============================================================
// GUARDAR FECHA DE RETORNO
// ============================================================

async function guardarRetorno(
    asignacionId,
    valorInput,
    input
) {

    if (!asignacionId) {
        return;
    }


    let valorISO = null;


    if (valorInput) {

        const fecha =
            new Date(valorInput);


        if (Number.isNaN(fecha.getTime())) {

            alert(
                'La fecha de retorno no es válida.'
            );

            return;
        }


        valorISO =
            fecha.toISOString();
    }


    input.disabled = true;

    input.title =
        'Guardando...';


    const { error } =
        await supabase
            .from('evento_equipo')
            .update({
                retorno_registrado: valorISO
            })
            .eq('id', asignacionId);


    if (error) {

        console.error(
            'Error guardando retorno:',
            error
        );


        alert(
            'No se pudo guardar la fecha de retorno.\n\n' +
            error.message
        );


        input.disabled = false;

        input.title =
            'Error al guardar';

        return;
    }


    const asignacion =
        equiposAsignados.find(
            item => item.id === asignacionId
        );


    if (asignacion) {

        asignacion.retorno_registrado =
            valorISO;
    }


    input.disabled = false;

    input.title =
        'Fecha de retorno guardada';


    console.log(
        'Fecha de retorno guardada:',
        valorISO
    );
}


// ============================================================
// CARGAR EQUIPOS DISPONIBLES
// ============================================================

async function cargarEquiposDisponibles() {

    modalCargando?.classList.remove(
        'oculto'
    );

    modalTablaContenedor?.classList.add(
        'oculto'
    );

    modalVacio?.classList.add(
        'oculto'
    );

    modalError?.classList.add(
        'oculto'
    );


    const { data, error } =
        await supabase
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
            .order('clave', {
                ascending: true
            });


    if (error) {

        console.error(
            'Error cargando equipos disponibles:',
            error
        );


        modalCargando?.classList.add(
            'oculto'
        );

        modalError?.classList.remove(
            'oculto'
        );

        return;
    }


    const idsAsignados =
        new Set(
            equiposAsignados.map(
                asignacion =>
                    asignacion.equipo_id
            )
        );


    equiposDisponibles =
        (data || []).filter(
            equipo =>
                !idsAsignados.has(equipo.id)
        );


    modalCargando?.classList.add(
        'oculto'
    );


    if (
        equiposDisponibles.length === 0
    ) {

        modalTablaContenedor?.classList.add(
            'oculto'
        );

        modalVacio?.classList.remove(
            'oculto'
        );

        return;
    }


    pintarEquiposDisponibles();
}


// ============================================================
// PINTAR EQUIPOS DISPONIBLES
// ============================================================

function pintarEquiposDisponibles() {

    if (!modalEquipoBody) {
        return;
    }


    modalEquipoBody.innerHTML = '';


    equiposDisponibles.forEach(
        equipo => {

            const fila =
                document.createElement('tr');


            const condicion =
                MAPA_CONDICION[equipo.condicion] ||
                equipo.condicion ||
                '—';


            fila.innerHTML = `

                <td>
                    ${equipo.clave || '—'}
                </td>

                <td>
                    ${equipo.nombre || 'Sin nombre'}
                </td>

                <td>
                    ${condicion}
                </td>

                <td>

                    <button
                        type="button"
                        class="btn btn--pequeno btn--primario btn-agregar-equipo-modal"
                        data-id="${equipo.id}"
                    >
                        Agregar
                    </button>

                </td>
            `;


            modalEquipoBody.appendChild(
                fila
            );
        }
    );


    modalTablaContenedor?.classList.remove(
        'oculto'
    );
}


// ============================================================
// ABRIR MODAL
// ============================================================

async function abrirModal() {

    if (!eventoActual) {
        return;
    }


    modalEquipo?.classList.remove(
        'oculto'
    );


    await cargarEquiposDisponibles();
}


// ============================================================
// CERRAR MODAL
// ============================================================

function cerrarModal() {

    modalEquipo?.classList.add(
        'oculto'
    );
}


// ============================================================
// AGREGAR EQUIPO
// ============================================================

async function agregarEquipo(equipo) {

    if (!eventoActual) {
        return;
    }


    const { data, error } =
        await supabase
            .from('evento_equipo')
            .insert({
                evento_id: eventoActual.id,
                equipo_id: equipo.id,
                salida_registrada:
                    new Date().toISOString(),
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

        console.error(
            'Error agregando equipo:',
            error
        );


        alert(
            'No se pudo agregar el equipo.\n\n' +
            error.message
        );

        return;
    }


    equiposAsignados.push(
        data
    );


    pintarEquiposAsignados();


    await cargarEquiposDisponibles();
}


// ============================================================
// BORRAR EQUIPO DEL EVENTO
// ============================================================

async function quitarEquipo(
    asignacionId
) {

    const asignacion =
        equiposAsignados.find(
            item =>
                item.id === asignacionId
        );


    const nombreEquipo =
        asignacion?.equipos?.nombre ||
        'este equipo';


    const confirmar =
        confirm(
            `¿Seguro que quieres borrar "${nombreEquipo}" de este evento?`
        );


    if (!confirmar) {
        return;
    }


    const { error } =
        await supabase
            .from('evento_equipo')
            .delete()
            .eq('id', asignacionId);


    if (error) {

        console.error(
            'Error borrando equipo:',
            error
        );


        alert(
            'No se pudo borrar el equipo.\n\n' +
            error.message
        );

        return;
    }


    equiposAsignados =
        equiposAsignados.filter(
            item =>
                item.id !== asignacionId
        );


    pintarEquiposAsignados();


    await cargarEquiposDisponibles();
}


// ============================================================
// BOTONES AGREGAR
// ============================================================

btnAgregarEquipo?.addEventListener(
    'click',
    abrirModal
);


btnAgregarPrimerEquipo?.addEventListener(
    'click',
    abrirModal
);


// ============================================================
// CERRAR MODAL
// ============================================================

btnCerrarModal?.addEventListener(
    'click',
    cerrarModal
);


modalOverlay?.addEventListener(
    'click',
    cerrarModal
);


// ============================================================
// BORRAR EQUIPO
// ============================================================

tablaEquipoBody?.addEventListener(
    'click',
    async event => {

        const boton =
            event.target.closest(
                '.btn-quitar-equipo'
            );


        if (!boton) {
            return;
        }


        const asignacionId =
            boton.dataset.id;


        await quitarEquipo(
            asignacionId
        );
    }
);


// ============================================================
// CAMBIAR FECHA DE RETORNO
// ============================================================

tablaEquipoBody?.addEventListener(
    'change',
    async event => {

        const input =
            event.target.closest(
                '.retorno-equipo'
            );


        if (!input) {
            return;
        }


        const asignacionId =
            input.dataset.id;


        await guardarRetorno(
            asignacionId,
            input.value,
            input
        );
    }
);


// ============================================================
// AGREGAR EQUIPO DESDE MODAL
// ============================================================

modalEquipoBody?.addEventListener(
    'click',
    async event => {

        const boton =
            event.target.closest(
                '.btn-agregar-equipo-modal'
            );


        if (!boton) {
            return;
        }


        const equipoId =
            boton.dataset.id;


        const equipo =
            equiposDisponibles.find(
                item =>
                    item.id === equipoId
            );


        if (!equipo) {
            return;
        }


        boton.disabled = true;

        boton.textContent =
            'Agregando...';


        await agregarEquipo(
            equipo
        );


        boton.disabled = false;

        boton.textContent =
            'Agregar';
    }
);


// ============================================================
// ESC PARA CERRAR MODAL
// ============================================================

document.addEventListener(
    'keydown',
    event => {

        if (event.key === 'Escape') {
            cerrarModal();
        }
    }
);


// ============================================================
// INICIAR
// ============================================================

async function iniciar() {

    const eventoId =
        obtenerEventoId();


    if (!eventoId) {

        mostrarError(
            'Evento no especificado',
            'No se recibió el ID del evento en la URL.'
        );

        return;
    }


    try {

        estadoCargando?.classList.remove(
            'oculto'
        );

        estadoError?.classList.add(
            'oculto'
        );

        estadoConDatos?.classList.add(
            'oculto'
        );


        await cargarEvento(
            eventoId
        );


        await cargarEquiposAsignados(
            eventoId
        );


        estadoCargando?.classList.add(
            'oculto'
        );

        estadoConDatos?.classList.remove(
            'oculto'
        );


    } catch (error) {

        console.error(
            'Error iniciando hoja de carga:',
            error
        );


        mostrarError(
            'No se pudo cargar la hoja de carga',
            error.message ||
            'Ocurrió un error inesperado.'
        );
    }
}


iniciar();