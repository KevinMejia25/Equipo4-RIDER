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

const elCargando = $('estado-cargando');
const elError = $('estado-error');
const elVacio = $('estado-vacio');
const elLista = $('lista-piezas');
const elSubtitulo = $('subtitulo');
const elAvisoDatos = $('aviso-datos');
const elErrorTitulo = $('error-titulo');
const elErrorTexto = $('error-texto');

const barraPendientes = $('barra-pendientes');
const cantidadPendientes = $('cantidad-pendientes');
const btnEnviarPendientes = $('btn-enviar-pendientes');

let eventoIdActual = null;
let origenActual = 'red';

const FORMATO_DIA = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short'
});

const FORMATO_HORA = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

const TEXTO_CONDICION = {
    buen_estado: 'Buen estado',
    dañado: 'Dañado',
    faltante: 'Faltante'
};

$('btn-salir')?.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
});

/* Estilos incluidos aquí para que no tengas que modificar ui.css. */
function instalarEstilos() {
    if ($('estilos-modales-rider')) return;

    const style = document.createElement('style');
    style.id = 'estilos-modales-rider';
    style.textContent = `
        .rider-overlay {
            position:fixed; inset:0; z-index:10000;
            display:flex; align-items:center; justify-content:center;
            padding:20px; overflow-y:auto;
            background:rgba(3,8,15,.78); backdrop-filter:blur(7px);
            animation:riderFade .18s ease;
        }
        .rider-modal {
            width:min(100%,480px); max-height:calc(100vh - 40px);
            overflow-y:auto; padding:26px;
            color:var(--color-texto,#f4f5f8);
            background:var(--color-tarjeta,#111923);
            border:1px solid var(--color-borde,#293545);
            border-radius:20px;
            box-shadow:0 24px 80px rgba(0,0,0,.5);
            animation:riderUp .22s ease;
        }
        .rider-modal__top {
            display:flex; justify-content:space-between;
            align-items:flex-start; gap:14px; margin-bottom:20px;
        }
        .rider-modal__eyebrow {
            display:block; color:#aaa5ff; font-size:10px;
            font-weight:800; letter-spacing:1.5px; margin-bottom:7px;
        }
        .rider-modal h2 { margin:0 0 6px; font-size:23px; line-height:1.2; }
        .rider-modal__sub { margin:0; color:var(--color-texto-suave,#9aa6b5); font-size:13px; }
        .rider-modal__close {
            flex:0 0 36px; width:36px; height:36px;
            border:1px solid var(--color-borde,#293545);
            border-radius:10px; background:transparent;
            color:inherit; font-size:23px; cursor:pointer;
        }
        .rider-modal__equipment {
            display:flex; flex-direction:column; gap:5px;
            padding:15px; margin-bottom:20px;
            background:rgba(116,105,255,.09);
            border:1px solid rgba(145,137,255,.22); border-radius:13px;
        }
        .rider-modal__equipment span {
            color:var(--color-texto-suave,#9aa6b5);
            font-size:10px; font-weight:700; letter-spacing:1px;
            text-transform:uppercase;
        }
        .rider-modal__equipment strong { font-size:16px; overflow-wrap:anywhere; }
        .rider-modal__equipment small { color:#aaa5ff; font-weight:700; }
        .rider-modal__field { display:flex; flex-direction:column; gap:8px; margin-top:16px; }
        .rider-modal__field label { font-size:13px; font-weight:700; }
        .rider-modal__field select, .rider-modal__field textarea {
            box-sizing:border-box; width:100%; padding:13px 14px;
            border:1px solid var(--color-borde,#293545); border-radius:11px;
            background:var(--color-fondo,#0b121a); color:var(--color-texto,#f4f5f8);
            font:inherit; outline:none;
        }
        .rider-modal__field select:focus, .rider-modal__field textarea:focus {
            border-color:#817aff; box-shadow:0 0 0 3px rgba(116,105,255,.16);
        }
        .rider-modal__field textarea { min-height:105px; resize:vertical; }
        .rider-modal__hint { color:var(--color-texto-suave,#9aa6b5); font-size:11px; }
        .rider-modal__message { min-height:18px; margin:12px 0 0; color:#ff9ca8; font-size:13px; }
        .rider-modal__actions { display:flex; gap:10px; margin-top:14px; }
        .rider-modal__actions button { flex:1; min-height:46px; }
        .rider-modal__actions button:disabled { opacity:.6; cursor:wait; }
        .rider-btn-secondary {
            border:1px solid var(--color-borde,#293545) !important;
            background:transparent !important; color:inherit !important;
        }
        .rider-toast {
            position:fixed; z-index:10002; top:20px; left:50%;
            width:max-content; max-width:calc(100% - 40px);
            padding:14px 18px; border-radius:12px;
            background:#123329; border:1px solid #28775d; color:#b7f4d9;
            font-size:13px; font-weight:650; text-align:center;
            box-shadow:0 12px 35px rgba(0,0,0,.3);
            opacity:0; transform:translate(-50%,-12px);
            transition:opacity .2s ease,transform .2s ease;
        }
        .rider-toast.is-visible { opacity:1; transform:translate(-50%,0); }
        .rider-toast--error { background:#351c25; border-color:#8d4050; color:#ffc0c8; }
        @keyframes riderFade { from{opacity:0} to{opacity:1} }
        @keyframes riderUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @media(max-width:480px) {
            .rider-modal { padding:20px; border-radius:16px; }
            .rider-modal__actions { flex-direction:column-reverse; }
        }
    `;
    document.head.appendChild(style);
}

