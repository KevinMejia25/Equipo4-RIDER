import { supabase } from './supabaseClient.js';
import { exigirRol } from './guardia.js';

// Pantalla del coordinador. Sin sesión va al login; un técnico es enviado
// a su propio diseño (móvil) y el resto de este archivo no corre.
await exigirRol('coordinador');

const elCargando = document.getElementById('estado-cargando');
const elError = document.getElementById('estado-error');
const elConDatos = document.getElementById('estado-con-datos');

// ── Cerrar sesión (mismo bloque que en eventos.js) ──
document.getElementById('btn-salir')?.addEventListener('click', async (evento) => {
  evento.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// Se usa la clase .oculto (display:none !important) y NO el atributo
// `hidden`: en ui.css varias clases traen display fijo y anulan `hidden`.
function mostrarSoloEstado(nombre) {
  elCargando.classList.toggle('oculto', nombre !== 'cargando');
  elError.classList.toggle('oculto', nombre !== 'error');
  elConDatos.classList.toggle('oculto', nombre !== 'con-datos');
}

function mostrarError(titulo, texto) {
  document.getElementById('error-titulo').textContent = titulo;
  document.getElementById('error-texto').textContent = texto;
  mostrarSoloEstado('error');
}

// Mismo mapeo de colores que en eventos.js (ui.css solo trae 4 etiquetas).
const ETIQUETA_POR_ESTADO = {
  cotizado:   { clase: 'etiqueta--pendiente',  texto: 'Cotizado' },
  confirmado: { clase: 'etiqueta--completado', texto: 'Confirmado' },
  en_montaje: { clase: 'etiqueta--proceso',    texto: 'En montaje' },
  cerrado:    { clase: 'etiqueta--proceso',    texto: 'Cerrado' },
  cancelado:  { clase: 'etiqueta--cancelado',  texto: 'Cancelado' },
};

// Botones que muestra el diseño de Figma en cada estado.
// Los que traen `accion` ya están conectados (ver ACCIONES_CONECTADAS más abajo:
// Confirmar es HU-08, Pasar a montaje es la tarea técnica, Cerrar es HU-12,
// Cancelar es HU-13). Un botón sin `accion` se dibuja deshabilitado hasta que
// le toque su historia.
// Los estados finales (cerrado, cancelado) no tienen acciones.
const ACCIONES_POR_ESTADO = {
  cotizado:   [{ texto: 'Cancelar evento', clase: 'btn--peligro', accion: 'cancelar' }, { texto: 'Confirmar evento', clase: '', accion: 'confirmar' }],
  confirmado: [{ texto: 'Cancelar evento', clase: 'btn--peligro', accion: 'cancelar' }, { texto: 'Pasar a montaje', clase: '', accion: 'montaje' }],
  en_montaje: [{ texto: 'Cerrar evento', clase: '', accion: 'cerrar' }],
  cerrado:    [],
  cancelado:  [],
};

// Regla de HU-06: la hoja de carga se edita mientras el evento no esté en montaje.
const ESTADOS_EDITABLES = ['cotizado', 'confirmado'];

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// Se arma con textContent (no innerHTML): estos textos los escribe una
// persona en un formulario y no deben interpretarse como HTML.
function celda(texto, clase) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  if (clase) td.className = clase;
  return td;
}

// ── Aviso con el resultado de una acción de estado ──
const elAviso = document.getElementById('aviso-accion');
const elAvisoLista = document.getElementById('aviso-accion-lista');

function limpiarAviso() {
  elAviso.className = 'aviso oculto';
  elAvisoLista.innerHTML = '';
}

// tipo: 'exito' | 'error'. `lineas` es una lista opcional de textos. Todo con
// textContent: los nombres de equipo y de evento los escribe una persona y no
// deben interpretarse como HTML.
function mostrarAviso(tipo, titulo, texto, lineas = []) {
  elAviso.className = `aviso aviso--${tipo} mb-5`;
  document.getElementById('aviso-accion-titulo').textContent = titulo;
  document.getElementById('aviso-accion-texto').textContent = texto;
  elAvisoLista.innerHTML = '';

  lineas.forEach((linea) => {
    const li = document.createElement('li');
    li.textContent = linea;
    elAvisoLista.appendChild(li);
  });
}

// Acciones de estado ya conectadas al servidor. Ninguna es un UPDATE desde el
// navegador: cada una llama a una función de Postgres que revisa las reglas y
// cambia el estado en la misma transacción. Lo que el navegador "sabía" al
// cargar la pantalla no cuenta; manda lo que responda el servidor.
//   · rpc:       función del servidor.
//   · enCurso:   texto del botón mientras espera.
//   · fallo:     título del aviso si no se pudo (red, rechazo sin detalle).
//   · exito:     (data) => { titulo, texto } cuando el servidor dice ok.
//   · rechazos:  código que devuelve el servidor => (data) => { titulo, texto, lineas }.
//   Un rechazo con `estado_invalido` recarga la pantalla (alguien más cambió el
//   estado mientras estaba abierta) y no necesita entrada aquí.
const ACCIONES_CONECTADAS = {
  // HU-08 · hu08_confirmar_evento.sql
  confirmar: {
    rpc: 'confirmar_evento',
    enCurso: 'Confirmando…',
    fallo: 'No se pudo confirmar el evento.',
    exito: (d) => ({
      titulo: 'Evento confirmado.',
      texto: d.piezas === 0
        ? 'Todavía no tiene equipo en su hoja de carga, así que por ahora no aparta ninguna pieza.'
        : `Sus ${d.piezas} pieza${d.piezas === 1 ? '' : 's'} quedan apartadas para estas fechas.`,
    }),
    rechazos: {
      traslape: (d) => ({
        titulo: 'No se puede confirmar: hay equipo comprometido en fechas que se cruzan.',
        texto: 'Quita estas piezas de la hoja de carga o cambia las fechas del evento:',
        lineas: (d.conflictos ?? []).map((c) => {
          const estado = ETIQUETA_POR_ESTADO[c.evento_estado]?.texto ?? c.evento_estado;
          return `${c.equipo_clave} · ${c.equipo_nombre} — ya está en «${c.evento_nombre}» ` +
                 `(${estado}), del ${formatearFecha(c.fecha_montaje)} al ${formatearFecha(c.fecha_fin)}`;
        }),
      }),
    },
  },

  // Tarea técnica · tarea_pasar_a_montaje.sql
  montaje: {
    rpc: 'pasar_a_montaje',
    enCurso: 'Pasando a montaje…',
    fallo: 'No se pudo pasar el evento a montaje.',
    exito: (d) => ({
      titulo: 'Evento en montaje.',
      texto: `${d.piezas} pieza${d.piezas === 1 ? '' : 's'} y ${d.tecnicos} técnico${d.tecnicos === 1 ? '' : 's'} asignados. La hoja de carga ya no se edita.`,
    }),
    rechazos: {
      faltan_asignaciones: (d) => ({
        titulo: 'No se puede pasar a montaje: faltan asignaciones.',
        texto: 'Un evento no pasa a montaje sin equipo y cuadrilla asignados. Falta:',
        lineas: (d.faltan ?? []).map((f) =>
          f === 'equipo' ? 'Equipo: arma la hoja de carga con el botón + de «Equipo asignado».'
                         : 'Cuadrilla: asigna al menos un técnico con el botón + de «Cuadrilla asignada».'),
      }),
    },
  },

  // HU-12 · hu12_cerrar_evento.sql
  cerrar: {
    rpc: 'cerrar_evento',
    enCurso: 'Cerrando…',
    fallo: 'No se pudo cerrar el evento.',
    exito: (d) => {
      const base = d.piezas === 1
        ? 'La única pieza de su hoja de carga tiene retorno registrado.'
        : `Las ${d.piezas} piezas de su hoja de carga tienen retorno registrado.`;
      const detalle = [];
      if (d.danadas > 0)   detalle.push(`${d.danadas} dañada${d.danadas === 1 ? '' : 's'}`);
      if (d.faltantes > 0) detalle.push(`${d.faltantes} faltante${d.faltantes === 1 ? '' : 's'}`);
      return {
        titulo: 'Evento cerrado.',
        texto: detalle.length > 0 ? `${base} Entre ellas: ${detalle.join(' y ')}.` : base,
      };
    },
    rechazos: {
      retornos_pendientes: (d) => ({
        titulo: 'No se puede cerrar: hay piezas sin retorno registrado.',
        texto: `Un evento no se cierra hasta que todo su equipo tenga retorno. Falta${(d.pendientes ?? []).length === 1 ? '' : 'n'}:`,
        lineas: (d.pendientes ?? []).map((p) => `${p.clave} · ${p.nombre}`),
      }),
    },
  },

  // HU-13 · hu13_cancelar_evento.sql
  // `pedirMotivo`: antes de llamar al servidor se abre un cuadro que exige el
  // motivo (el servidor lo vuelve a exigir). Si la persona lo cierra sin
  // confirmar, no se hace nada.
  cancelar: {
    rpc: 'cancelar_evento',
    pedirMotivo: true,
    enCurso: 'Cancelando…',
    fallo: 'No se pudo cancelar el evento.',
    exito: (d) => ({
      titulo: 'Evento cancelado.',
      texto: d.liberadas === 0
        ? 'No tenía equipo apartado, así que no se libera ninguna pieza.'
        : d.liberadas === 1
          ? 'Su pieza queda libre para otros eventos.'
          : `Sus ${d.liberadas} piezas quedan libres para otros eventos.`,
    }),
    rechazos: {
      motivo_requerido: () => ({
        titulo: 'Falta el motivo.',
        texto: 'Para cancelar un evento hay que escribir por qué se cancela.',
      }),
    },
  },
};

// Cuadro que pide el motivo de la cancelación. Devuelve el motivo (sin
// espacios en los extremos) o null si la persona lo cerró sin confirmar
// (Volver o la tecla Escape). Usa el <dialog> nativo de ui.css.
function pedirMotivo() {
  const dialogo    = document.getElementById('dialogo-cancelar');
  const campo      = document.getElementById('cancelar-motivo');
  const contenedor = document.getElementById('cancelar-campo');
  const error      = document.getElementById('cancelar-error');
  const confirmar  = document.getElementById('cancelar-confirmar');
  const volver     = document.getElementById('cancelar-volver');

  document.getElementById('cancelar-titulo').textContent =
    `¿Cancelar «${document.getElementById('evento-nombre').textContent}»?`;
  campo.value = '';
  contenedor.classList.remove('campo--error');
  error.classList.add('oculto');

  return new Promise((resolve) => {
    let motivo = null;

    const alEscribir = () => {
      contenedor.classList.remove('campo--error');
      error.classList.add('oculto');
    };
    const alConfirmar = () => {
      const texto = campo.value.trim();
      if (!texto) {            // sin motivo no se cierra el cuadro
        contenedor.classList.add('campo--error');
        error.classList.remove('oculto');
        campo.focus();
        return;
      }
      motivo = texto;
      dialogo.close();
    };
    const alVolver = () => dialogo.close();
    const alCerrar = () => {   // se cerró: confirmando, con Volver o con Escape
      campo.removeEventListener('input', alEscribir);
      confirmar.removeEventListener('click', alConfirmar);
      volver.removeEventListener('click', alVolver);
      dialogo.removeEventListener('close', alCerrar);
      resolve(motivo);
    };

    campo.addEventListener('input', alEscribir);
    confirmar.addEventListener('click', alConfirmar);
    volver.addEventListener('click', alVolver);
    dialogo.addEventListener('close', alCerrar);
    dialogo.showModal();
  });
}

async function ejecutarAccion(boton, eventoId, clave) {
  const accion = ACCIONES_CONECTADAS[clave];
  limpiarAviso();

  const argumentos = { p_evento_id: eventoId };
  if (accion.pedirMotivo) {
    const motivo = await pedirMotivo();
    if (motivo === null) return;   // cerró el cuadro sin confirmar: no se hace nada
    argumentos.p_motivo = motivo;
  }

  const textoOriginal = boton.textContent;
  const rehabilitar = () => { boton.disabled = false; boton.textContent = textoOriginal; };
  boton.disabled = true;
  boton.textContent = accion.enCurso;

  const { data, error } = await supabase.rpc(accion.rpc, argumentos);

  if (error) {
    console.error(`Error en ${accion.rpc}:`, error);
    mostrarAviso('error', accion.fallo, 'Revisa tu conexión e inténtalo de nuevo.');
    rehabilitar();
    return;
  }

  if (data.ok) {
    await cargarDetalle(); // redibuja el estado y los botones del nuevo estado
    const { titulo, texto } = accion.exito(data);
    mostrarAviso('exito', titulo, texto);
    return;
  }

  // El servidor lo rechazó.
  if (data.codigo === 'estado_invalido') {
    // Alguien más lo cambió mientras esta pantalla estaba abierta: se recarga
    // para mostrar el estado real.
    await cargarDetalle();
    mostrarAviso('error', accion.fallo, data.mensaje);
    return;
  }

  const rechazo = accion.rechazos[data.codigo];
  if (rechazo) {
    const { titulo, texto, lineas } = rechazo(data);
    mostrarAviso('error', titulo, texto, lineas);
  } else {
    mostrarAviso('error', accion.fallo, data.mensaje ?? 'Inténtalo de nuevo.');
  }
  rehabilitar();
}

function pintarAcciones(estado, eventoId) {
  const contenedor = document.getElementById('acciones-estado');
  contenedor.innerHTML = '';

  const acciones = ACCIONES_POR_ESTADO[estado];
  if (!acciones) return; // estado desconocido: no se dibuja nada

  if (acciones.length === 0) {
    const nota = document.createElement('span');
    nota.className = 'pequeno tenue';
    nota.textContent = 'Estado final — ya no admite cambios';
    contenedor.appendChild(nota);
    return;
  }

  acciones.forEach(({ texto, clase, accion }) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `btn ${clase}`.trim();
    boton.textContent = texto;

    if (ACCIONES_CONECTADAS[accion]) {
      boton.addEventListener('click', () => ejecutarAccion(boton, eventoId, accion));
    } else {
      boton.disabled = true; // todavía sin conectar (su historia es de otro sprint)
    }
    contenedor.appendChild(boton);
  });
}

