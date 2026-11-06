import { supabase } from './supabaseClient.js';
import { borrarTodo } from './bd-local.js';

// Guardia de pantallas por rol.
//
// Cada rol tiene su propia pantalla de inicio:
//   · coordinador → /index.html          (diseño de escritorio)
//   · técnico     → /tecnico-eventos.html (diseño móvil)

const RUTA_INICIO_POR_ROL = {
  coordinador: '/index.html',
  tecnico: '/tecnico-eventos.html',
};

export function rutaInicioPorRol(rol) {
  return RUTA_INICIO_POR_ROL[rol] ?? '/login.html';
}

// ── Copia del perfil en el dispositivo ──
// Sirve para saber quién es la persona SIN conexión. Vive en localStorage
// (y no en sessionStorage) porque tiene que sobrevivir a cerrar y volver
// a abrir la aplicación instalada.
const CLAVE_PERFIL = 'rider_perfil';

export function guardarPerfil(perfil) {
  try { localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil)); } catch { /* sin storage: no pasa nada */ }
}

export function leerPerfilGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PERFIL));
  } catch {
    return null;
  }
}

export function olvidarPerfil() {
  try { localStorage.removeItem(CLAVE_PERFIL); } catch { /* idem */ }
  try { sessionStorage.removeItem(CLAVE_PERFIL); } catch { /* versiones anteriores lo guardaban aquí */ }
}

// ¿El error es de red (no hay conexión) y no una respuesta del servidor?
function esErrorDeRed(error) {
  return Boolean(error) && (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message ?? ''));
}

// Devuelve el perfil de quien tiene la sesión abierta, o null si no hay
// sesión válida (sin sesión, sin perfil ligado, o cuenta desactivada).
export async function obtenerPerfil() {
  const { data: sesion, error: errorSesion } = await supabase.auth.getSession();

  if (!sesion.session) {
    // Sin conexión, un token vencido no se puede renovar y getSession
    // contesta "no hay sesión" CON un error de red. Ese error solo aparece
    // cuando sí había una sesión guardada, así que se usa la copia del perfil.
    // Sin error de red es simplemente que no hay sesión.
    if (esErrorDeRed(errorSesion)) {
      const guardado = leerPerfilGuardado();
      return guardado?.activo ? guardado : null;
    }
    return null;
  }
  const authId = sesion.session.user.id;

  const { data: perfil, error } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, activo, auth_user_id')
    .eq('auth_user_id', authId)
    .maybeSingle();

  if (error) {
    // No pudimos preguntarle al servidor (por ejemplo, sin conexión).
    // Se usa la copia guardada solo si es de ESTA misma sesión; si no,
    // no se puede saber quién es y se trata como sin sesión.
    const guardado = leerPerfilGuardado();
    return guardado && guardado.auth_user_id === authId && guardado.activo ? guardado : null;
  }

  if (!perfil || !perfil.activo) {
    // Hay sesión de Auth pero no hay perfil usable: se cierra, para que
    // login.html no la vea como "ya entró" y no se forme un ciclo.
    await supabase.auth.signOut({ scope: 'local' });
    olvidarPerfil();
    return null;
  }

  guardarPerfil(perfil);
  return perfil;
}

// replace (y no href) para que el botón "atrás" no regrese a la pantalla
// que acaba de rechazar a la persona.
function irA(ruta) {
  window.location.replace(ruta);
}

// Se llama al inicio del JS de cada pantalla de un rol:
//   const perfil = await exigirRol('tecnico');
// · sin sesión           → login.html
// · sesión de otro rol   → la pantalla de inicio de SU rol
// · sesión del rol justo → devuelve el perfil y la pantalla sigue
export async function exigirRol(rolEsperado) {
  const perfil = await obtenerPerfil();

  if (!perfil) {
    irA('/login.html');
  } else if (perfil.rol !== rolEsperado) {
    irA(rutaInicioPorRol(perfil.rol));
  } else {
    return perfil;
  }

  // Ya se mandó a la persona a otra página. Esta promesa nunca se cumple
  // a propósito: así el resto del JS de la pantalla rechazada no corre
  // (no pide datos ni pinta nada) mientras el navegador cambia de página.
  return new Promise(() => {});
}

// Cierra la sesión y deja el dispositivo limpio: el perfil guardado y la
// copia local de los datos (eventos y hoja de carga) se borran, para que la
// siguiente persona que use el teléfono no vea los de la anterior.
export async function cerrarSesion() {
  // Con conexión, esto además invalida la sesión en el servidor.
  try { await supabase.auth.signOut(); } catch { /* sin conexión: se sigue */ }
  // Sin conexión lo anterior puede no limpiar nada; esto siempre limpia
  // la sesión guardada en ESTE dispositivo.
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* idem */ }
  olvidarPerfil();
  try { await borrarTodo(); } catch { /* aún no existía la base local */ }
  window.location.href = '/login.html';
}