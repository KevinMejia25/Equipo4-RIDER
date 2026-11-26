import { supabase } from './supabaseClient.js';

// =====================================================
// REFERENCIAS HTML
// =====================================================

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
let idsOcupados = new Set();

const ESTADOS_QUE_OCUPAN = [
    'confirmado',
    'en_montaje'
];

// =====================================================
// ESTILOS
// =====================================================

function instalarEstilos() {
    if (document.getElementById('estilos-acciones-cuadrilla')) return;

    const style = document.createElement('style');
    style.id = 'estilos-acciones-cuadrilla';

    style.textContent = `
        .acciones-tabla {
            display:flex;
            flex-direction:row;
            align-items:center;
            justify-content:center;
            gap:12px;
            white-space:nowrap;
        }

        .btn-tabla {
            display:inline-flex;
            align-items:center;
            justify-content:center;
            width:30px;
            height:30px;
            padding:4px;
            border:none;
            border-radius:6px;
            background:transparent;
            box-shadow:none;
            cursor:pointer;
            transition:.2s ease;
        }

        .btn-tabla svg {
            width:21px;
            height:21px;
            flex-shrink:0;
            pointer-events:none;
        }

        .btn-tabla-editar {
            background:transparent;
            color:#9baabd;
            border:none;
        }

        .btn-tabla-editar:hover {
            background:rgba(155,170,189,.12);
            color:#ffffff;
        }

        .btn-tabla-eliminar {
            background:transparent;
            color:#ff304d;
            border:none;
        }

        .btn-tabla-eliminar:hover {
            background:rgba(255,48,77,.12);
            color:#ff6075;
        }

        .btn-tabla:disabled {
            opacity:.4;
            cursor:not-allowed;
        }

        .btn-tabla:disabled:hover {
            background:transparent;
        }

        .btn-tabla:focus-visible {
            outline:2px solid currentColor;
            outline-offset:2px;
        }

        .modal-rider-overlay {
            position:fixed;
            inset:0;
            z-index:9999;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:18px;
            overflow-y:auto;
            background:rgba(3,8,15,.78);
            backdrop-filter:blur(7px);
            animation:modalRiderFade .18s ease;
        }

        .modal-rider {
            width:min(100%,520px);
            max-height:calc(100vh - 36px);
            overflow-y:auto;
            padding:26px;
            color:var(--color-texto,#f4f5f8);
            background:var(--color-tarjeta,#111923);
            border:1px solid var(--color-borde,#293545);
            border-radius:18px;
            box-shadow:0 24px 80px rgba(0,0,0,.5);
            animation:modalRiderUp .22s ease;
        }

        .modal-rider__encabezado {
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:15px;
            margin-bottom:22px;
        }

        .modal-rider__etiqueta {
            display:block;
            margin-bottom:7px;
            color:#aaa5ff;
            font-size:10px;
            font-weight:800;
            letter-spacing:1.5px;
        }

        .modal-rider h2 {
            margin:0 0 7px;
            font-size:23px;
        }

        .modal-rider__descripcion {
            margin:0;
            color:var(--color-texto-suave,#9aa6b5);
            font-size:13px;
            line-height:1.5;
        }

        .modal-rider__cerrar {
            width:36px;
            height:36px;
            flex-shrink:0;
            border:1px solid var(--color-borde,#293545);
            border-radius:9px;
            background:transparent;
            color:inherit;
            font-size:23px;
            cursor:pointer;
        }

        .modal-rider__campo {
            display:flex;
            flex-direction:column;
            gap:8px;
            margin-top:16px;
        }

        .modal-rider__campo label {
            font-size:13px;
            font-weight:700;
        }

        .modal-rider__campo input,
        .modal-rider__campo textarea {
            box-sizing:border-box;
            width:100%;
            padding:13px 14px;
            border:1px solid var(--color-borde,#293545);
            border-radius:10px;
            background:var(--color-fondo,#0b121a);
            color:var(--color-texto,#f4f5f8);
            font:inherit;
            outline:none;
        }

        .modal-rider__campo input:focus,
        .modal-rider__campo textarea:focus {
            border-color:#817aff;
            box-shadow:0 0 0 3px rgba(116,105,255,.15);
        }

        .modal-rider__campo input[type="checkbox"] {
            width:20px;
            height:20px;
            accent-color:#817aff;
            cursor:pointer;
        }

        .modal-rider__campo textarea {
            min-height:95px;
            resize:vertical;
        }

        .modal-rider__acciones {
            display:flex;
            gap:10px;
            margin-top:24px;
        }

        .modal-rider__acciones button {
            flex:1;
            min-height:45px;
        }

        .modal-rider__cancelar {
            border:1px solid var(--color-borde,#293545) !important;
            background:transparent !important;
            color:inherit !important;
        }

        .modal-rider__eliminar {
            background:#a92f43 !important;
            color:white !important;
            border-color:#a92f43 !important;
        }

        .modal-rider__error {
            min-height:18px;
            margin:12px 0 0;
            color:#ff929e;
            font-size:13px;
        }

        .modal-rider button:disabled {
            opacity:.55;
            cursor:wait;
        }

        .toast-rider {
            position:fixed;
            z-index:10001;
            top:20px;
            left:50%;
            width:max-content;
            max-width:calc(100% - 40px);
            padding:14px 18px;
            border:1px solid #28775d;
            border-radius:11px;
            background:#123329;
            color:#b7f4d9;
            font-size:13px;
            font-weight:650;
            text-align:center;
            box-shadow:0 12px 35px rgba(0,0,0,.3);
            opacity:0;
            transform:translate(-50%,-12px);
            transition:.2s ease;
        }

        .toast-rider.visible {
            opacity:1;
            transform:translate(-50%,0);
        }

        .toast-rider.error {
            border-color:#8d4050;
            background:#351c25;
            color:#ffc0c8;
        }

        @keyframes modalRiderFade {
            from { opacity:0; }
            to { opacity:1; }
        }

        @keyframes modalRiderUp {
            from { opacity:0; transform:translateY(14px); }
            to { opacity:1; transform:translateY(0); }
        }

        @media(max-width:480px) {
            .modal-rider {
                padding:20px;
            }

            .modal-rider__acciones {
                flex-direction:column-reverse;
            }

            .acciones-tabla {
                flex-direction:row;
                align-items:center;
                justify-content:center;
                gap:10px;
            }
        }
    `;

    document.head.appendChild(style);
}