function pintarEvento(evento) {
  document.getElementById('evento-nombre').textContent = evento.nombre;

  const info = ETIQUETA_POR_ESTADO[evento.estado] ?? { clase: '', texto: evento.estado };
  const etiqueta = document.getElementById('evento-estado');
  etiqueta.className = `etiqueta ${info.clase}`;
  etiqueta.textContent = info.texto;

  pintarAcciones(evento.estado, evento.id);

  document.getElementById('dato-cliente').textContent = evento.clientes?.nombre ?? '—';
  document.getElementById('dato-sede').textContent = evento.sede ?? '—';
  document.getElementById('dato-montaje').textContent = formatearFecha(evento.fecha_montaje);
  document.getElementById('dato-inicio').textContent = formatearFecha(evento.fecha_inicio);
  document.getElementById('dato-fin').textContent = formatearFecha(evento.fecha_fin);
  document.getElementById('dato-contacto').textContent = evento.clientes?.contacto || '—';

  if (evento.estado === 'cancelado') {
    document.getElementById('dato-motivo').textContent = evento.motivo_cancelacion || 'Sin motivo registrado';
    document.getElementById('aviso-cancelacion').classList.remove('oculto');
  }

  // Enlaces a las páginas de Emiliano; reciben el id del evento por la URL.
  const editable = ESTADOS_EDITABLES.includes(evento.estado);
  const id = encodeURIComponent(evento.id);

  const enlaceHoja = document.getElementById('enlace-hoja-carga');
  enlaceHoja.href = `hoja-de-carga.html?evento_id=${id}`;
  enlaceHoja.classList.toggle('oculto', !editable);

  const enlaceCuadrilla = document.getElementById('enlace-cuadrilla');
  enlaceCuadrilla.href = `asignar-cuadrilla.html?evento_id=${id}`;
  enlaceCuadrilla.classList.toggle('oculto', !editable);
}

