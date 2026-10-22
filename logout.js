import { supabase } from './supabaseClient.js';

// Cualquier página con un botón/enlace con id="btn-salir" puede llamar
// esta función una vez cargado el DOM para que cierre sesión de verdad
// antes de mandar a login.html — en vez de solo navegar sin cerrar nada.
export function conectarBotonSalir() {
  const btnSalir = document.getElementById('btn-salir');
  if (!btnSalir) return;

  btnSalir.addEventListener('click', async (evento) => {
    evento.preventDefault();
    await supabase.auth.signOut();
    sessionStorage.removeItem('rider_perfil');
    window.location.href = '/login.html';
  });
}