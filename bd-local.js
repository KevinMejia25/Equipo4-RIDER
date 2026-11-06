
// Copia local de los datos del técnico, en IndexedDB.
// Tres "almacenes" (como tablas):
//   eventos → un registro por evento     (clave: id)
//   hojas   → la hoja de carga de cada evento: { evento_id, piezas: [...] }
//   meta    → datos sueltos: de quién es la copia y cuándo se descargó


const NOMBRE_BD = 'rider-tecnico';
const VERSION_BD = 1;   // se sube solo si cambian los almacenes

let conexion = null;    // se abre una sola vez y se reutiliza

function abrirBD() {
  if (conexion) return conexion;
  conexion = new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);

    // Solo corre la primera vez (o al subir VERSION_BD): crea los almacenes.
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      bd.createObjectStore('eventos', { keyPath: 'id' });
      bd.createObjectStore('hojas', { keyPath: 'evento_id' });
      bd.createObjectStore('meta', { keyPath: 'clave' });
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => { conexion = null; rechazar(peticion.error); };
  });
  return conexion;
}

// Corre `operaciones(almacenes)` dentro de UNA transacción: o se guarda todo
// o no se guarda nada (si se corta la luz a la mitad no queda una copia
// a medias).
async function enTransaccion(nombres, modo, operaciones) {
  const bd = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(nombres, modo);
    const almacenes = Object.fromEntries(nombres.map((n) => [n, tx.objectStore(n)]));
    let resultado;
    try {
      resultado = operaciones(almacenes);
    } catch (error) {
      tx.abort();
      rechazar(error);
      return;
    }
    // Si la operación devolvió una petición (get, getAll), su resultado
    // solo existe cuando la transacción termina.
    tx.oncomplete = () => resolver(resultado && 'result' in resultado ? resultado.result : undefined);
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });
}

// ── Escritura ──

// Reemplaza TODA la copia local por la que acaba de bajar de la red.
// `dueno` es el id de la persona a la que pertenece la copia.
export function guardarCopiaCompleta({ dueno, eventos, hojas }) {
  return enTransaccion(['eventos', 'hojas', 'meta'], 'readwrite', (a) => {
    a.eventos.clear();
    a.hojas.clear();
    eventos.forEach((e) => a.eventos.put(e));
    hojas.forEach((h) => a.hojas.put(h));
    a.meta.put({ clave: 'dueno', valor: dueno });
    a.meta.put({ clave: 'descargada_en', valor: new Date().toISOString() });
  });
}

// Actualiza un solo evento y su hoja (cuando se abre la hoja de carga con red).
export function guardarEventoConHoja({ dueno, evento, hoja }) {
  return enTransaccion(['eventos', 'hojas', 'meta'], 'readwrite', (a) => {
    a.eventos.put(evento);
    a.hojas.put(hoja);
    a.meta.put({ clave: 'dueno', valor: dueno });
  });
}

// Borra todo (cuando cierra sesión o entra otra persona).
export function borrarTodo() {
  return enTransaccion(['eventos', 'hojas', 'meta'], 'readwrite', (a) => {
    a.eventos.clear();
    a.hojas.clear();
    a.meta.clear();
  });
}

// ── Lectura ──

function leer(almacen, operacion) {
  return enTransaccion([almacen], 'readonly', (a) => operacion(a[almacen]));
}

export const leerEventos = () => leer('eventos', (a) => a.getAll());
export const leerEvento  = (id) => leer('eventos', (a) => a.get(id));
export const leerHoja    = (eventoId) => leer('hojas', (a) => a.get(eventoId));

export async function leerMeta(clave) {
  const fila = await leer('meta', (a) => a.get(clave));
  return fila?.valor ?? null;
}