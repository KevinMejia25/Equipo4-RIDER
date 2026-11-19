
import { supabase } from './supabaseClient.js';
import * as bd from './bd-local.js';

function mismoInstante(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

// Recupera retornos que se guardaron con la versión anterior.
async function migrarRetornosAnteriores() {
  let dbAntigua;

  try {
    dbAntigua = await new Promise((resolve, reject) => {
      const solicitud = indexedDB.open('RIDER_RETORNOS_PENDIENTES');

      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
    });

    if (!dbAntigua.objectStoreNames.contains('retornos')) {
      dbAntigua.close();
      return;
    }

    const anteriores = await new Promise((resolve, reject) => {
      const tx = dbAntigua.transaction('retornos', 'readonly');
      const solicitud = tx.objectStore('retornos').getAll();

      solicitud.onsuccess = () => resolve(solicitud.result || []);
      solicitud.onerror = () => reject(solicitud.error);
    });

    for (const retorno of anteriores) {
      if (
        !retorno.asignacion_id ||
        !retorno.evento_id ||
        !retorno.retorno_registrado
      ) {
        continue;
      }

      await bd.guardarPendiente({
        id: `retorno:${retorno.asignacion_id}`,
        tipo: 'retorno',
        asignacion_id: retorno.asignacion_id,
        evento_id: retorno.evento_id,
        usuario_id: retorno.usuario_id ?? null,
        fecha: retorno.retorno_registrado,
        condicion_retorno: retorno.condicion_retorno ?? null,
        nota: retorno.nota ?? null,
        creado_en: retorno.guardado_local || retorno.retorno_registrado
      });

      await new Promise((resolve, reject) => {
        const tx = dbAntigua.transaction('retornos', 'readwrite');

        tx.objectStore('retornos').delete(retorno.asignacion_id);

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
  } catch (error) {
    console.warn('No se pudieron migrar los retornos anteriores:', error);
  } finally {
    dbAntigua?.close();
  }
}

async function yaEstaAplicada(pendiente) {
  const columnas = pendiente.tipo === 'salida'
    ? 'salida_registrada'
    : 'retorno_registrado, condicion_retorno, nota';

  const { data, error } = await supabase
    .from('evento_equipo')
    .select(columnas)
    .eq('id', pendiente.asignacion_id)
    .eq('evento_id', pendiente.evento_id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  if (pendiente.tipo === 'salida') {
    return mismoInstante(
      data.salida_registrada,
      pendiente.fecha
    );
  }

  return mismoInstante(
    data.retorno_registrado,
    pendiente.fecha
  )
    && data.condicion_retorno === pendiente.condicion_retorno
    && (data.nota || '') === (pendiente.nota || '');
}

async function enviarPendiente(pendiente) {
  const cambios = pendiente.tipo === 'salida'
    ? {
        salida_registrada: pendiente.fecha,
        pendiente_envio: false
      }
    : {
        retorno_registrado: pendiente.fecha,
        condicion_retorno: pendiente.condicion_retorno,
        nota: pendiente.nota || null,
        pendiente_envio: false
      };

  let consulta = supabase
    .from('evento_equipo')
    .update(cambios)
    .eq('id', pendiente.asignacion_id)
    .eq('evento_id', pendiente.evento_id);

  if (pendiente.tipo === 'salida') {
    consulta = consulta.is('salida_registrada', null);
  } else {
    consulta = consulta
      .not('salida_registrada', 'is', null)
      .is('retorno_registrado', null);
  }

  const { data, error } = await consulta
    .select('id')
    .maybeSingle();

  if (error) throw error;

  if (data) return true;

  // Si el servidor ya guardó exactamente esta acción, no se repite.
  if (await yaEstaAplicada(pendiente)) return true;

  throw new Error(
    'El registro cambió en el servidor. El cambio local se conserva para revisión.'
  );
}

// Guarda una salida o retorno en IndexedDB.
export async function guardarAccionOffline({
  tipo,
  pieza,
  eventoId,
  perfil,
  condicion_retorno = null,
  nota = null
}) {
  if (!['salida', 'retorno'].includes(tipo)) {
    throw new Error('Tipo de acción no válido.');
  }

  const fecha = new Date().toISOString();

  const pendiente = {
    id: `${tipo}:${pieza.id}`,
    tipo,
    asignacion_id: pieza.id,
    evento_id: eventoId,
    usuario_id: perfil?.id ?? null,
    fecha,
    condicion_retorno,
    nota,
    creado_en: fecha
  };

  await bd.guardarPendiente(pendiente);

  return pendiente;
}

// Envía todos los cambios pendientes a Supabase.
export async function sincronizarPendientes() {
  await migrarRetornosAnteriores();

  if (!navigator.onLine) {
    return {
      enviados: 0,
      pendientes: await bd.contarPendientes()
    };
  }

  const pendientes = await bd.leerPendientes();
  let enviados = 0;

  for (const pendiente of pendientes) {
    try {
      await enviarPendiente(pendiente);
      await bd.marcarPendienteSincronizado(pendiente);
      await bd.eliminarPendiente(pendiente.id);
      enviados++;
    } catch (error) {
      console.warn(
        `No se pudo sincronizar ${pendiente.id}:`,
        error
      );
    }
  }

  return {
    enviados,
    pendientes: await bd.contarPendientes()
  };
}

export async function obtenerCantidadPendiente() {
  return bd.contarPendientes();
}
