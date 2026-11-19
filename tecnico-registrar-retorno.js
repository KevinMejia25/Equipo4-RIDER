import './pwa.js';

import { exigirRol, cerrarSesion } from './guardia.js';
import { cargarHoja } from './datos-tecnico.js';

import {
    guardarAccionOffline,
    sincronizarPendientes,
    obtenerCantidadPendiente
} from './sincronizacion-tecnico.js';

const perfil = await exigirRol('tecnico');
const $ = (id) => document.getElementById(id);

$('btn-salir')?.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
});

const parametros = new URLSearchParams(location.search);
const eventoId = parametros.get('evento_id') || parametros.get('id');
const asignacionId = parametros.get('asignacion_id');

let asignacionActual = null;

function instalarEstilos() {
    if ($('estilos-retorno-rider')) return;

    const style = document.createElement('style');
    style.id = 'estilos-retorno-rider';
    style.textContent = `
        .retorno-contenedor { width:min(calc(100% - 32px),620px); margin:0 auto; padding:28px 0 48px; }
        .retorno-contenedor > h1 { margin:12px 0 6px; font-size:clamp(25px,5vw,32px); }
        #formulario-retorno {
            margin-top:22px; padding:26px;
            border:1px solid var(--color-borde,#293545);
            border-radius:20px;
            background:var(--color-tarjeta,#111923);
            box-shadow:0 18px 50px rgba(0,0,0,.22);
        }
        .retorno-equipo {
            padding:16px; margin-bottom:22px;
            border:1px solid rgba(145,137,255,.22);
            border-radius:13px; background:rgba(116,105,255,.08);
        }
        .retorno-equipo__clave { color:#aaa5ff; font-size:11px; font-weight:800; letter-spacing:.8px; }
        .retorno-equipo__nombre { font-size:18px; font-weight:750; margin:6px 0; overflow-wrap:anywhere; }
        .retorno-equipo__salida { font-size:12px; color:var(--color-texto-suave,#9aa6b5); }
        .retorno-campo { margin-top:18px; }
        .retorno-campo label { display:block; margin-bottom:9px; font-size:13px; font-weight:700; }
        .retorno-campo select,.retorno-campo textarea {
            width:100%; box-sizing:border-box; padding:13px 14px;
            border:1px solid var(--color-borde,#293545); border-radius:11px;
            background:var(--color-fondo,#0b121a); color:var(--color-texto,#f4f5f8);
            font:inherit; outline:none;
        }
        .retorno-campo select:focus,.retorno-campo textarea:focus {
            border-color:#817aff; box-shadow:0 0 0 3px rgba(116,105,255,.15);
        }
        .retorno-campo textarea { min-height:115px; resize:vertical; }
        .retorno-ayuda { display:block; margin-top:8px; color:var(--color-texto-suave,#9aa6b5); font-size:11px; }
        .retorno-boton { width:100%; margin-top:20px; min-height:48px; }
        #aviso-sincronizacion { margin-top:15px; padding:12px 14px; border-radius:10px; background:rgba(116,105,255,.08); line-height:1.5; }
        .retorno-toast {
            position:fixed; z-index:10002; top:20px; left:50%;
            width:max-content; max-width:calc(100% - 40px); padding:14px 18px;
            border-radius:12px; background:#123329; border:1px solid #28775d;
            color:#b7f4d9; font-size:13px; font-weight:650; text-align:center;
            opacity:0; transform:translate(-50%,-12px); transition:.2s ease;
        }
        .retorno-toast.visible { opacity:1; transform:translate(-50%,0); }
        @media(max-width:480px) { #formulario-retorno { padding:19px; border-radius:16px; } }
    `;
    document.head.appendChild(style);
}

instalarEstilos();

function notificar(mensaje) {
    document.querySelector('.retorno-toast')?.remove();
    const aviso = document.createElement('div');
    aviso.className = 'retorno-toast';
    aviso.setAttribute('role', 'status');
    aviso.textContent = mensaje;
    document.body.appendChild(aviso);
    requestAnimationFrame(() => aviso.classList.add('visible'));
    setTimeout(() => {
        aviso.classList.remove('visible');
        setTimeout(() => aviso.remove(), 250);
    }, 4000);
}

function mostrarError(titulo, mensaje) {
    $('estado-cargando').classList.add('oculto');
    $('formulario-retorno').classList.add('oculto');
    $('estado-error').classList.remove('oculto');
    $('error-titulo').textContent = titulo;
    $('error-texto').textContent = mensaje;
}

