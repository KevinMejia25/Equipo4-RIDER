import { supabase } from './supabaseClient.js';
import * as bd from './bd-local.js';

// ═══════════════════════════════════════════════════════════════
// Datos del técnico: RED PRIMERO, COPIA LOCAL DE RESPALDO.
//
//   · Con conexión: se pide a Supabase, se guarda la copia local y se usa
//     lo recién descargado.
//   · Sin conexión (o si Supabase falla): se usa la última copia local.


// Si la copia guardada es de otra persona, se borra.
async function asegurarCopiaDe(perfil) {
  const dueno = await bd.leerMeta('dueno');
  if (dueno && dueno !== perfil.auth_user_id) await bd.borrarTodo();
}

// Una pieza de la hoja de carga, ya "aplanada" para guardarla y mostrarla.
function aplanarPieza(fila) {
  return {
    id: fila.id,
    evento_id: fila.evento_id,
    clave: fila.equipos?.clave ?? '—',
    nombre: fila.equipos?.nombre ?? '—',
    categoria: fila.equipos?.categorias?.nombre ?? '',
    salida_registrada: fila.salida_registrada,
    retorno_registrado: fila.retorno_registrado,
    condicion_retorno: fila.condicion_retorno,
    pendiente_envio: fila.pendiente_envio,
  };
}

const COLUMNAS_EVENTO = 'id, nombre, sede, estado, fecha_montaje, fecha_inicio, fecha_fin';
const COLUMNAS_PIEZA =
  'id, evento_id, salida_registrada, retorno_registrado, condicion_retorno, pendiente_envio, ' +
  'equipos(clave, nombre, categorias(nombre))';

function ordenarPorClave(piezas) {
  return piezas.sort((a, b) => a.clave.localeCompare(b.clave, 'es'));
}

// ── Lista de eventos ──────────────────────────────────────────────

// Baja de la red TODOS los eventos del técnico y la hoja de carga de cada uno,
// para que todo quede disponible sin conexión de una sola vez.
async function descargarTodo() {
  const { data: eventos, error } = await supabase
    .from('eventos')
    .select(COLUMNAS_EVENTO)
    .order('fecha_montaje', { ascending: true });
  if (error) throw error;

  const hojas = new Map(eventos.map((e) => [e.id, { evento_id: e.id, piezas: [] }]));

  if (eventos.length > 0) {
    const { data: filas, error: errorPiezas } = await supabase
      .from('evento_equipo')
      .select(COLUMNAS_PIEZA)
      .in('evento_id', eventos.map((e) => e.id));
    if (errorPiezas) throw errorPiezas;
    filas.forEach((f) => hojas.get(f.evento_id)?.piezas.push(aplanarPieza(f)));
  }
  hojas.forEach((h) => ordenarPorClave(h.piezas));

  return { eventos, hojas: [...hojas.values()] };
}

// → { eventos, origen: 'red' | 'local', descargadaEn, sinCopia }
//   sinCopia = true: no hay red y tampoco hay nada guardado todavía.
export async function cargarMisEventos(perfil) {
  await asegurarCopiaDe(perfil);

  if (navigator.onLine) {
    try {
      const { eventos, hojas } = await descargarTodo();
      await bd.guardarCopiaCompleta({ dueno: perfil.auth_user_id, eventos, hojas });
      return { eventos, origen: 'red', descargadaEn: new Date().toISOString(), sinCopia: false };
    } catch (error) {
      // Con la red caída a medias, o un error del servidor, se cae a la copia.
      console.warn('No se pudo actualizar desde la red; se usa la copia local:', error);
    }
  }

  const [eventos, descargadaEn] = await Promise.all([bd.leerEventos(), bd.leerMeta('descargada_en')]);
  eventos.sort((a, b) => (a.fecha_montaje ?? '').localeCompare(b.fecha_montaje ?? ''));
  return { eventos, origen: 'local', descargadaEn, sinCopia: descargadaEn === null };
}

// ── Hoja de carga de un evento ────────────────────────────────────

async function descargarHoja(eventoId) {
  const [{ data: evento, error }, { data: filas, error: errorPiezas }] = await Promise.all([
    supabase.from('eventos').select(COLUMNAS_EVENTO).eq('id', eventoId).maybeSingle(),
    supabase.from('evento_equipo').select(COLUMNAS_PIEZA).eq('evento_id', eventoId),
  ]);
  if (error) throw error;
  if (errorPiezas) throw errorPiezas;
  const hoja = { evento_id: eventoId, piezas: ordenarPorClave((filas ?? []).map(aplanarPieza)) };
  return { evento, hoja };
}

// → { evento, piezas, origen, noExiste }
//   noExiste = true: el evento no está ni en la red ni en la copia local.
export async function cargarHoja(eventoId, perfil) {
  await asegurarCopiaDe(perfil);

  if (navigator.onLine) {
    try {
      const { evento, hoja } = await descargarHoja(eventoId);
      if (evento) {
        await bd.guardarEventoConHoja({ dueno: perfil.auth_user_id, evento, hoja });
        return { evento, piezas: hoja.piezas, origen: 'red', noExiste: false };
      }
      // La red contestó bien pero el evento no existe (o ya no es de este técnico).
      return { evento: null, piezas: [], origen: 'red', noExiste: true };
    } catch (error) {
      console.warn('No se pudo actualizar la hoja desde la red; se usa la copia local:', error);
    }
  }

  const [evento, hoja] = await Promise.all([bd.leerEvento(eventoId), bd.leerHoja(eventoId)]);
  return {
    evento: evento ?? null,
    piezas: hoja?.piezas ?? [],
    origen: 'local',
    noExiste: !evento,
  };
}