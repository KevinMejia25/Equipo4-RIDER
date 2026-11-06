import { exigirRol, cerrarSesion } from './guardia.js';

// Esta es la pantalla de inicio del coordinador. Sin sesión va al login;
// un técnico es enviado a su propio diseño (móvil).
const perfil = await exigirRol('coordinador');

// ── Cerrar sesión ──
document.getElementById('btn-salir')?.addEventListener('click', (evento) => {
  evento.preventDefault();
  cerrarSesion();
});

// ── Mostrar el rol real en vez del texto fijo "Coordinador" ──
// El perfil lo verificó el guardia contra el servidor justo arriba.
document.getElementById('etiqueta-rol').textContent =
  perfil.rol === 'tecnico' ? 'Técnico' : 'Coordinador';