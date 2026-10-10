import { supabase } from './supabaseClient.js';

/* =========================================================
   OBTENER ELEMENTOS
========================================================= */

const equipoClave = document.getElementById('equipo-clave');
const equipoNombre = document.getElementById('equipo-nombre');
const equipoCategoria = document.getElementById('equipo-categoria');
const equipoMarca = document.getElementById('equipo-marca');
const equipoModelo = document.getElementById('equipo-modelo');
const equipoSerie = document.getElementById('equipo-serie');
const equipoCondicion = document.getElementById('equipo-condicion');
const equipoEstado = document.getElementById('equipo-estado');
const equipoRevision = document.getElementById('equipo-revision');

const estadoSuperior = document.getElementById('estado-superior');
const resumenEstado = document.getElementById('resumen-estado');
const eventoActual = document.getElementById('evento-actual');
const fechasComprometidas = document.getElementById('fechas-comprometidas');
const fechaLibre = document.getElementById('fecha-libre');
const listaEventos = document.getElementById('lista-eventos');
const estadoError = document.getElementById('estado-error');

/* =========================================================
   OBTENER ID DESDE LA URL
========================================================= */

const parametros = new URLSearchParams(window.location.search);
const equipoId = parametros.get('id');

console.log('====================================');
console.log('FICHA DE EQUIPO');
console.log('ID recibido desde URL:', equipoId);
console.log('====================================');

/* =========================================================
   FORMATEAR FECHA
========================================================= */

function formatearFecha(fecha) {
    if (!fecha) {
        return '—';
    }

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
        return fecha;
    }

    return valor.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/* =========================================================
   TEXTO DE CONDICIÓN
========================================================= */

function obtenerCondicion(condicion) {
    const condiciones = {
        buen_estado: 'Buen estado',
        dañado: 'Dañado',
        faltante: 'Faltante'
    };

    return condiciones[condicion] || condicion || '—';
}

/* =========================================================
   OBTENER FECHA DE EVENTO
========================================================= */

function obtenerFechaEvento(evento, tipo) {
    if (!evento) {
        return null;
    }

    const posibles = {
        inicio: [
            'fecha_inicio',
            'fecha_hora_inicio',
            'inicio',
            'fecha_inicio_evento'
        ],
        fin: [
            'fecha_fin',
            'fecha_hora_fin',
            'fin',
            'fecha_fin_evento'
        ]
    };

    for (const campo of posibles[tipo] || []) {
        if (evento[campo]) {
            return evento[campo];
        }
    }

    return null;
}

/* =========================================================
   OBTENER NOMBRE DEL EVENTO
========================================================= */

function obtenerNombreEvento(evento) {
    if (!evento) {
        return 'Evento sin nombre';
    }

    return (
        evento.nombre ||
        evento.titulo ||
        'Evento sin nombre'
    );
}

/* =========================================================
   CARGAR EQUIPO
========================================================= */

async function cargarEquipo() {
    console.log('Buscando equipo con ID:', equipoId);

    if (!equipoId) {
        throw new Error('No se recibió el ID del equipo en la URL.');
    }

    const { data, error } = await supabase
        .from('equipos')
        .select(`
            id,
            clave,
            nombre,
            categoria_id,
            marca,
            modelo,
            numero_serie,
            condicion,
            activo,
            categorias (
                nombre
            )
        `)
        .eq('id', equipoId)
        .maybeSingle();

    console.log('Respuesta de Supabase:', data);
    console.log('Error de Supabase:', error);

    if (error) {
        console.error('Error al consultar equipos:', error);
        throw error;
    }

    if (!data) {
        throw new Error(
            `No se encontró ningún equipo con el ID: ${equipoId}`
        );
    }

    return data;
}

/* =========================================================
   CARGAR EVENTOS DEL EQUIPO
========================================================= */

