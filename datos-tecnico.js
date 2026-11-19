
import { supabase } from './supabaseClient.js';
import * as bd from './bd-local.js';

async function asegurarCopiaDe(perfil) {
  const dueno = await bd.leerMeta('dueno');

  if (dueno && dueno !== perfil.auth_user_id) {
    await bd.borrarTodo();
  }
}

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
    nota: fila.nota ?? null,
    pendiente_envio: fila.pendiente_envio
  };
}

const COLUMNAS_EVENTO =
  'id, nombre, sede, estado, fecha_montaje, fecha_inicio, fecha_fin';

const COLUMNAS_PIEZA =
  'id, evento_id, salida_registrada, retorno_registrado, condicion_retorno, nota, pendiente_envio, ' +
  'equipos(clave, nombre, categorias(nombre))';

function ordenarPorClave(piezas) {
  return piezas.sort((a, b) =>
    (a.clave || '').localeCompare(b.clave || '', 'es')
  );
}

async function descargarTodo() {
  const { data: eventos, error } = await supabase
    .from('eventos')
    .select(COLUMNAS_EVENTO)
    .order('fecha_montaje', { ascending: true });

  if (error) throw error;

  const hojas = new Map(
    eventos.map((evento) => [
      evento.id,
      { evento_id: evento.id, piezas: [] }
    ])
  );

  if (eventos.length > 0) {
    const { data: filas, error: errorPiezas } = await supabase
      .from('evento_equipo')
      .select(COLUMNAS_PIEZA)
      .in('evento_id', eventos.map((evento) => evento.id));

    if (errorPiezas) throw errorPiezas;

    filas.forEach((fila) => {
      hojas.get(fila.evento_id)?.piezas.push(aplanarPieza(fila));
    });
  }

  hojas.forEach((hoja) => ordenarPorClave(hoja.piezas));

  return {
    eventos,
    hojas: [...hojas.values()]
  };
}

export async function cargarMisEventos(perfil) {
  await asegurarCopiaDe(perfil);

  if (navigator.onLine) {
    try {
      const { eventos, hojas } = await descargarTodo();

      await bd.guardarCopiaCompleta({
        dueno: perfil.auth_user_id,
        eventos,
        hojas
      });

      return {
        eventos,
        origen: 'red',
        descargadaEn: new Date().toISOString(),
        sinCopia: false
      };
    } catch (error) {
      console.warn(
        'No se pudo actualizar desde la red; se usará la copia local:',
        error
      );
    }
  }

  const [eventos, descargadaEn] = await Promise.all([
    bd.leerEventos(),
    bd.leerMeta('descargada_en')
  ]);

  eventos.sort((a, b) =>
    (a.fecha_montaje ?? '').localeCompare(b.fecha_montaje ?? '')
  );

  return {
    eventos,
    origen: 'local',
    descargadaEn,
    sinCopia: descargadaEn === null
  };
}

async function descargarHoja(eventoId) {
  const [
    { data: evento, error },
    { data: filas, error: errorPiezas }
  ] = await Promise.all([
    supabase
      .from('eventos')
      .select(COLUMNAS_EVENTO)
      .eq('id', eventoId)
      .maybeSingle(),

    supabase
      .from('evento_equipo')
      .select(COLUMNAS_PIEZA)
      .eq('evento_id', eventoId)
  ]);

  if (error) throw error;
  if (errorPiezas) throw errorPiezas;

  const hoja = {
    evento_id: eventoId,
    piezas: ordenarPorClave((filas ?? []).map(aplanarPieza))
  };

  return { evento, hoja };
}

export async function cargarHoja(eventoId, perfil) {
  await asegurarCopiaDe(perfil);

  if (navigator.onLine) {
    try {
      const { evento, hoja } = await descargarHoja(eventoId);

      if (evento) {
        await bd.guardarEventoConHoja({
          dueno: perfil.auth_user_id,
          evento,
          hoja
        });

        const piezas = await bd.aplicarPendientes(
          eventoId,
          hoja.piezas
        );

        return {
          evento,
          piezas,
          origen: 'red',
          noExiste: false
        };
      }

      return {
        evento: null,
        piezas: [],
        origen: 'red',
        noExiste: true
      };
    } catch (error) {
      console.warn(
        'No se pudo actualizar la hoja desde la red; se usará la copia local:',
        error
      );
    }
  }

  const [evento, hoja] = await Promise.all([
    bd.leerEvento(eventoId),
    bd.leerHoja(eventoId)
  ]);

  return {
    evento: evento ?? null,
    piezas: await bd.aplicarPendientes(
      eventoId,
      hoja?.piezas ?? []
    ),
    origen: 'local',
    noExiste: !evento
  };
}
