const NOMBRE_BD = 'rider-tecnico';
const VERSION_BD = 2;

let conexionBD = null;

function abrirBD() {
  if (conexionBD) return conexionBD;

  conexionBD = new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(NOMBRE_BD, VERSION_BD);

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;

      if (!db.objectStoreNames.contains('eventos')) {
        db.createObjectStore('eventos', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('hojas')) {
        db.createObjectStore('hojas', { keyPath: 'evento_id' });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'clave' });
      }

      if (!db.objectStoreNames.contains('pendientes')) {
        db.createObjectStore('pendientes', { keyPath: 'id' });
      }
    };

    solicitud.onsuccess = () => {
      const db = solicitud.result;

      db.onversionchange = () => {
        db.close();
        conexionBD = null;
      };

      resolve(db);
    };

    solicitud.onerror = () => {
      conexionBD = null;
      reject(solicitud.error);
    };

    solicitud.onblocked = () => {
      console.warn('La actualización de la base local está bloqueada por otra pestaña.');
    };
  });

  return conexionBD;
}

function transaccion(nombres, modo, ejecutar) {
  return abrirBD().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(nombres, modo);

    const stores = Object.fromEntries(
      nombres.map((nombre) => [nombre, tx.objectStore(nombre)])
    );

    let resultado;

    try {
      resultado = ejecutar(stores);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }

    tx.oncomplete = () => {
      resolve(
        resultado && typeof resultado === 'object' && 'result' in resultado
          ? resultado.result
          : resultado
      );
    };

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción local cancelada.'));
  }));
}

// Guarda una copia de los eventos y sus hojas.
export function guardarCopiaCompleta({ dueno, eventos, hojas }) {
  return transaccion(
    ['eventos', 'hojas', 'meta'],
    'readwrite',
    (a) => {
      a.eventos.clear();
      a.hojas.clear();

      eventos.forEach((evento) => a.eventos.put(evento));
      hojas.forEach((hoja) => a.hojas.put(hoja));

      a.meta.put({ clave: 'dueno', valor: dueno });
      a.meta.put({
        clave: 'descargada_en',
        valor: new Date().toISOString()
      });

      return true;
    }
  );
}

// Guarda o actualiza una hoja individual.
export function guardarEventoConHoja({ dueno, evento, hoja }) {
  return transaccion(
    ['eventos', 'hojas', 'meta'],
    'readwrite',
    (a) => {
      a.eventos.put(evento);
      a.hojas.put(hoja);

      a.meta.put({ clave: 'dueno', valor: dueno });
      a.meta.put({
        clave: 'descargada_en',
        valor: new Date().toISOString()
      });

      return true;
    }
  );
}

// Con { conservarPendientes: true } (cerrar sesión) se vacía la copia local
// pero se conservan los cambios sin enviar y el dueño de la copia, para que
// no se pierdan y para que otro usuario no pueda enviarlos como suyos.
export function borrarTodo({ conservarPendientes = false } = {}) {
  return transaccion(
    ['eventos', 'hojas', 'meta', 'pendientes'],
    'readwrite',
    (a) => {
      a.eventos.clear();
      a.hojas.clear();

      if (conservarPendientes) {
        a.meta.delete('descargada_en');
      } else {
        a.meta.clear();
        a.pendientes.clear();
      }

      return true;
    }
  );
}

function leer(almacen, operacion) {
  return transaccion([almacen], 'readonly', (a) => operacion(a[almacen]));
}

export const leerEventos = () => leer('eventos', (a) => a.getAll());
export const leerEvento = (id) => leer('eventos', (a) => a.get(id));
export const leerHoja = (id) => leer('hojas', (a) => a.get(id));
export const leerPendientes = () => leer('pendientes', (a) => a.getAll());

export async function leerMeta(clave) {
  const fila = await leer('meta', (a) => a.get(clave));
  return fila?.valor ?? null;
}

export function contarPendientes() {
  return leer('pendientes', (a) => a.count());
}

// Guarda la acción pendiente y actualiza la hoja local en la misma transacción.
export function guardarPendiente(pendiente) {
  return transaccion(
    ['pendientes', 'hojas'],
    'readwrite',
    (a) => {
      a.pendientes.put(pendiente);

      const solicitud = a.hojas.get(pendiente.evento_id);

      solicitud.onsuccess = () => {
        const hoja = solicitud.result;
        if (!hoja) return;

        const pieza = hoja.piezas?.find(
          (p) => p.id === pendiente.asignacion_id
        );

        if (!pieza) return;

        if (pendiente.tipo === 'salida') {
          pieza.salida_registrada = pendiente.fecha;
        }

        if (pendiente.tipo === 'retorno') {
          pieza.retorno_registrado = pendiente.fecha;
          pieza.condicion_retorno = pendiente.condicion_retorno;
          pieza.nota = pendiente.nota || null;
        }

        pieza.pendiente_envio = true;
        a.hojas.put(hoja);
      };

      return true;
    }
  );
}

export function eliminarPendiente(id) {
  return transaccion(
    ['pendientes'],
    'readwrite',
    (a) => a.pendientes.delete(id)
  );
}

// Cuando se confirma el envío, se quita la marca de pendiente de la hoja.
export function marcarPendienteSincronizado(pendiente) {
  return transaccion(
    ['hojas'],
    'readwrite',
    (a) => {
      const solicitud = a.hojas.get(pendiente.evento_id);

      solicitud.onsuccess = () => {
        const hoja = solicitud.result;
        if (!hoja) return;

        const pieza = hoja.piezas?.find(
          (p) => p.id === pendiente.asignacion_id
        );

        if (!pieza) return;

        pieza.pendiente_envio = false;
        a.hojas.put(hoja);
      };

      return true;
    }
  );
}

// Aplica los cambios pendientes sobre una hoja recién descargada.
export async function aplicarPendientes(eventoId, piezas) {
  const pendientes = await leerPendientes();

  const copia = (piezas || []).map((pieza) => ({ ...pieza }));

  for (const pendiente of pendientes) {
    if (pendiente.evento_id !== eventoId) continue;

    const pieza = copia.find(
      (p) => p.id === pendiente.asignacion_id
    );

    if (!pieza) continue;

    if (pendiente.tipo === 'salida') {
      pieza.salida_registrada = pendiente.fecha;
    }

    if (pendiente.tipo === 'retorno') {
      pieza.retorno_registrado = pendiente.fecha;
      pieza.condicion_retorno = pendiente.condicion_retorno;
      pieza.nota = pendiente.nota || null;
    }

    pieza.pendiente_envio = true;
  }

  return copia;
}