instalarEstilos();

// =====================================================
// ESTADOS
// =====================================================

function mostrarSoloEstado(nombre) {
    const toggle = (elemento, mostrar) => {
        if (elemento) {
            elemento.classList.toggle('oculto', !mostrar);
        }
    };

    toggle(elCargando, nombre === 'cargando');
    toggle(elVacio, nombre === 'vacio');
    toggle(elError, nombre === 'error');
    toggle(elConDatos, nombre === 'con-datos');
}

// =====================================================
// NOTIFICACIONES
// =====================================================

function notificar(mensaje, error = false) {
    document.querySelector('.toast-rider')?.remove();

    const toast = document.createElement('div');

    toast.className = `toast-rider ${error ? 'error' : ''}`;
    toast.setAttribute('role', 'status');
    toast.textContent = mensaje;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// =====================================================
// MODAL
// =====================================================

function cerrarModal() {
    document.querySelector('.modal-rider-overlay')?.remove();
    document.removeEventListener('keydown', cerrarConEscape);
}

function cerrarConEscape(e) {
    if (e.key === 'Escape') cerrarModal();
}

function crearModal(titulo, descripcion, contenido) {
    cerrarModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-rider-overlay';

    const modal = document.createElement('section');
    modal.className = 'modal-rider';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const encabezado = document.createElement('div');
    encabezado.className = 'modal-rider__encabezado';

    const textos = document.createElement('div');

    const etiqueta = document.createElement('span');
    etiqueta.className = 'modal-rider__etiqueta';
    etiqueta.textContent = 'ADMINISTRACIÓN DE CUADRILLA';

    const h2 = document.createElement('h2');
    h2.textContent = titulo;

    const sub = document.createElement('p');
    sub.className = 'modal-rider__descripcion';
    sub.textContent = descripcion;

    textos.append(etiqueta, h2, sub);

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'modal-rider__cerrar';
    cerrar.textContent = '×';
    cerrar.setAttribute('aria-label', 'Cerrar');

    cerrar.addEventListener('click', cerrarModal);

    encabezado.append(textos, cerrar);

    modal.append(encabezado, contenido);
    overlay.appendChild(modal);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) cerrarModal();
    });

    document.addEventListener('keydown', cerrarConEscape);
    document.body.appendChild(overlay);

    return modal;
}