async function cargarEventosEquipo() {
    console.log('Buscando eventos del equipo:', equipoId);

    const { data, error } = await supabase
        .from('evento_equipo')
        .select(`
            id,
            evento_id,
            equipo_id,
            eventos (
                id,
                nombre,
                fecha_montaje,
                fecha_inicio,
                fecha_fin,
                estado
            )
        `)
        .eq('equipo_id', equipoId);

    if (error) {
        console.error(
            'Error al cargar eventos del equipo:',
            error
        );

        throw error;
    }

    console.log('Eventos encontrados:', data);

    return data || [];
}

/* =========================================================
   MOSTRAR EQUIPO
========================================================= */

function mostrarEquipo(equipo) {
    console.log('Mostrando equipo:', equipo);

    if (equipoClave) {
        equipoClave.textContent = equipo.clave || '—';
    }

    if (equipoNombre) {
        equipoNombre.textContent = equipo.nombre || '—';
    }

    if (equipoCategoria) {
        equipoCategoria.textContent =
            equipo.categorias?.nombre
                ? `Equipo audiovisual · ${equipo.categorias.nombre}`
                : 'Equipo audiovisual';
    }

    if (equipoMarca) {
        equipoMarca.textContent = equipo.marca || '—';
    }

    if (equipoModelo) {
        equipoModelo.textContent = equipo.modelo || '—';
    }

    if (equipoSerie) {
        equipoSerie.textContent =
            equipo.numero_serie || '—';
    }

    if (equipoCondicion) {
        equipoCondicion.textContent =
            obtenerCondicion(equipo.condicion);
    }

    /* =====================================================
       ESTADO BASE
    ===================================================== */

    if (equipo.activo) {
        if (equipoEstado) {
            equipoEstado.textContent = '● Disponible';
            equipoEstado.className =
                'ficha-estado ficha-estado--disponible';
        }

        if (estadoSuperior) {
            estadoSuperior.textContent = '● Disponible';
            estadoSuperior.className =
                'ficha-estado ficha-estado--disponible';
        }
    } else {
        if (equipoEstado) {
            equipoEstado.textContent = '● No disponible';
            equipoEstado.className =
                'ficha-estado ficha-estado--mantenimiento';
        }

        if (estadoSuperior) {
            estadoSuperior.textContent = '● No disponible';
            estadoSuperior.className =
                'ficha-estado ficha-estado--mantenimiento';
        }
    }
}

/* =========================================================
   ACTUALIZAR ESTADO VISUAL
========================================================= */

function actualizarEstadoVisual(estado, texto) {
    const clase =
        estado === 'comprometido'
            ? 'ficha-estado ficha-estado--comprometido'
            : estado === 'mantenimiento'
                ? 'ficha-estado ficha-estado--mantenimiento'
                : 'ficha-estado ficha-estado--disponible';

    if (resumenEstado) {
        resumenEstado.className = clase;
        resumenEstado.textContent = texto;
    }

    if (estadoSuperior) {
        estadoSuperior.className = clase;
        estadoSuperior.textContent = texto;
    }

    if (equipoEstado) {
        equipoEstado.className = clase;
        equipoEstado.textContent = texto;
    }
}

/* =========================================================
   MOSTRAR DISPONIBILIDAD
========================================================= */