instalarEstilos();

function notificar(mensaje, tipo = 'success') {
    document.querySelector('.rider-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = `rider-toast ${tipo === 'error' ? 'rider-toast--error' : ''}`;
    toast.setAttribute('role', 'status');
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    window.setTimeout(() => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 250);
    }, 3500);
}

function mostrarConfirmacion(titulo, descripcion, textoConfirmar = 'Confirmar') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'rider-overlay';
        overlay.innerHTML = `
            <section class="rider-modal" role="dialog" aria-modal="true">
                <div class="rider-modal__top">
                    <div>
                        <span class="rider-modal__eyebrow">CONFIRMACIÓN</span>
                        <h2></h2><p class="rider-modal__sub"></p>
                    </div>
                    <button class="rider-modal__close" type="button" aria-label="Cerrar">×</button>
                </div>
                <div class="rider-modal__actions">
                    <button type="button" class="btn rider-btn-secondary" data-no>Cancelar</button>
                    <button type="button" class="btn" data-yes></button>
                </div>
            </section>`;
        overlay.querySelector('h2').textContent = titulo;
        overlay.querySelector('.rider-modal__sub').textContent = descripcion;
        overlay.querySelector('[data-yes]').textContent = textoConfirmar;

        const cerrar = (valor) => {
            overlay.remove();
            document.removeEventListener('keydown', tecla);
            resolve(valor);
        };
        const tecla = (e) => {
            if (e.key === 'Escape') cerrar(false);
        };

        overlay.querySelector('[data-no]').addEventListener('click', () => cerrar(false));
        overlay.querySelector('[data-yes]').addEventListener('click', () => cerrar(true));
        overlay.querySelector('.rider-modal__close').addEventListener('click', () => cerrar(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cerrar(false);
        });
        document.addEventListener('keydown', tecla);
        document.body.appendChild(overlay);
        overlay.querySelector('[data-yes]').focus();
    });
}

function formatoFecha(iso) {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return `${FORMATO_DIA.format(fecha)} · ${FORMATO_HORA.format(fecha)}`;
}

function mostrarSoloEstado(nombre) {
    elCargando.classList.toggle('oculto', nombre !== 'cargando');
    elError.classList.toggle('oculto', nombre !== 'error');
    elVacio.classList.toggle('oculto', nombre !== 'vacio');
    elLista.classList.toggle('oculto', nombre !== 'con-datos');
}

function mostrarError(titulo, mensaje) {
    elErrorTitulo.textContent = titulo;
    elErrorTexto.textContent = mensaje;
    elSubtitulo.textContent = '';
    mostrarSoloEstado('error');
}