// =====================================================
// CREAR CAMPOS
// =====================================================

function crearCampo(formulario, etiqueta, id, tipo = 'text', valor = '') {
    const contenedor = document.createElement('div');
    contenedor.className = 'modal-rider__campo';

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = etiqueta;

    const input = tipo === 'textarea'
        ? document.createElement('textarea')
        : document.createElement('input');

    input.id = id;

    if (tipo !== 'textarea') {
        input.type = tipo;
    }

    input.value = valor ?? '';

    contenedor.append(label, input);
    formulario.appendChild(contenedor);

    return input;
}

// =====================================================
// BOTONES DEL MODAL
// =====================================================

function crearAcciones(formulario, textoGuardar, accionGuardar) {
    const error = document.createElement('p');
    error.className = 'modal-rider__error';
    error.setAttribute('aria-live', 'polite');

    const acciones = document.createElement('div');
    acciones.className = 'modal-rider__acciones';

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'btn modal-rider__cancelar';
    cancelar.textContent = 'Cancelar';
    cancelar.addEventListener('click', cerrarModal);

    const guardar = document.createElement('button');
    guardar.type = 'submit';
    guardar.className = 'btn';
    guardar.textContent = textoGuardar;

    acciones.append(cancelar, guardar);
    formulario.append(error, acciones);

    formulario.addEventListener('submit', async e => {
        e.preventDefault();

        error.textContent = '';
        guardar.disabled = true;
        cancelar.disabled = true;
        guardar.textContent = 'Guardando...';

        try {
            await accionGuardar(error);

        } catch (err) {
            console.error(err);
            error.textContent = err.message || 'Ocurrió un error.';

        } finally {
            if (document.body.contains(formulario)) {
                guardar.disabled = false;
                cancelar.disabled = false;
                guardar.textContent = textoGuardar;
            }
        }
    });
}

// =====================================================
// COLUMNA DE ACCIONES
// =====================================================

function prepararColumnaAcciones() {
    const fila = document.querySelector('#estado-con-datos thead tr');

    if (!fila) return;

    if (!fila.querySelector('[data-columna-acciones]')) {
        const th = document.createElement('th');

        th.textContent = 'Acciones';
        th.dataset.columnaAcciones = 'true';

        fila.appendChild(th);
    }
}

// =====================================================
// VALIDAR Y FORMATEAR TELÉFONO
// =====================================================

function formatearTelefono(valor) {
    const digitos = String(valor ?? '')
        .replace(/\D/g, '')
        .slice(0, 10);

    if (digitos.length <= 3) {
        return digitos;
    }

    if (digitos.length <= 6) {
        return `${digitos.slice(0, 3)}-${digitos.slice(3)}`;
    }

    return `${digitos.slice(0, 3)}-${digitos.slice(3, 6)}-${digitos.slice(6)}`;
}

function configurarTelefono(input) {
    input.type = 'tel';
    input.inputMode = 'numeric';
    input.autocomplete = 'tel';
    input.placeholder = '333-333-3333';
    input.maxLength = 12;

    input.value = formatearTelefono(input.value);

    input.addEventListener('input', () => {
        input.value = formatearTelefono(input.value);

        input.setSelectionRange(
            input.value.length,
            input.value.length
        );
    });
}

// =====================================================
// VALIDAR CORREO
// =====================================================