function mostrarDisponibilidad(registros) {
    if (!listaEventos) {
        return;
    }

    listaEventos.innerHTML = '';

    const eventos = registros
        .map(registro => registro.eventos)
        .filter(Boolean);

    // Se excluyen los cancelados.
    // Los cotizados pueden mostrarse, pero no apartan el equipo.
    const eventosValidos = eventos.filter(
        evento => evento.estado?.trim().toLowerCase() !== 'cancelado'
    );

    /* =====================================================
       SIN EVENTOS
    ===================================================== */

    if (eventosValidos.length === 0) {
        actualizarEstadoVisual(
            'disponible',
            '● Disponible'
        );

        if (eventoActual) {
            eventoActual.textContent = 'Sin evento comprometido';
        }

        if (fechasComprometidas) {
            fechasComprometidas.textContent = '—';
        }

        if (fechaLibre) {
            fechaLibre.textContent = 'Disponible actualmente';
        }

        listaEventos.innerHTML = `
            <div class="estado-carga">
                Este equipo no tiene eventos comprometidos.
            </div>
        `;

        return;
    }

    /* =====================================================
       ORDENAR EVENTOS POR FECHA DE INICIO
    ===================================================== */

    eventosValidos.sort((a, b) => {
        const fechaA = obtenerFechaEvento(a, 'inicio');
        const fechaB = obtenerFechaEvento(b, 'inicio');

        return (
            new Date(fechaA || 0) -
            new Date(fechaB || 0)
        );
    });

    /* =====================================================
       EVENTOS QUE COMPROMETEN EL EQUIPO
    ===================================================== */

    const ahora = new Date();

    const eventosComprometidos = eventosValidos.filter(evento => {
        const estado = evento.estado?.trim().toLowerCase();

        // CRITERIO: solamente los eventos confirmados apartan equipo.
        // Los cotizados, cancelados y demás estados quedan fuera.
        if (estado !== 'confirmado') {
            return false;
        }

        const fin = obtenerFechaEvento(evento, 'fin');

        // Si no tiene fecha de fin, no se puede asegurar cuándo queda libre.
        if (!fin) {
            return true;
        }

        const fechaFin = new Date(fin);

        if (Number.isNaN(fechaFin.getTime())) {
            return false;
        }

        return fechaFin >= ahora;
    });

    /* =====================================================
       NO HAY EVENTOS ACTUALES O FUTUROS QUE COMPROMETAN
    ===================================================== */

    if (eventosComprometidos.length === 0) {
        actualizarEstadoVisual(
            'disponible',
            '● Disponible'
        );

        if (eventoActual) {
            eventoActual.textContent = 'Sin evento comprometido';
        }

        if (fechasComprometidas) {
            fechasComprometidas.textContent = '—';
        }

        if (fechaLibre) {
            fechaLibre.textContent = 'Disponible actualmente';
        }

        // Se conservan las tarjetas para consultar los eventos cotizados.
        eventosValidos.forEach(evento => {
            crearEventoVisual(evento);
        });

        return;
    }

    /* =====================================================
       EVENTO PRINCIPAL Y CÁLCULO DE DISPONIBILIDAD
    ===================================================== */

    const eventoPrincipal = eventosComprometidos[0];

    const inicioPrincipal = obtenerFechaEvento(
        eventoPrincipal,
        'inicio'
    );

    const finPrincipal = obtenerFechaEvento(
        eventoPrincipal,
        'fin'
    );

    // Fecha de finalización del compromiso que se está evaluando.
    let finCompromiso = finPrincipal;

    let finTimestamp = finPrincipal
        ? new Date(finPrincipal).getTime()
        : Infinity;

    // Si no hay fecha de fin, no se puede determinar cuándo queda libre.
    let sinFechaFin = !finPrincipal;

    // Revisar eventos confirmados consecutivos o que se solapan.
    for (const evento of eventosComprometidos.slice(1)) {
        const inicio = obtenerFechaEvento(evento, 'inicio');
        const fin = obtenerFechaEvento(evento, 'fin');

        if (!inicio) {
            continue;
        }

        const inicioTimestamp = new Date(inicio).getTime();

        if (Number.isNaN(inicioTimestamp)) {
            continue;
        }

        // Si el siguiente evento empieza después de terminar
        // el compromiso actual, existe un intervalo libre.
        if (inicioTimestamp > finTimestamp) {
            break;
        }

        // Si el siguiente evento no tiene fecha de fin,
        // no se puede determinar cuándo termina el compromiso.
        if (!fin) {
            sinFechaFin = true;
            break;
        }

        const nuevoFinTimestamp = new Date(fin).getTime();

        if (Number.isNaN(nuevoFinTimestamp)) {
            continue;
        }

        if (nuevoFinTimestamp > finTimestamp) {
            finTimestamp = nuevoFinTimestamp;
            finCompromiso = fin;
        }
    }

    /* =====================================================
       ACTUALIZAR RESUMEN
    ===================================================== */

    actualizarEstadoVisual(
        'comprometido',
        '● Comprometido'
    );

    if (eventoActual) {
        eventoActual.textContent =
            obtenerNombreEvento(eventoPrincipal);
    }

    if (fechasComprometidas) {
        fechasComprometidas.textContent =
            inicioPrincipal || finCompromiso
                ? `${formatearFecha(inicioPrincipal)} — ${formatearFecha(finCompromiso)}`
                : 'Fechas no registradas';
    }

    if (fechaLibre) {
        fechaLibre.textContent = sinFechaFin
            ? 'Fecha de finalización no registrada'
            : formatearFecha(finCompromiso);
    }

    /* =====================================================
       MOSTRAR LISTA DE EVENTOS
    ===================================================== */

    eventosValidos.forEach(evento => {
        crearEventoVisual(evento);
    });
}

