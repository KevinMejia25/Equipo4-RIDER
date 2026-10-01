import { supabase } from './supabaseClient.js';

// ── Cerrar sesión (mismo bloque que ya tienen eventos.js e inventario.js) ──
document.getElementById('btn-salir')?.addEventListener('click', async (evento) => {
  evento.preventDefault();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// ── Mostrar el rol real en vez del texto fijo "Coordinador" ──
// login.js guarda esto en sessionStorage al iniciar sesión. Si por
// alguna razón no está (por ejemplo, alguien entra sin pasar por el
// login), se deja el valor por defecto que ya trae el HTML.
const perfilGuardado = sessionStorage.getItem('rider_perfil');
if (perfilGuardado) {
  try {
    const perfil = JSON.parse(perfilGuardado);
    const etiqueta = document.getElementById('etiqueta-rol');
    etiqueta.textContent = perfil.rol === 'tecnico' ? 'Técnico' : 'Coordinador';
  } catch {
    // Si el JSON guardado estuviera corrupto, simplemente se ignora
    // y se deja la etiqueta por defecto.
  }
}