function formatearFecha(fecha) {
    if (!fecha) return '—';
    const f = new Date(fecha);
    if (Number.isNaN(f.getTime())) return '—';
    return f.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function cargarAsignacion() {
    if (!eventoId || !asignacionId) {
        mostrarError('Faltan datos',
            'Abre esta pantalla desde el botón Registrar retorno de tu hoja de carga.');
        return;
    }

    const resultado = await cargarHoja(eventoId, perfil);

    if (resultado.noExiste) {
        mostrarError('Evento no disponible',
            'No hay una copia de esta hoja en el dispositivo. Conéctate para descargarla primero.');
        return;
    }

    const pieza = resultado.piezas.find((p) => p.id === asignacionId);

    if (!pieza) {
        mostrarError('Equipo no encontrado',
            'El equipo ya no aparece en la hoja de carga.');
        return;
    }

    if (resultado.evento?.estado !== 'en_montaje') {
        mostrarError('Retorno no disponible',
            'El retorno solo se puede registrar cuando el evento está en montaje.');
        return;
    }

    if (!pieza.salida_registrada) {
        mostrarError('Salida pendiente',
            'Primero debe registrarse la salida del equipo.');
        return;
    }

    if (pieza.retorno_registrado) {
        mostrarError('Retorno ya registrado',
            'Este equipo ya tiene un retorno registrado.');
        return;
    }

    asignacionActual = pieza;

    $('evento-nombre').textContent = resultado.evento?.nombre ?? 'Evento';
    $('equipo-clave').textContent = pieza.clave ?? 'Sin clave';
    $('equipo-nombre').textContent = pieza.nombre ?? 'Equipo';
    $('equipo-salida').textContent =
        `Salida registrada · ${formatearFecha(pieza.salida_registrada)}`;

    $('estado-cargando').classList.add('oculto');
    $('formulario-retorno').classList.remove('oculto');

    $('enlace-volver').href =
        `/tecnico-hoja-carga.html?evento_id=${encodeURIComponent(eventoId)}`;

    actualizarAviso();
}

function actualizarAviso() {
    $('aviso-sincronizacion').textContent = navigator.onLine
        ? 'El retorno se guardará y se enviará a Supabase. Si se pierde la conexión, quedará guardado en este dispositivo.'
        : 'Sin conexión: el retorno se guardará en este dispositivo y se enviará cuando vuelva internet.';
}

async function guardarRetorno(e) {
    e.preventDefault();

    const condicion = $('condicion-retorno').value;
    const nota = $('nota-retorno').value.trim();

    if (!condicion) {
        $('error-guardar').textContent = 'Selecciona la condición del equipo.';
        $('error-guardar').classList.remove('oculto');
        return;
    }

    const boton = $('btn-guardar');
    boton.disabled = true;
    boton.textContent = 'Guardando...';
    $('error-guardar').classList.add('oculto');

    try {
        await guardarAccionOffline({
            tipo: 'retorno',
            pieza: asignacionActual,
            eventoId,
            perfil,
            condicion_retorno: condicion,
            nota
        });

        if (navigator.onLine) await sincronizarPendientes();

        const pendientes = await obtenerCantidadPendiente();
        $('formulario-retorno').classList.add('oculto');

        notificar(navigator.onLine
            ? `Retorno guardado correctamente. Pendientes de enviar: ${pendientes}.`
            : `Retorno guardado en este dispositivo. Pendientes de enviar: ${pendientes}.`);

        const enlace = document.createElement('a');
        enlace.className = 'btn retorno-boton';
        enlace.href = `/tecnico-hoja-carga.html?evento_id=${encodeURIComponent(eventoId)}`;
        enlace.textContent = 'Volver a hoja de carga';
        $('aviso-sincronizacion').before(enlace);

    } catch (error) {
        console.error('Error guardando retorno:', error);
        $('error-guardar').textContent =
            `No se pudo guardar localmente: ${error.message}`;
        $('error-guardar').classList.remove('oculto');
        boton.disabled = false;
        boton.textContent = 'Intentar de nuevo';
    }
}

$('form-retorno').addEventListener('submit', guardarRetorno);

window.addEventListener('online', async () => {
    actualizarAviso();
    try {
        await sincronizarPendientes();
    } catch (error) {
        console.error('Error al sincronizar:', error);
    }
});

window.addEventListener('offline', actualizarAviso);

try {
    await sincronizarPendientes();
    await cargarAsignacion();
} catch (error) {
    console.error(error);
    mostrarError(
        'No pudimos iniciar la pantalla',
        'No fue posible recuperar los datos guardados. Intenta nuevamente.'
    );
}