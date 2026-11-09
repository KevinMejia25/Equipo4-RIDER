
import { exigirRol, cerrarSesion } from './guardia.js';
import { cargarHoja } from './datos-tecnico.js';
import { supabase } from './supabaseClient.js';

// ============================================================
// PERFIL Y ELEMENTOS
// ============================================================

const perfil = await exigirRol('tecnico');

document.getElementById('btn-salir')?.addEventListener('click', (evento) => {
    evento.preventDefault();
    cerrarSesion();
});

const elCargando = document.getElementById('estado-cargando');
const elError = document.getElementById('estado-error');
const elVacio = document.getElementById('estado-vacio');
const elLista = document.getElementById('lista-piezas');
const elSubtitulo = document.getElementById('subtitulo');
const elAvisoDatos = document.getElementById('aviso-datos');
const elErrorTitulo = document.getElementById('error-titulo');
const elErrorTexto = document.getElementById('error-texto');

let eventoActualId = null;
let piezasActuales = [];
let origenActual = 'red';

// ============================================================
// FECHAS
// ============================================================

const FORMATO_DIA = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
});

const FORMATO_HORA = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

function formatearFecha(iso) {
    if (!iso) return '';

    const fecha = new Date(iso);

    if (Number.isNaN(fecha.getTime())) return '';

    return `${FORMATO_DIA.format(fecha)} · ${FORMATO_HORA.format(fecha)}`;
}

function dia(iso) {
    if (!iso) return '';

    const fecha = new Date(iso);

    if (Number.isNaN(fecha.getTime())) return '';

    return FORMATO_DIA.format(fecha);
}

// ============================================================
// ESTADOS DE PANTALLA
// ============================================================

function mostrarSoloEstado(nombre) {
    elCargando.classList.toggle('oculto', nombre !== 'cargando');
    elError.classList.toggle('oculto', nombre !== 'error');
    elVacio.classList.toggle('oculto', nombre !== 'vacio');
    elLista.classList.toggle('oculto', nombre !== 'con-datos');
}

function mostrarError(titulo, textoError) {
    elErrorTitulo.textContent = titulo;
    elErrorTexto.textContent = textoError;
    elSubtitulo.textContent = '';
    mostrarSoloEstado('error');
}

// ============================================================
// CONDICIONES Y ESTADOS
// ============================================================

const TEXTO_CONDICION = {
    buen_estado: 'buen estado',
    'dañado': 'dañado',
    faltante: 'faltante'
};

function texto(etiqueta, contenido, clase = '', estilo = '') {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = contenido ?? '';

    if (clase) elemento.className = clase;
    if (estilo) elemento.style.cssText = estilo;

    return elemento;
}

function estadoDePieza(pieza) {
    if (pieza.retorno_registrado) {
        const condicion =
            TEXTO_CONDICION[pieza.condicion_retorno] ?? 'sin condición';

        return {
            clase: pieza.condicion_retorno === 'buen_estado'
                ? 'etiqueta--completado'
                : 'etiqueta--cancelado',
            texto: `Retorno · ${condicion}`
        };
    }

    if (pieza.salida_registrada) {
        return {
            clase: 'etiqueta--completado',
            texto: `Salida · ${formatearFecha(pieza.salida_registrada)}`
        };
    }

    return {
        clase: 'etiqueta--pendiente',
        texto: 'Salida pendiente'
    };
}

// ============================================================
// MARCAR SALIDA
// ============================================================

async function marcarSalida(pieza, boton, fechaElemento, mensajeElemento) {
    if (!navigator.onLine) {
        mensajeElemento.textContent =
            'Necesitas conexión a internet para registrar la salida.';
        mensajeElemento.className = 'mensaje-salida error';
        return;
    }

    if (pieza.salida_registrada) return;

    boton.disabled = true;
    boton.textContent = 'Registrando...';
    mensajeElemento.textContent = '';

    // La hora se obtiene al momento de pulsar el botón.
    const fechaSalida = new Date().toISOString();

    const { data, error } = await supabase
        .from('evento_equipo')
        .update({
            salida_registrada: fechaSalida,
            pendiente_envio: false
        })
        .eq('id', pieza.id)
        .is('salida_registrada', null)
        .select('id, salida_registrada')
        .maybeSingle();

    if (error) {
        console.error('Error registrando salida:', error);

        boton.disabled = false;
        boton.textContent = 'Marcar salida';

        mensajeElemento.textContent =
            'No se pudo registrar la salida. Inténtalo nuevamente.';
        mensajeElemento.className = 'mensaje-salida error';
        return;
    }

    if (!data) {
        // Otra sesión pudo haber registrado la salida antes.
        mensajeElemento.textContent =
            'La salida ya fue registrada. Actualiza la hoja para verla.';
        mensajeElemento.className = 'mensaje-salida error';
        boton.disabled = true;
        boton.textContent = 'Salida registrada';
        return;
    }

    pieza.salida_registrada = data.salida_registrada;
    pieza.pendiente_envio = false;

    fechaElemento.textContent =
        `Salida: ${formatearFecha(data.salida_registrada)}`;

    fechaElemento.className = 'salida-fecha';
    fechaElemento.classList.remove('oculto');

    boton.textContent = 'Salida registrada';
    boton.disabled = true;

    mensajeElemento.textContent = '✓ Salida registrada correctamente.';
    mensajeElemento.className = 'mensaje-salida exito';

    // Actualiza la copia local consultada por datos-tecnico.js
    // La próxima descarga de la hoja conservará la fecha registrada.
}

