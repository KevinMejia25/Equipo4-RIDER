
import { supabase } from './supabaseClient.js';

/* =========================================================
   ELEMENTOS DEL DOM
========================================================= */

const equipoClave = document.getElementById('equipo-clave');
const equipoNombre = document.getElementById('equipo-nombre');
const equipoCategoria = document.getElementById('equipo-categoria');
const equipoMarca = document.getElementById('equipo-marca');
const equipoModelo = document.getElementById('equipo-modelo');
const equipoSerie = document.getElementById('equipo-serie');
const equipoCondicion = document.getElementById('equipo-condicion');
const equipoEstado = document.getElementById('equipo-estado');

const estadoSuperior = document.getElementById('estado-superior');
const resumenEstado = document.getElementById('resumen-estado');
const eventoActual = document.getElementById('evento-actual');
const fechasComprometidas = document.getElementById('fechas-comprometidas');
const fechaLibre = document.getElementById('fecha-libre');
const listaEventos = document.getElementById('lista-eventos');
const estadoError = document.getElementById('estado-error');

// Título de la sección de calendario/asignaciones
const tituloCalendario = document.querySelector('.calendario__titulo');

const parametros = new URLSearchParams(window.location.search);
const equipoId = parametros.get('id');

console.log('FICHA DE EQUIPO. ID recibido:', equipoId);

// Identificar si se muestra una ficha individual o las asignaciones generales
if (equipoId) {
    document.body.classList.remove('vista-asignaciones');
} else {
    document.body.classList.add('vista-asignaciones');
}

/* =========================================================
   UTILIDADES
========================================================= */

function normalizarEstado(estado) {
    return String(estado || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function escaparHTML(valor) {
    return String(valor ?? '—').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caracter]);
}

function formatearFecha(fecha) {
    if (!fecha) return 'Fecha pendiente';

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
        return String(fecha);
    }

    return valor.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function obtenerTimestamp(fecha) {
    if (!fecha) return null;

    const timestamp = new Date(fecha).getTime();

    return Number.isNaN(timestamp) ? null : timestamp;
}

function obtenerCondicion(condicion) {
    const condiciones = {
        buen_estado: 'Buen estado',
        danado: 'Dañado',
        dañado: 'Dañado',
        faltante: 'Faltante'
    };

    return condiciones[condicion] || condicion || '—';
}

function obtenerNombreEvento(evento) {
    return evento?.nombre || evento?.titulo || 'Evento sin nombre';
}

function obtenerFechaInicio(evento) {
    return evento?.fecha_inicio
        || evento?.fecha_montaje
        || evento?.fecha_hora_inicio
        || evento?.inicio
        || evento?.fecha_inicio_evento
        || null;
}

function obtenerFechaFin(evento) {
    return evento?.fecha_fin
        || evento?.fecha_hora_fin
        || evento?.fin
        || evento?.fecha_fin_evento
        || null;
}

function eventoCancelado(evento) {
    return normalizarEstado(evento?.estado) === 'cancelado';
}

function eventoComprometido(evento) {
    const estado = normalizarEstado(evento?.estado);

    return [
        'confirmado',
        'en montaje',
        'en_montaje'
    ].includes(estado);
}

function actualizarEstadoVisual(estado, texto) {
    const clase = estado === 'comprometido'
        ? 'ficha-estado ficha-estado--comprometido'
        : estado === 'mantenimiento'
            ? 'ficha-estado ficha-estado--mantenimiento'
            : 'ficha-estado ficha-estado--disponible';

    [estadoSuperior, equipoEstado, resumenEstado].forEach(elemento => {
        if (!elemento) return;

        elemento.className = clase;
        elemento.textContent = texto;
    });
}

function mostrarError(error) {
    console.error('ERROR EN FICHA DE EQUIPO:', error);

    if (estadoError) {
        estadoError.classList.remove('oculto');
        estadoError.textContent =
            `No se pudo cargar la información: ${error?.message || 'Error desconocido'}`;
    }

    if (listaEventos) {
        listaEventos.replaceChildren();

        const mensaje = document.createElement('p');
        mensaje.className = 'estado-carga';
        mensaje.textContent =
            'No se pudieron consultar los eventos. Revisa la consola para conocer el motivo.';

        listaEventos.appendChild(mensaje);
    }
}

function limpiarError() {
    if (estadoError) {
        estadoError.classList.add('oculto');
        estadoError.textContent = '';
    }
}

