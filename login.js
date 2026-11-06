import { supabase } from './supabaseClient.js';
import { obtenerPerfil, rutaInicioPorRol, guardarPerfil } from './guardia.js';

const form = document.getElementById('form-login');
const inputCorreo = document.getElementById('correo');
const inputContrasena = document.getElementById('contrasena');
const btnEntrar = document.getElementById('btn-entrar');
const avisoError = document.getElementById('aviso-error');
const avisoErrorTexto = document.getElementById('aviso-error-texto');

// ── Si ya hay sesión activa, no tiene caso ver el login de nuevo ──
// Cada rol va a su propia pantalla de inicio (coordinador: escritorio,
// técnico: móvil). Si hay sesión pero sin perfil usable, obtenerPerfil
// la cierra y aquí se queda el formulario.
const perfilActual = await obtenerPerfil();
if (perfilActual) {
  window.location.replace(rutaInicioPorRol(perfilActual.rol));
}

// ── Validación de campos (mismo patrón que nuevo-evento.js) ──
function limpiarErrores() {
  form.querySelectorAll('.campo').forEach((campo) => campo.classList.remove('campo--error'));
  form.querySelectorAll('.campo__error').forEach((span) => span.classList.add('oculto'));
}
function marcarError(inputId, mensaje) {
  const input = document.getElementById(inputId);
  const campo = input.closest('.campo');
  campo.classList.add('campo--error');
  const span = campo.querySelector('.campo__error');
  if (mensaje) span.textContent = mensaje;
  span.classList.remove('oculto');
}
function mostrarAvisoError(mensaje) {
  avisoErrorTexto.textContent = mensaje;
  avisoError.classList.remove('oculto');
}
function ocultarAvisoError() {
  avisoError.classList.add('oculto');
}

limpiarErrores();
ocultarAvisoError();

// ── Envío del formulario ──
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  ocultarAvisoError();
  limpiarErrores();

  const correo = inputCorreo.value.trim();
  const contrasena = inputContrasena.value;

  let esValido = true;
  if (!correo) { marcarError('correo'); esValido = false; }
  if (!contrasena) { marcarError('contrasena'); esValido = false; }
  if (!esValido) return;

  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando…';

  try {
    // 1 · Autenticación real contra Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (error) throw error;

    // 2 · Con la sesión ya creada, buscamos el rol de esta persona
    //     en la tabla usuarios (la que sí conoce coordinador/técnico).
    const { data: perfil, error: errorPerfil } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, activo, auth_user_id')
      .eq('auth_user_id', data.user.id)
      .single();

    if (errorPerfil || !perfil) {
      // Sin esto, la sesión de Auth queda activa aunque el login
      // "falle" desde la perspectiva del usuario — y la próxima vez
      // que entre a login.html, lo mandaría directo a su pantalla de
      // inicio sin haber completado el login de verdad.
      await supabase.auth.signOut();
      throw new Error(
        'Tu cuenta existe pero no está ligada a ningún perfil en el sistema. Avisa al coordinador.'
      );
    }

    if (!perfil.activo) {
      await supabase.auth.signOut();
      throw new Error('Tu cuenta está desactivada. Avisa al coordinador.');
    }

    // 3 · Guardamos el perfil para que otras pantallas lo consulten
    //     sin tener que volver a hacer esta consulta cada vez.
    //     Esto es solo conveniencia de interfaz — la seguridad real
    //     la da RLS en el servidor, no lo que guardemos aquí.
    guardarPerfil(perfil);

    // 4 · Cada rol entra a su propio diseño.
    window.location.href = rutaInicioPorRol(perfil.rol);

  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    const mensaje = error.message?.includes('Invalid login credentials')
      ? 'Correo o contraseña incorrectos.'
      : error.message?.includes('fetch')
        ? 'No se pudo conectar con el servidor. Revisa tu conexión.'
        : error.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    mostrarAvisoError(mensaje);
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'Iniciar sesión';
  }
});