function crearTexto(etiqueta, contenido, clase = '', estilo = '') {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = contenido ?? '';
    if (clase) elemento.className = clase;
    if (estilo) elemento.style.cssText = estilo;
    return elemento;
}

function crearBoton(texto, clase, accion) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = clase;
    boton.textContent = texto;
    boton.addEventListener('click', accion);
    return boton;
}

// Motivo del último rechazo del servidor, para que el contador no quede
// "atorado" sin explicación.
let motivoRechazo = null;

async function sincronizar() {
    const resultado = await sincronizarPendientes();
    motivoRechazo = resultado.errores?.[0]?.mensaje || null;
    return resultado;
}

async function actualizarBarraPendientes() {
    const cantidad = await obtenerCantidadPendiente();

    if (cantidadPendientes) {
        cantidadPendientes.textContent = cantidad === 1
            ? '1 cambio pendiente de enviar'
            : `${cantidad} cambios pendientes de enviar`;

        if (cantidad > 0 && motivoRechazo) {
            cantidadPendientes.textContent += ` · No se pudo enviar: ${motivoRechazo}`;
        }
    }

    if (barraPendientes) {
        barraPendientes.classList.toggle('oculto', cantidad === 0);
    }

    if (btnEnviarPendientes) {
        btnEnviarPendientes.disabled = !navigator.onLine || cantidad === 0;
        btnEnviarPendientes.textContent = navigator.onLine ? 'Enviar' : 'Sin conexión';
    }
}

async function enviarCambiosPendientes() {
    if (!navigator.onLine) {
        notificar('No tienes conexión. Los cambios siguen guardados en este dispositivo.', 'error');
        return;
    }

    btnEnviarPendientes.disabled = true;
    btnEnviarPendientes.textContent = 'Enviando...';

    try {
        const resultado = await sincronizar();
        await actualizarBarraPendientes();
        await cargar();

        if (resultado.pendientes === 0) {
            notificar('Todos los cambios se sincronizaron correctamente.');
        } else if (resultado.errores?.length) {
            notificar(`Se enviaron ${resultado.enviados}. Quedan ${resultado.pendientes}: ${resultado.errores[0].mensaje}`, 'error');
        } else {
            notificar(`Se enviaron ${resultado.enviados} cambios. Quedan ${resultado.pendientes} pendientes.`);
        }
    } catch (error) {
        console.error('Error al sincronizar:', error);
        notificar('No se pudieron sincronizar los cambios. Se conservaron en el dispositivo.', 'error');
        await actualizarBarraPendientes();
    }
}

btnEnviarPendientes?.addEventListener('click', enviarCambiosPendientes);

function crearTarjeta(pieza) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta';

    tarjeta.append(
        crearTexto('p', pieza.clave || 'SIN CLAVE', 'tenue mb-0',
            'font-size:var(--t-xs);font-weight:700;text-transform:uppercase'),
        crearTexto('p', pieza.nombre || 'Equipo', 'mb-0',
            'font-weight:700;margin-top:var(--e-1);overflow-wrap:anywhere')
    );

    if (pieza.categoria) {
        tarjeta.append(crearTexto('p', pieza.categoria, 'pequeno tenue mb-0',
            'margin-top:var(--e-1)'));
    }

    const filaEstado = document.createElement('div');
    filaEstado.style.marginTop = 'var(--e-3)';

    if (pieza.pendiente_envio) {
        filaEstado.append(crearTexto('span', 'Cambio pendiente de enviar',
            'etiqueta etiqueta--pendiente'));
    }

    if (pieza.retorno_registrado) {
        const condicion = TEXTO_CONDICION[pieza.condicion_retorno] || 'Sin condición';
        filaEstado.append(crearTexto('span', `Retorno registrado · ${condicion}`,
            'etiqueta etiqueta--completado'));
        tarjeta.append(filaEstado);
        tarjeta.append(
            crearTexto('p', `Salida: ${formatoFecha(pieza.salida_registrada)}`, 'pieza-fecha'),
            crearTexto('p', `Retorno: ${formatoFecha(pieza.retorno_registrado)}`, 'pieza-fecha')
        );
        if (pieza.nota) tarjeta.append(crearTexto('p', `Nota: ${pieza.nota}`, 'pieza-fecha'));
    } else if (pieza.salida_registrada) {
        filaEstado.append(crearTexto('span', 'Salida registrada', 'etiqueta etiqueta--completado'));
        tarjeta.append(filaEstado);
        tarjeta.append(crearTexto('p',
            `Fecha y hora de salida: ${formatoFecha(pieza.salida_registrada)}`,
            'pieza-fecha'));

        const botonRetorno = crearBoton('Registrar retorno', 'btn',
            () => mostrarFormularioRetorno(pieza));
        const acciones = document.createElement('div');
        acciones.className = 'pieza-acciones';
        acciones.append(botonRetorno);
        tarjeta.append(acciones);
    } else {
        filaEstado.append(crearTexto('span', 'Salida pendiente', 'etiqueta etiqueta--pendiente'));
        tarjeta.append(filaEstado);

        const botonSalida = crearBoton('Marcar salida', 'btn',
            () => marcarSalida(pieza, tarjeta));
        const acciones = document.createElement('div');
        acciones.className = 'pieza-acciones';
        acciones.append(botonSalida);
        tarjeta.append(acciones);
    }

    const item = document.createElement('li');
    item.append(tarjeta);
    return item;
}

