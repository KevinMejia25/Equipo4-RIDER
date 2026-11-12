// ═══════════════════════════════════════════════════════════════
// Parte PWA que corre en cada pantalla:
//   1 · registra el service worker (public/sw.js)
//   2 · mantiene la clase "sin-conexion" en <body>, que es lo que
//       muestra la franja de aviso de ui.css (.franja-offline)
//
// Se importa lo primero en el JS de cada pantalla:  import './pwa.js';
// ═══════════════════════════════════════════════════════════════

// ── 1 · Service worker ──
// Solo en la versión compilada (npm run build / el sitio publicado).
// En desarrollo (npm run dev) NO se registra: Vite cambia los archivos
// todo el tiempo y un service worker con caché estorba más de lo que ayuda.
// Se prueba con:  npm run build  →  npm run preview
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  // Se espera a "load" para que registrar el service worker no le quite
  // velocidad a la primera carga de la página.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('No se pudo registrar el service worker:', error);
    });
  });
}

// ── 2 · Indicador de conexión ──
// El color NO es la única señal: la franja trae texto ("Sin conexión…").
function reflejarConexion() {
  document.body.classList.toggle('sin-conexion', !navigator.onLine);
}
window.addEventListener('online', reflejarConexion);
window.addEventListener('offline', reflejarConexion);
reflejarConexion();