// ============================================================
// TARJETA DE EQUIPO
// ============================================================

function crearTarjeta(pieza) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta';

    const estado = estadoDePieza(pieza);

    tarjeta.append(
        texto(
            'p',
            pieza.clave,
            'tenue mb-0',
            'font-size:var(--t-xs);font-weight:700;letter-spacing:.02em;text-transform:uppercase'
        ),
        texto(
            'p',
            pieza.nombre,
            'mb-0',
            'font-weight:700;margin-top:var(--e-1);overflow-wrap:anywhere'
        )
    );

    if (pieza.categoria) {
        tarjeta.append(
            texto('p', pieza.categoria, 'pequeno tenue mb-0', 'margin-top:var(--e-1)')
        );
    }

    const filaEstado = document.createElement('div');
    filaEstado.style.marginTop = 'var(--e-3)';

    filaEstado.append(
        texto('span', estado.texto, `etiqueta ${estado.clase}`.trim())
    );

    tarjeta.append(filaEstado);

    // No se muestra fecha ni botón si la salida ya está registrada.
    // Si todavía está pendiente, se permite marcarla únicamente en línea.
    if (!pieza.salida_registrada && !pieza.retorno_registrado) {
        const acciones = document.createElement('div');
        acciones.className = 'pieza-acciones';

        const fechaElemento = texto(
            'span',
            '',
            'salida-fecha oculto'
        );

        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn btn--pequeno btn-marcar-salida';
        boton.textContent = 'Marcar salida';
        boton.disabled = !navigator.onLine;

        const mensaje = texto('p', '', 'mensaje-salida');

        if (!navigator.onLine) {
            mensaje.textContent =
                'Conéctate a internet para registrar la salida.';
            mensaje.classList.add('error');
        }

        boton.addEventListener('click', () => {
            marcarSalida(pieza, boton, fechaElemento, mensaje);
        });

        acciones.append(fechaElemento, boton, mensaje);
        tarjeta.append(acciones);
    }

    const item = document.createElement('li');
    item.append(tarjeta);

    return item;
}

// ============================================================
// CARGAR HOJA
// ============================================================

async function cargar() {
    const parametros = new URLSearchParams(window.location.search);
    const eventoId = parametros.get('evento_id');

    if (!eventoId) {
        mostrarError(
            'Falta el evento',
            'Abre la hoja de carga desde la lista de Mis eventos.'
        );
        return;
    }

    eventoActualId = eventoId;
    mostrarSoloEstado('cargando');

    let resultado;

    try {
        resultado = await cargarHoja(eventoId, perfil);
    } catch (error) {
        console.error('Error al cargar la hoja de carga:', error);

        mostrarError(
            'No pudimos cargar la hoja de carga',
            'Revisa tu conexión e inténtalo de nuevo.'
        );
        return;
    }

    if (resultado.noExiste) {
        resultado.origen === 'local'
            ? mostrarError(
                'Esta hoja no está guardada',
                'Conéctate a internet para descargarla.'
            )
            : mostrarError(
                'No encontramos este evento',
                'Puede que ya no esté asignado a ti.'
            );

        return;
    }

    origenActual = resultado.origen;
    piezasActuales = resultado.piezas ?? [];

    elSubtitulo.textContent =
        `${resultado.evento.nombre} · ${dia(resultado.evento.fecha_montaje)}`;

    if (resultado.origen === 'local') {
        elAvisoDatos.textContent =
            'Mostrando la hoja guardada en este dispositivo. Conéctate para registrar salidas.';
        elAvisoDatos.classList.remove('oculto');
    } else {
        elAvisoDatos.classList.add('oculto');
    }

    if (piezasActuales.length === 0) {
        mostrarSoloEstado('vacio');
        return;
    }

    elLista.replaceChildren(
        ...piezasActuales.map(crearTarjeta)
    );

    mostrarSoloEstado('con-datos');
}

// ============================================================
// CONEXIÓN
// ============================================================

window.addEventListener('online', () => {
    if (eventoActualId) cargar();
});

window.addEventListener('offline', () => {
    if (eventoActualId) cargar();
});

// ============================================================
// INICIAR
// ============================================================

cargar();
