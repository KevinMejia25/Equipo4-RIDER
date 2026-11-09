
import { supabase } from './supabaseClient.js';
import { exigirRol, cerrarSesion } from './guardia.js';

const perfil = await exigirRol('tecnico');

document.getElementById('btn-salir')?.addEventListener('click', (e) => {
  e.preventDefault();
  cerrarSesion();
});

const $ = (id) => document.getElementById(id);

const eventoId = new URLSearchParams(location.search).get('evento_id');
const asignacionId = new URLSearchParams(location.search).get('asignacion_id');

const dbNombre = 'RIDER_RETORNOS_PENDIENTES';
const dbVersion = 1;
let asignacionActual = null;
let eventoActual = null;

function abrirBaseLocal() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(dbNombre, dbVersion);

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;

      if (!db.objectStoreNames.contains('retornos')) {
        db.createObjectStore('retornos', { keyPath: 'asignacion_id' });
      }
    };

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function guardarPendienteLocal(retorno) {
  const db = await abrirBaseLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('retornos', 'readwrite');
    tx.objectStore('retornos').put(retorno);

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function eliminarPendienteLocal(id) {
  const db = await abrirBaseLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('retornos', 'readwrite');
    tx.objectStore('retornos').delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function obtenerPendienteLocal(id) {
  const db = await abrirBaseLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('retornos', 'readonly');
    const solicitud = tx.objectStore('retornos').get(id);

    solicitud.onsuccess = () => {
      const resultado = solicitud.result ?? null;
      db.close();
      resolve(resultado);
    };

    solicitud.onerror = () => {
      db.close();
      reject(solicitud.error);
    };
  });
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

  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function cargarAsignacion() {
  if (!eventoId || !asignacionId) {
    mostrarError(
      'Faltan datos',
      'Abre esta pantalla desde el botón Registrar retorno de tu hoja de carga.'
    );
    return;
  }

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
      eventos (
        id,
        nombre,
        estado
      ),
      equipos (
        clave,
        nombre
      )
    `)
    .eq('id', asignacionId)
    .eq('evento_id', eventoId)
    .maybeSingle();

  if (error) {
    console.error(error);
    mostrarError('No pudimos cargar el equipo', 'Revisa tu conexión e inténtalo de nuevo.');
    return;
  }

  if (!data) {
    mostrarError('Equipo no encontrado', 'El equipo ya no pertenece a este evento.');
    return;
  }

  asignacionActual = data;
  eventoActual = data.eventos;

  if (eventoActual?.estado !== 'en_montaje') {
    mostrarError(
      'Retorno no disponible',
      'El retorno solo se puede registrar cuando el evento está en montaje.'
    );
    return;
  }

  if (!data.salida_registrada) {
    mostrarError(
      'Salida pendiente',
      'Primero debe registrarse la salida del equipo.'
    );
    return;
  }

  if (data.retorno_registrado) {
    mostrarError(
      'Retorno ya registrado',
      'Este equipo ya tiene un retorno registrado.'
    );
    return;
  }

  $('evento-nombre').textContent = data.eventos?.nombre ?? 'Evento';
  $('equipo-clave').textContent = data.equipos?.clave ?? 'Sin clave';
  $('equipo-nombre').textContent = data.equipos?.nombre ?? 'Equipo';
  $('equipo-salida').textContent =
    `Salida registrada · ${formatearFecha(data.salida_registrada)}`;

  $('estado-cargando').classList.add('oculto');
  $('formulario-retorno').classList.remove('oculto');

  $('enlace-volver').href =
    `/tecnico-hoja-carga.html?evento_id=${encodeURIComponent(eventoId)}`;
}

async function sincronizarRetorno(retorno) {
  const { data, error } = await supabase
    .from('evento_equipo')
    .update({
      retorno_registrado: retorno.retorno_registrado,
      condicion_retorno: retorno.condicion_retorno,
      nota: retorno.nota,
      pendiente_envio: false
    })
    .eq('id', retorno.asignacion_id)
    .eq('evento_id', retorno.evento_id)
    .is('retorno_registrado', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('El retorno ya fue registrado o el equipo cambió de estado.');
  }

  return true;
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
  boton.textContent = 'Guardando…';
  $('error-guardar').classList.add('oculto');

  const retorno = {
    asignacion_id: asignacionActual.id,
    evento_id: eventoId,
    retorno_registrado: new Date().toISOString(),
    condicion_retorno: condicion,
    nota,
    pendiente_envio: true,
    usuario_id: perfil.id ?? null,
    guardado_local: new Date().toISOString()
  };

  try {
    if (navigator.onLine) {
      await sincronizarRetorno(retorno);
      await eliminarPendienteLocal(asignacionActual.id);
      mostrarExito('Retorno registrado correctamente.');
      return;
    }

    await guardarPendienteLocal(retorno);
    mostrarExito('Retorno guardado en este dispositivo. Se enviará cuando haya conexión.');
  } catch (error) {
    console.error('Error guardando retorno:', error);

    try {
      await guardarPendienteLocal(retorno);
      mostrarExito('Retorno guardado localmente. Quedó pendiente de sincronización.');
    } catch (errorLocal) {
      console.error(errorLocal);
      $('error-guardar').textContent =
        'No se pudo guardar el retorno. Inténtalo nuevamente.';
      $('error-guardar').classList.remove('oculto');
      boton.disabled = false;
      boton.textContent = 'Guardar retorno';
    }
  }
}

function mostrarExito(mensaje) {
  $('formulario-retorno').classList.add('oculto');

  const aviso = document.createElement('div');
  aviso.className = 'aviso aviso--exito';
  aviso.textContent = mensaje;

  $('formulario-retorno').after(aviso);

  const enlace = document.createElement('a');
  enlace.className = 'btn retorno-boton';
  enlace.href = `/tecnico-hoja-carga.html?evento_id=${encodeURIComponent(eventoId)}`;
  enlace.textContent = 'Volver a hoja de carga';

  aviso.after(enlace);
}

async function sincronizarPendientes() {
  if (!navigator.onLine) return;

  const db = await abrirBaseLocal();

  const pendientes = await new Promise((resolve, reject) => {
    const tx = db.transaction('retornos', 'readonly');
    const solicitud = tx.objectStore('retornos').getAll();

    solicitud.onsuccess = () => resolve(solicitud.result ?? []);
    solicitud.onerror = () => reject(solicitud.error);
  });

  db.close();

  for (const retorno of pendientes) {
    try {
      await sincronizarRetorno(retorno);
      await eliminarPendienteLocal(retorno.asignacion_id);
    } catch (error) {
      console.error('No se pudo sincronizar el retorno:', error);
    }
  }
}

$('form-retorno').addEventListener('submit', guardarRetorno);

window.addEventListener('online', sincronizarPendientes);

try {
  await sincronizarPendientes();
  await cargarAsignacion();
} catch (error) {
  console.error(error);
  mostrarError('No pudimos iniciar la pantalla', 'Revisa tu conexión e inténtalo de nuevo.');
}