function pintarEquipo(filas) {
  const body = document.getElementById('equipo-body');
  body.innerHTML = '';
  filas.forEach((fila) => {
    const tr = document.createElement('tr');
    tr.appendChild(celda(fila.equipos?.clave, 'mono'));
    tr.appendChild(celda(fila.equipos?.nombre));
    tr.appendChild(celda(fila.equipos?.categorias?.nombre));
    body.appendChild(tr);
  });
  document.getElementById('equipo-conteo').textContent =
    `${filas.length} pieza${filas.length === 1 ? '' : 's'}`;
  document.getElementById('equipo-vacio').classList.toggle('oculto', filas.length > 0);
  document.getElementById('equipo-tabla-contenedor').classList.toggle('oculto', filas.length === 0);
}

function pintarCuadrilla(filas) {
  const body = document.getElementById('cuadrilla-body');
  body.innerHTML = '';
  filas.forEach((fila) => {
    const tr = document.createElement('tr');
    tr.appendChild(celda(fila.usuarios?.nombre));
    tr.appendChild(celda(fila.funcion));
    body.appendChild(tr);
  });
  document.getElementById('cuadrilla-conteo').textContent =
    `${filas.length} técnico${filas.length === 1 ? '' : 's'}`;
  document.getElementById('cuadrilla-vacia').classList.toggle('oculto', filas.length > 0);
  document.getElementById('cuadrilla-tabla-contenedor').classList.toggle('oculto', filas.length === 0);
}