function validarCorreo(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

// =====================================================
// EDITAR TÉCNICO
// =====================================================

function abrirEditarTecnico(tecnico) {
    const formulario = document.createElement('form');

    crearModal(
        'Editar técnico',
        'Modifica la información del técnico y guarda los cambios.',
        formulario
    );

    const nombre = crearCampo(
        formulario,
        'Nombre *',
        'tecnico-nombre',
        'text',
        tecnico.nombre
    );

    const correo = crearCampo(
        formulario,
        'Correo electrónico *',
        'tecnico-correo',
        'email',
        tecnico.correo
    );

    const rol = crearCampo(
        formulario,
        'Rol',
        'tecnico-rol',
        'text',
        tecnico.rol
    );

    const telefono = crearCampo(
        formulario,
        'Teléfono',
        'tecnico-telefono',
        'tel',
        tecnico.telefono
    );

    const activo = crearCampo(
        formulario,
        'Técnico activo',
        'tecnico-activo',
        'checkbox'
    );

    nombre.required = true;
    nombre.maxLength = 150;

    correo.required = true;
    correo.maxLength = 254;

    rol.maxLength = 80;

    configurarTelefono(telefono);

    activo.checked = tecnico.activo === true;
    activo.style.alignSelf = 'flex-start';

    crearAcciones(formulario, 'Guardar cambios', async error => {

        const correoValor = correo.value.trim();

        const telefonoDigitos = telefono.value.replace(/\D/g, '');

        const datos = {
            nombre: nombre.value.trim(),
            correo: correoValor,
            rol: rol.value.trim() || null,
            telefono: telefonoDigitos
                ? formatearTelefono(telefonoDigitos)
                : null,
            activo: activo.checked
        };

        // Validar nombre
        if (!datos.nombre) {
            error.textContent = 'El nombre del técnico es obligatorio.';
            nombre.focus();
            return;
        }

        // Validar correo obligatorio
        if (!correoValor) {
            error.textContent = 'El correo electrónico es obligatorio.';
            correo.focus();
            return;
        }

        // Validar formato del correo
        if (!validarCorreo(correoValor)) {
            error.textContent = 'Ingresa un correo válido que incluya @ y un dominio.';
            correo.focus();
            return;
        }

        // Validar teléfono
        if (telefonoDigitos && telefonoDigitos.length !== 10) {
            error.textContent = 'El teléfono debe tener exactamente 10 dígitos.';
            telefono.focus();
            return;
        }

        const { data, error: errorDB } = await supabase
            .from('usuarios')
            .update(datos)
            .eq('id', tecnico.id)
            .select('id, nombre, correo, rol, telefono, activo')
            .single();

        if (errorDB) throw errorDB;

        tecnicosCache = tecnicosCache.map(t =>
            t.id === tecnico.id ? data : t
        );

        cerrarModal();
        aplicarBusqueda();

        notificar('Técnico actualizado correctamente.');
    });

    nombre.focus();
}

// =====================================================
// COMPROBAR DISPONIBILIDAD DEL TÉCNICO
// =====================================================

function eventoSigueOcupando(evento) {
    if (!evento) return true;

    if (!ESTADOS_QUE_OCUPAN.includes(evento.estado)) {
        return false;
    }

    if (!evento.fecha_fin) {
        return true;
    }

    const fechaFin = new Date(evento.fecha_fin).getTime();

    if (Number.isNaN(fechaFin)) {
        return true;
    }

    return fechaFin >= Date.now();
}

// =====================================================
// ELIMINAR TÉCNICO
// =====================================================

function abrirEliminarTecnico(tecnico) {
    const contenido = document.createElement('div');

    const aviso = document.createElement('p');
    aviso.className = 'modal-rider__descripcion';

    aviso.textContent =
        `¿Seguro que deseas eliminar a "${tecnico.nombre}"? Esta acción no se puede deshacer.`;

    contenido.appendChild(aviso);

    const formulario = document.createElement('form');
    formulario.style.marginTop = '22px';

    crearAcciones(formulario, 'Sí, eliminar técnico', async error => {

        // No eliminar técnicos ocupados
        if (idsOcupados.has(tecnico.id)) {
            error.textContent =
                'No se puede eliminar porque está asignado a un evento activo.';

            return;
        }

        // Revisar asignaciones históricas
        const {
            data: asignaciones,
            error: errorAsignaciones
        } = await supabase
            .from('evento_personal')
            .select('evento_id')
            .eq('usuario_id', tecnico.id);

        if (errorAsignaciones) throw errorAsignaciones;

        if (asignaciones?.length > 0) {
            error.textContent =
                'El técnico tiene asignaciones registradas. Puedes desactivarlo desde Editar para conservar su historial.';

            return;
        }

        // Eliminar técnico
        const { error: errorDB } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', tecnico.id)
            .select('id')
            .single();

        if (errorDB) throw errorDB;

        tecnicosCache = tecnicosCache.filter(t =>
            t.id !== tecnico.id
        );

        cerrarModal();
        aplicarBusqueda();

        notificar('Técnico eliminado correctamente.');
    });

    formulario
        .querySelector('button[type="submit"]')
        .classList.add('modal-rider__eliminar');

    contenido.appendChild(formulario);

    crearModal(
        'Eliminar técnico',
        'Confirma si deseas continuar.',
        contenido
    );
}

// =====================================================
// CREAR FILA
// =====================================================

function renderFila(tecnico) {
    const tr = document.createElement('tr');

    const ocupado = idsOcupados.has(tecnico.id);

    const estaActivo = tecnico.activo === true && !ocupado;

    const valores = [
        tecnico.nombre ?? '—',
        tecnico.correo ?? '—',
        tecnico.rol ?? '—',
        tecnico.telefono ?? '—'
    ];

    valores.forEach(valor => {
        const td = document.createElement('td');

        td.textContent = valor || '—';

        tr.appendChild(td);
    });

    // =================================================
    // ESTADO DEL TÉCNICO
    // =================================================

    const tdEstado = document.createElement('td');

    const etiquetaEstado = document.createElement('span');
    etiquetaEstado.className = 'etiqueta';

    etiquetaEstado.textContent =
        estaActivo ? 'Activo' : 'Inactivo';

    etiquetaEstado.classList.add(
        estaActivo
            ? 'etiqueta--completado'
            : 'etiqueta--cancelado'
    );

    if (ocupado) {
        etiquetaEstado.title =
            'Este técnico está asignado a un evento confirmado o en montaje.';

    } else if (tecnico.activo !== true) {
        etiquetaEstado.title =
            'La cuenta de este técnico está desactivada.';

    } else {
        etiquetaEstado.title =
            'Este técnico está disponible.';
    }

    tdEstado.appendChild(etiquetaEstado);
    tr.appendChild(tdEstado);

    // =================================================
    // ACCIONES
    // =================================================

    const tdAcciones = document.createElement('td');

    const acciones = document.createElement('div');
    acciones.className = 'acciones-tabla';

    // =================================================
    // BOTÓN EDITAR - ICONO DE LÁPIZ
    // =================================================

    const editar = document.createElement('button');

    editar.type = 'button';
    editar.className = 'btn-tabla btn-tabla-editar';
    editar.title = 'Editar técnico';

    editar.setAttribute('aria-label', 'Editar técnico');

    editar.innerHTML = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M12 20h9"></path>

            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5z"></path>
        </svg>
    `;

    editar.addEventListener('click', () => {
        abrirEditarTecnico(tecnico);
    });

    // =================================================
    // BOTÓN ELIMINAR - ICONO DE BASURA
    // =================================================

    const eliminar = document.createElement('button');

    eliminar.type = 'button';
    eliminar.className = 'btn-tabla btn-tabla-eliminar';
    eliminar.title = 'Eliminar técnico';

    eliminar.setAttribute('aria-label', 'Eliminar técnico');

    eliminar.innerHTML = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M3 6h18"></path>

            <path d="M19 6l-1 14H6L5 6"></path>

            <path d="M9 6V3h6v3"></path>

            <path d="M10 10v6"></path>

            <path d="M14 10v6"></path>
        </svg>
    `;

    // Bloquear eliminación si el técnico está ocupado

    eliminar.disabled = ocupado;

    if (ocupado) {
        eliminar.title =
            'No se puede eliminar un técnico asignado a un evento activo.';
    }

    eliminar.addEventListener('click', () => {
        abrirEliminarTecnico(tecnico);
    });

    acciones.append(editar, eliminar);

    tdAcciones.appendChild(acciones);
    tr.appendChild(tdAcciones);

    return tr;
}

// =====================================================
// MOSTRAR LISTA
// =====================================================

function renderLista(tecnicos) {
    tbody.replaceChildren();

    prepararColumnaAcciones();

    tecnicos.forEach(tecnico => {
        tbody.appendChild(renderFila(tecnico));
    });

    contador.textContent =
        `${tecnicos.length} resultado${tecnicos.length === 1 ? '' : 's'}`;

    mostrarSoloEstado(
        tecnicos.length === 0 ? 'vacio' : 'con-datos'
    );
}

// =====================================================
// BUSCADOR
// =====================================================

function aplicarBusqueda() {
    const termino = inputBuscar.value.trim().toLowerCase();

    if (!termino) {
        renderLista(tecnicosCache);
        return;
    }

    const filtrados = tecnicosCache.filter(tecnico => {

        const nombre = tecnico.nombre?.toLowerCase() ?? '';
        const rol = tecnico.rol?.toLowerCase() ?? '';
        const telefono = tecnico.telefono?.toLowerCase() ?? '';
        const correo = tecnico.correo?.toLowerCase() ?? '';

        const estado =
            tecnico.activo === true &&
            !idsOcupados.has(tecnico.id)
                ? 'activo'
                : 'inactivo';

        return (
            nombre.includes(termino) ||
            rol.includes(termino) ||
            telefono.includes(termino) ||
            correo.includes(termino) ||
            estado.includes(termino)
        );
    });

    renderLista(filtrados);
}

// =====================================================
// CARGAR TÉCNICOS Y DISPONIBILIDAD
// =====================================================

async function cargarTecnicos() {
    mostrarSoloEstado('cargando');

    try {
        const [
            resTecnicos,
            resAsignaciones,
            resEventos
        ] = await Promise.all([

            supabase
                .from('usuarios')
                .select('id, nombre, correo, rol, telefono, activo')
                .order('nombre', {
                    ascending: true
                }),

            supabase
                .from('evento_personal')
                .select('usuario_id, evento_id'),

            supabase
                .from('eventos')
                .select('id, estado, fecha_fin')
        ]);

        if (resTecnicos.error) {
            throw resTecnicos.error;
        }

        if (resAsignaciones.error) {
            throw resAsignaciones.error;
        }

        if (resEventos.error) {
            throw resEventos.error;
        }

        tecnicosCache = resTecnicos.data ?? [];

        const asignaciones = resAsignaciones.data ?? [];
        const eventos = resEventos.data ?? [];

        const eventosPorId = new Map(
            eventos.map(evento => [
                evento.id,
                evento
            ])
        );

        idsOcupados = new Set();

        asignaciones.forEach(asignacion => {

            const evento = eventosPorId.get(
                asignacion.evento_id
            );

            if (eventoSigueOcupando(evento)) {
                idsOcupados.add(asignacion.usuario_id);
            }
        });

        aplicarBusqueda();

    } catch (error) {
        console.error(
            'Error al cargar técnicos y disponibilidad:',
            error
        );

        mostrarSoloEstado('error');
    }
}

// =====================================================
// ACCIONES
// =====================================================

function irANuevoTecnico() {
    window.location.href = '/nuevo-tecnico.html';
}

inputBuscar.addEventListener('input', aplicarBusqueda);

btnNuevo?.addEventListener('click', irANuevoTecnico);

btnPrimerTecnico?.addEventListener('click', irANuevoTecnico);

btnReintentar?.addEventListener('click', cargarTecnicos);

// Actualizar disponibilidad al regresar a la página
window.addEventListener('focus', cargarTecnicos);

document.addEventListener('visibilitychange', () => {

    if (document.visibilityState === 'visible') {
        cargarTecnicos();
    }
});

// =====================================================
// INICIO
// =====================================================

cargarTecnicos();