async function marcarSalida(pieza, tarjeta) {
    const confirmado = await mostrarConfirmacion(
        '¿Registrar salida?',
        `Confirma que ${pieza.nombre || 'este equipo'} sale para el evento.`,
        'Sí, registrar salida'
    );
    if (!confirmado) return;

    const boton = tarjeta.querySelector('button');
    if (boton) {
        boton.disabled = true;
        boton.textContent = 'Guardando...';
    }

    try {
        await guardarAccionOffline({
            tipo: 'salida',
            pieza,
            eventoId: eventoIdActual,
            perfil
        });

        if (navigator.onLine) await sincronizar();

        notificar(navigator.onLine
            ? 'Salida guardada correctamente.'
            : 'Salida guardada en este dispositivo. Se enviará cuando vuelva la conexión.');

        await cargar();
    } catch (error) {
        console.error('Error guardando salida:', error);
        notificar(`No se pudo guardar la salida: ${error.message}`, 'error');

        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Marcar salida';
        }
    }
}

function mostrarFormularioRetorno(pieza) {
    if (document.querySelector('.rider-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'rider-overlay';
    overlay.innerHTML = `
        <section class="rider-modal" role="dialog" aria-modal="true"
                 aria-labelledby="rider-retorno-title">
            <div class="rider-modal__top">
                <div>
                    <span class="rider-modal__eyebrow">CONTROL DE EQUIPO</span>
                    <h2 id="rider-retorno-title">Registrar retorno</h2>
                    <p class="rider-modal__sub">Indica las condiciones en las que regresa el equipo.</p>
                </div>
                <button type="button" class="rider-modal__close" aria-label="Cerrar">×</button>
            </div>
            <div class="rider-modal__equipment">
                <span>Equipo asignado</span>
                <strong class="rider-equipo-nombre"></strong>
                <small class="rider-equipo-clave"></small>
            </div>
            <div class="rider-modal__field">
                <label for="rider-condicion">Condición del equipo *</label>
                <select id="rider-condicion" required>
                    <option value="">Selecciona una condición</option>
                    <option value="buen_estado">Buen estado</option>
                    <option value="dañado">Dañado</option>
                    <option value="faltante">Faltante</option>
                </select>
            </div>
            <div class="rider-modal__field">
                <label for="rider-nota">Observaciones (opcional)</label>
                <textarea id="rider-nota" maxlength="500"
                    placeholder="Describe daños, piezas faltantes u otra observación..."></textarea>
                <small class="rider-modal__hint">Máximo 500 caracteres.</small>
            </div>
            <p class="rider-modal__message" aria-live="polite"></p>
            <div class="rider-modal__actions">
                <button type="button" class="btn rider-btn-secondary" data-cancelar>Cancelar</button>
                <button type="button" class="btn" data-guardar>Guardar retorno</button>
            </div>
        </section>`;

    overlay.querySelector('.rider-equipo-nombre').textContent = pieza.nombre || 'Equipo';
    overlay.querySelector('.rider-equipo-clave').textContent = pieza.clave || 'Sin clave';

    const select = overlay.querySelector('#rider-condicion');
    const nota = overlay.querySelector('#rider-nota');
    const mensaje = overlay.querySelector('.rider-modal__message');
    const botonGuardar = overlay.querySelector('[data-guardar]');

    const cerrar = () => {
        overlay.remove();
        document.removeEventListener('keydown', tecla);
    };
    const tecla = (e) => {
        if (e.key === 'Escape') cerrar();
    };

    overlay.querySelector('.rider-modal__close').addEventListener('click', cerrar);
    overlay.querySelector('[data-cancelar]').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrar();
    });
    document.addEventListener('keydown', tecla);

    botonGuardar.addEventListener('click', async () => {
        if (!select.value) {
            mensaje.textContent = 'Selecciona la condición del equipo para continuar.';
            select.focus();
            return;
        }

        botonGuardar.disabled = true;
        botonGuardar.textContent = 'Guardando...';
        mensaje.textContent = '';

        try {
            await guardarAccionOffline({
                tipo: 'retorno',
                pieza,
                eventoId: eventoIdActual,
                perfil,
                condicion_retorno: select.value,
                nota: nota.value.trim()
            });

            if (navigator.onLine) await sincronizar();

            cerrar();
            notificar(navigator.onLine
                ? 'Retorno guardado correctamente.'
                : 'Retorno guardado en este dispositivo. Se enviará cuando vuelva la conexión.');

            await cargar();
        } catch (error) {
            console.error('Error guardando retorno:', error);
            mensaje.textContent = `No se pudo guardar: ${error.message}`;
            botonGuardar.disabled = false;
            botonGuardar.textContent = 'Intentar de nuevo';
        }
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => select.focus());
}

async function cargar() {
    const parametros = new URLSearchParams(window.location.search);
    eventoIdActual = parametros.get('evento_id') || parametros.get('id');

    if (!eventoIdActual) {
        mostrarError('Falta el evento',
            'Abre la hoja de carga desde la lista de Mis eventos.');
        await actualizarBarraPendientes();
        return;
    }

    mostrarSoloEstado('cargando');

    try {
        const resultado = await cargarHoja(eventoIdActual, perfil);

        if (resultado.noExiste) {
            mostrarError('No encontramos este evento',
                resultado.origen === 'local'
                    ? 'Esta hoja no está guardada en este dispositivo. Conéctate para descargarla.'
                    : 'Puede que el evento ya no esté asignado a ti.');
            await actualizarBarraPendientes();
            return;
        }

        origenActual = resultado.origen;
        elSubtitulo.textContent =
            `${resultado.evento.nombre} · ${formatoFecha(resultado.evento.fecha_montaje)}`;

        if (origenActual === 'local') {
            elAvisoDatos.textContent =
                'Sin conexión: estás viendo la hoja guardada en este dispositivo. Puedes registrar salidas y retornos; se enviarán al recuperar internet.';
            elAvisoDatos.classList.remove('oculto');
        } else {
            elAvisoDatos.classList.add('oculto');
        }

        if (!resultado.piezas || resultado.piezas.length === 0) {
            mostrarSoloEstado('vacio');
            await actualizarBarraPendientes();
            return;
        }

        elLista.replaceChildren(...resultado.piezas.map(crearTarjeta));
        mostrarSoloEstado('con-datos');
        await actualizarBarraPendientes();

    } catch (error) {
        console.error('Error al cargar hoja:', error);
        mostrarError('No pudimos cargar la hoja de carga',
            'Revisa tu conexión e inténtalo de nuevo.');
        await actualizarBarraPendientes();
    }
}

async function alVolverInternet() {
    try {
        await sincronizar();
        await cargar();
    } catch (error) {
        console.error('Error al sincronizar al recuperar conexión:', error);
        await actualizarBarraPendientes();
    }
}

window.addEventListener('online', alVolverInternet);
window.addEventListener('offline', () => actualizarBarraPendientes());

try {
    await sincronizar();
} catch (error) {
    console.error('No se pudieron sincronizar los cambios pendientes:', error);
}
await cargar();