/* =========================================================
   CREAR EVENTO VISUAL
========================================================= */

function crearEventoVisual(evento) {
    const inicio = obtenerFechaEvento(evento, 'inicio');
    const fin = obtenerFechaEvento(evento, 'fin');

    const item = document.createElement('div');
    item.className = 'evento-item';

    const estado = evento.estado?.trim().toLowerCase();

    let textoEstado = '● ' + (evento.estado || 'Sin estado');
    const claseEstado = 'evento-item__estado';

    if (estado === 'cotizado') {
        textoEstado = '● Cotizado';
    } else if (estado === 'confirmado') {
        textoEstado = '● Confirmado';
    } else if (estado === 'en montaje' || estado === 'en_montaje') {
        textoEstado = '● En montaje';
    } else if (estado === 'cancelado') {
        textoEstado = '● Cancelado';
    }

    item.innerHTML = `
        <span class="${claseEstado}">
            ${textoEstado}
        </span>

        <span class="evento-item__nombre">
            ${obtenerNombreEvento(evento)}
        </span>

        <span class="evento-item__fecha">
            ${formatearFecha(inicio)}
            —
            ${formatearFecha(fin)}
        </span>

        <span class="evento-item__libre">
            Libre:
            ${formatearFecha(fin)}
        </span>
    `;

    listaEventos.appendChild(item);
}

/* =========================================================
   MOSTRAR ERROR
========================================================= */

function mostrarError(error) {
    console.error(
        'ERROR EN FICHA DE EQUIPO:',
        error
    );

    if (estadoError) {
        estadoError.classList.remove('oculto');
    }

    if (listaEventos) {
        listaEventos.innerHTML = `
            <div class="estado-carga">
                No se pudo cargar la información del equipo.
            </div>
        `;
    }
}

/* =========================================================
   INICIAR
========================================================= */

async function iniciar() {
    try {
        /* -----------------------------------------------
           VERIFICAR ID
        ------------------------------------------------ */

        if (!equipoId) {
            throw new Error(
                'No se recibió el ID del equipo.'
            );
        }

        /* -----------------------------------------------
           CARGAR EQUIPO
        ------------------------------------------------ */

        const equipo = await cargarEquipo();

        console.log(
            'EQUIPO ENCONTRADO:',
            equipo
        );

        mostrarEquipo(equipo);

        /* -----------------------------------------------
           CARGAR EVENTOS
        ------------------------------------------------ */

        const eventos = await cargarEventosEquipo();

        mostrarDisponibilidad(eventos);
    } catch (error) {
        mostrarError(error);
    }
}

/* =========================================================
   EJECUTAR
========================================================= */

iniciar();