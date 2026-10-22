import { supabase } from './supabaseClient.js';

const RUTA_INICIO_POR_ROL = {
  coordinador: '/index.html',
  tecnico: '/tecnico-eventos.html',
};

export function rutaInicioPorRol(rol) {
  return RUTA_INICIO_POR_ROL[rol] ?? '/login.html';
}

// 
const CLAVE_PERFIL = 'rider_perfil';

function leerPerfilGuardado() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_PERFIL));
  } catch {
    return null;
  }
}

function olvidarPerfil() {
  try { sessionStorage.removeItem(CLAVE_PERFIL); } catch { /* sin storage: no pasa nada */ }
}

// Devuelve el perfil de quien tiene la sesión abierta, o null si no hay
// sesión válida (sin sesión, sin perfil ligado, o cuenta desactivada).
export async function obtenerPerfil() {
  const { data: sesion } = await supabase.auth.getSession();
  if (!sesion.session) return null;
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
    await supabase.auth.signOut();
    olvidarPerfil();
    return null;
  }

  try { sessionStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil)); } catch { /* idem */ }
  return perfil;
}

// replace (y no href) para que el botón "atrás" no regrese a la pantalla
// que acaba de rechazar a la persona.
function irA(ruta) {
  window.location.replace(ruta);
}

export async function exigirRol(rolEsperado) {
  const perfil = await obtenerPerfil();

  if (!perfil) {
    irA('/login.html');
  } else if (perfil.rol !== rolEsperado) {
    irA(rutaInicioPorRol(perfil.rol));
  } else {
    return perfil;
  }


  return new Promise(() => {});
}