async function cargarDetalle() {
  const eventoId = new URLSearchParams(window.location.search).get('id');
  if (!eventoId) {
    mostrarError('Falta el evento', 'Abre esta página desde el listado de eventos.');
    return;
  }

  mostrarSoloEstado('cargando');
  limpiarAviso();

  // Las tres consultas son independientes: se piden al mismo tiempo.
  const [resEvento, resEquipo, resCuadrilla] = await Promise.all([
    supabase
      .from('eventos')
      .select('id, nombre, sede, fecha_montaje, fecha_inicio, fecha_fin, estado, motivo_cancelacion, clientes(nombre, contacto)')
      .eq('id', eventoId)
      .maybeSingle(),
    supabase
      .from('evento_equipo')
      .select('id, equipos(clave, nombre, categorias(nombre))')
      .eq('evento_id', eventoId),
    supabase
      .from('evento_personal')
      .select('id, funcion, usuarios(nombre)')
      .eq('evento_id', eventoId),
  ]);

  if (resEvento.error || resEquipo.error || resCuadrilla.error) {
    console.error('Error al cargar el detalle:', resEvento.error, resEquipo.error, resCuadrilla.error);
    mostrarError('No pudimos cargar el evento', 'Revisa tu conexión e inténtalo de nuevo.');
    return;
  }

  // Con RLS activo, sin sesión la consulta no falla: regresa vacío.
  if (!resEvento.data) {
    mostrarError('No encontramos este evento', 'Puede que no exista, o que no hayas iniciado sesión.');
    return;
  }

  pintarEvento(resEvento.data);
  pintarEquipo(resEquipo.data ?? []);
  pintarCuadrilla(resCuadrilla.data ?? []);
  mostrarSoloEstado('con-datos');
}

cargarDetalle();