/* =========================================================
   CONSULTAR UN EQUIPO POR SU ID
========================================================= */

async function cargarEquipo(id) {
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
            categorias(nombre)
        `)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error consultando equipos:', error);
        throw error;
    }

    if (!data) {
        throw new Error(
            `No se encontró un equipo con el ID "${id}". Comprueba que la URL utilice equipos.id.`
        );
    }

    return data;
}

/* =========================================================
   CONSULTAR ASIGNACIONES DE UN EQUIPO
========================================================= */

async function cargarEventosEquipo(id) {
    const { data, error } = await supabase
        .from('evento_equipo')
        .select(`
            id,
            equipo_id,
            evento_id,
            eventos(
                id,
                nombre,
                fecha_montaje,
                fecha_inicio,
                fecha_fin,
                estado
            )
        `)
        .eq('equipo_id', id);

    if (error) {
        console.error('Error consultando evento_equipo:', error);
        throw error;
    }

    console.log('Asignaciones encontradas para el equipo:', data);

    return data || [];
}

/* =========================================================
   CONSULTAR TODAS LAS ASIGNACIONES
========================================================= */

async function cargarTodasLasAsignaciones() {
    const { data, error } = await supabase
        .from('evento_equipo')
        .select(`
            id,
            equipo_id,
            evento_id,
            equipos(
                id,
                clave,
                nombre,
                marca,
                modelo,
                numero_serie,
                condicion,
                activo,
                categorias(nombre)
            ),
            eventos(
                id,
                nombre,
                fecha_montaje,
                fecha_inicio,
                fecha_fin,
                estado
            )
        `);

    if (error) {
        console.error('Error consultando todas las asignaciones:', error);
        throw error;
    }

    console.log('Todas las asignaciones:', data);

    return (data || []).filter(registro =>
        registro.equipos && registro.eventos
    );
}

/* =========================================================
   MOSTRAR INFORMACIÓN DEL EQUIPO
========================================================= */

function mostrarEquipo(equipo) {
    // Restaurar el título para la ficha individual.
    if (tituloCalendario) {
        tituloCalendario.textContent = 'Calendario de compromisos';
    }

    if (equipoClave) {
        equipoClave.textContent = equipo.clave || '—';
    }

    if (equipoNombre) {
        equipoNombre.textContent = equipo.nombre || '—';
    }

    if (equipoCategoria) {
        equipoCategoria.textContent =
            equipo.categorias?.nombre || 'Sin categoría';
    }

    if (equipoMarca) {
        equipoMarca.textContent = equipo.marca || '—';
    }

    if (equipoModelo) {
        equipoModelo.textContent = equipo.modelo || '—';
    }

    if (equipoSerie) {
        equipoSerie.textContent = equipo.numero_serie || '—';
    }

    if (equipoCondicion) {
        equipoCondicion.textContent =
            obtenerCondicion(equipo.condicion);
    }

    if (equipo.activo === false) {
        actualizarEstadoVisual('mantenimiento', '● No disponible');
    } else {
        actualizarEstadoVisual('disponible', '● Disponible');
    }
}

/* =========================================================
   CREAR TARJETA DE EVENTO
========================================================= */

function crearTarjetaEvento(evento, equipo = null) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'evento-item';

    const estado = normalizarEstado(evento.estado);

    let etiqueta = evento.estado || 'Sin estado';

    if (estado === 'cotizado') etiqueta = 'Cotizado';
    if (estado === 'confirmado') etiqueta = 'Confirmado';

    if (estado === 'en montaje' || estado === 'en_montaje') {
        etiqueta = 'En montaje';
    }

    if (estado === 'cancelado') etiqueta = 'Cancelado';

    const elementos = [
        ['evento-item__estado', `● ${etiqueta}`],
        ['evento-item__nombre', `Evento: ${obtenerNombreEvento(evento)}`],
        [
            'evento-item__fecha',
            `Montaje/inicio: ${formatearFecha(obtenerFechaInicio(evento))} | Fin: ${formatearFecha(obtenerFechaFin(evento))}`
        ]
    ];

    if (equipo) {
        elementos.push([
            'evento-item__nombre',
            `Equipo: ${equipo.clave || 'Sin clave'} — ${equipo.nombre || 'Sin nombre'}`
        ]);
    }

    if (estado === 'cotizado') {
        elementos.push([
            'evento-item__libre',
            'Pendiente de confirmación; no bloquea la disponibilidad definitiva.'
        ]);
    } else if (eventoComprometido(evento)) {
        elementos.push([
            'evento-item__libre',
            obtenerFechaFin(evento)
                ? `Fin previsto: ${formatearFecha(obtenerFechaFin(evento))}`
                : 'Fecha final pendiente de registrar.'
        ]);
    }

    elementos.forEach(([clase, texto]) => {
        const elemento = document.createElement('div');
        elemento.className = clase;
        elemento.textContent = texto;
        tarjeta.appendChild(elemento);
    });

    if (equipo?.id) {
        const enlace = document.createElement('a');
        enlace.className = 'btn btn--pequeno btn--secundario';
        enlace.href =
            `ficha-equipo.html?id=${encodeURIComponent(equipo.id)}`;
        enlace.textContent = 'Ver ficha del equipo';
        tarjeta.appendChild(enlace);
    }

    return tarjeta;
}

/* =========================================================
   MOSTRAR CALENDARIO DE UN EQUIPO
========================================================= */

function mostrarDisponibilidad(registros, equipo) {
    if (!listaEventos) return;

    listaEventos.replaceChildren();

    const eventos = registros
        .map(registro => registro.eventos)
        .filter(evento => evento && !eventoCancelado(evento));

    eventos.sort((a, b) => {
        const fechaA = obtenerTimestamp(obtenerFechaInicio(a)) ?? Infinity;
        const fechaB = obtenerTimestamp(obtenerFechaInicio(b)) ?? Infinity;

        return fechaA - fechaB;
    });

    if (eventos.length === 0) {
        actualizarEstadoVisual(
            equipo?.activo === false ? 'mantenimiento' : 'disponible',
            equipo?.activo === false ? '● No disponible' : '● Disponible'
        );

        if (eventoActual) eventoActual.textContent = 'Sin evento asignado';
        if (fechasComprometidas) fechasComprometidas.textContent = '—';
        if (fechaLibre) fechaLibre.textContent = 'Disponible actualmente';

        const mensaje = document.createElement('div');
        mensaje.className = 'estado-carga';
        mensaje.textContent = 'Este equipo no tiene asignaciones vigentes.';

        listaEventos.appendChild(mensaje);
        return;
    }

    eventos.forEach(evento => {
        listaEventos.appendChild(crearTarjetaEvento(evento));
    });

    const ahora = Date.now();

    const compromisos = eventos
        .filter(eventoComprometido)
        .map(evento => ({
            evento,
            inicio: obtenerFechaInicio(evento),
            fin: obtenerFechaFin(evento),
            inicioTs: obtenerTimestamp(obtenerFechaInicio(evento)),
            finTs: obtenerTimestamp(obtenerFechaFin(evento))
        }))
        .filter(item => item.finTs === null || item.finTs >= ahora)
        .sort((a, b) =>
            (a.inicioTs ?? -Infinity) - (b.inicioTs ?? -Infinity)
        );

    if (equipo?.activo === false) {
        actualizarEstadoVisual('mantenimiento', '● No disponible');

        if (eventoActual) {
            eventoActual.textContent = 'Equipo marcado como inactivo';
        }

        if (fechasComprometidas) fechasComprometidas.textContent = '—';
        if (fechaLibre) fechaLibre.textContent = 'Consultar estado del equipo';

        return;
    }

    if (compromisos.length === 0) {
        actualizarEstadoVisual('disponible', '● Disponible');

        if (eventoActual) {
            eventoActual.textContent = eventos.some(
                evento => normalizarEstado(evento.estado) === 'cotizado'
            )
                ? 'Tiene cotizaciones pendientes'
                : 'Sin evento confirmado';
        }

        if (fechasComprometidas) fechasComprometidas.textContent = '—';
        if (fechaLibre) fechaLibre.textContent = 'Disponible actualmente';

        return;
    }

    const principal = compromisos[0];

    let finTimestamp = principal.finTs;
    let finCompromiso = principal.fin;
    let sinFechaFin = principal.finTs === null;

    for (const item of compromisos.slice(1)) {
        if (sinFechaFin) break;
        if (item.inicioTs === null) continue;

        if (finTimestamp !== null && item.inicioTs > finTimestamp) {
            break;
        }

        if (item.finTs === null) {
            sinFechaFin = true;
            finCompromiso = null;
            break;
        }

        if (finTimestamp === null || item.finTs > finTimestamp) {
            finTimestamp = item.finTs;
            finCompromiso = item.fin;
        }
    }

    actualizarEstadoVisual('comprometido', '● Comprometido');

    if (eventoActual) {
        eventoActual.textContent = obtenerNombreEvento(principal.evento);
    }

    if (fechasComprometidas) {
        fechasComprometidas.textContent =
            `${formatearFecha(principal.inicio)} — ${formatearFecha(finCompromiso)}`;
    }

    if (fechaLibre) {
        fechaLibre.textContent = sinFechaFin
            ? 'Fecha de finalización pendiente'
            : formatearFecha(finCompromiso);
    }
}

/* =========================================================
   MOSTRAR RESUMEN GENERAL DE ASIGNACIONES
========================================================= */

function mostrarResumenGeneral(asignaciones) {
    // Cambiar el título únicamente en la vista general.
    if (tituloCalendario) {
        tituloCalendario.textContent = 'Asignaciones de equipos';
    }

    if (listaEventos) listaEventos.replaceChildren();

    const vigentes = asignaciones.filter(({ eventos }) =>
        eventos && !eventoCancelado(eventos)
    );

    // Mostrar el total en el contenido, no como clave de equipo.
    if (equipoClave) equipoClave.textContent = '—';

    if (equipoNombre) {
        equipoNombre.textContent = `${vigentes.length} asignaciones vigentes`;
    }

    if (equipoCategoria) {
        equipoCategoria.textContent =
            'Selecciona una asignación para consultar la ficha del equipo';
    }

    // Campos que no corresponden a un equipo individual.
    if (equipoMarca) equipoMarca.textContent = '—';
    if (equipoModelo) equipoModelo.textContent = '—';
    if (equipoSerie) equipoSerie.textContent = '—';
    if (equipoCondicion) equipoCondicion.textContent = '—';

    // Ocultar el contador de la parte superior.
    if (estadoSuperior) {
        estadoSuperior.textContent = '';
        estadoSuperior.className = 'ficha-estado oculto';
    }

    // No hay un único estado para todos los equipos.
    if (equipoEstado) {
        equipoEstado.textContent = '—';
        equipoEstado.className = 'ficha-estado';
    }

    if (resumenEstado) {
        resumenEstado.textContent = '—';
        resumenEstado.className = 'ficha-estado';
    }

    if (eventoActual) eventoActual.textContent = '—';
    if (fechasComprometidas) fechasComprometidas.textContent = '—';
    if (fechaLibre) fechaLibre.textContent = '—';

    if (!vigentes.length) {
        if (listaEventos) {
            const mensaje = document.createElement('div');
            mensaje.className = 'estado-carga';
            mensaje.textContent = 'No hay asignaciones vigentes de equipos.';

            listaEventos.appendChild(mensaje);
        }

        return;
    }

    vigentes.sort((a, b) => {
        const fechaA = obtenerTimestamp(
            obtenerFechaInicio(a.eventos) || a.eventos.fecha_montaje
        ) ?? Infinity;

        const fechaB = obtenerTimestamp(
            obtenerFechaInicio(b.eventos) || b.eventos.fecha_montaje
        ) ?? Infinity;

        return fechaA - fechaB;
    });

    vigentes.forEach(({ equipos, eventos }) => {
        listaEventos?.appendChild(crearTarjetaEvento(eventos, equipos));
    });
}

/* =========================================================
   INICIAR
========================================================= */

async function iniciar() {
    limpiarError();

    try {
        if (equipoId) {
            // Ficha individual: mostrar el título de calendario.
            if (tituloCalendario) {
                tituloCalendario.textContent = 'Calendario de compromisos';
            }

            const equipo = await cargarEquipo(equipoId);
            mostrarEquipo(equipo);

            const asignaciones = await cargarEventosEquipo(equipo.id);
            mostrarDisponibilidad(asignaciones, equipo);

            console.log('Ficha individual cargada:', equipo);
        } else {
            // Vista general: mostrar el título de asignaciones.
            const asignaciones = await cargarTodasLasAsignaciones();
            mostrarResumenGeneral(asignaciones);

            console.log('Resumen general cargado.');
        }
    } catch (error) {
        mostrarError(error);
    }
}

iniciar();
