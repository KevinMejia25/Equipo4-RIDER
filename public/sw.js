// ═══════════════════════════════════════════════════════════════════
// RIDER — Service worker
//
//  guarda en el dispositivo las pantallas de la
// aplicación (el "app shell") para que se abran sin conexión, y deja que
// el JavaScript de cada pantalla lea los DATOS desde IndexedDB.

const VERSION = 'v1';
const CACHE = `rider-${VERSION}`;

// Las pantallas que SIEMPRE tienen que abrir sin conexión. Si una de estas
// falla al descargarse, la instalación falla a propósito: es mejor enterarse
// en el despliegue que descubrirlo con el técnico sin señal.
const NUCLEO = [
  '/login.html',
  '/index.html',
  '/tecnico-eventos.html',
  '/tecnico-hoja-carga.html',
  '/tecnico-registrar-retorno.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Opciones para buscar en la caché. ignoreVary es NECESARIO: algunos servidores
// (Vite, y a veces Netlify) responden con "Vary: Origin". Los módulos de JS se
// piden con la cabecera Origin y la copia que guardamos al instalar no la
// tiene; sin esta opción la caché los trata como archivos distintos y NO los
// encuentra, así que sin conexión la página llega pero sin JS ni CSS.
const BUSCAR = { ignoreVary: true };

// Tiempo máximo que se espera a la red antes de usar la copia guardada.
// Con señal mala ("lie-fi") el navegador puede esperar mucho; el técnico no.
const ESPERA_RED_MS = 4000;


// ── INSTALL ─────────────────────────────────────────────────────────
self.addEventListener('install', (evento) => {
  // waitUntil: el navegador no da por instalado este service worker hasta
  // que termine la promesa que le pasamos.
  evento.waitUntil(
    precachear().then(() => self.skipWaiting())
    // skipWaiting: no esperar a que se cierren las pestañas viejas;
    // este service worker pasa a "activate" de inmediato.
  );
});

async function precachear() {
  const cache = await caches.open(CACHE);
  await Promise.all(NUCLEO.map((url) => guardarConDependencias(cache, url)));
}

// Descarga una URL y la guarda. Si es HTML, también guarda los CSS, JS e
// imágenes que ese HTML usa. Hace falta porque, al compilar, Vite les pone
// un código en el nombre (p. ej. /assets/login-8f3a1c.js) que cambia en cada
// build: leyéndolos del propio HTML nunca hay que escribirlos a mano.
async function guardarConDependencias(cache, url) {
  // cache: 'reload' = ignorar la caché HTTP del navegador y pedirla fresca.
  const respuesta = await fetch(url, { cache: 'reload' });
  if (!respuesta.ok) throw new Error(`No se pudo guardar ${url} (${respuesta.status})`);

  await cache.put(url, respuesta.clone());

  const esHtml = (respuesta.headers.get('content-type') || '').includes('text/html');
  if (!esHtml) return;

  const html = await respuesta.text();
  await Promise.all(
    dependenciasDe(html).map(async (dep) => {
      if (await cache.match(dep, BUSCAR)) return;     // ya la tenemos
      const r = await fetch(dep, { cache: 'reload' });
      if (r.ok) await cache.put(dep, r);
    })
  );
}

// Busca src="..." y href="..." que apunten a archivos del mismo sitio
// (empiezan con "/") y que sean CSS, JS, imágenes o fuentes. Los enlaces a
// otras páginas (<a href="/eventos.html">) no se guardan aquí.
function dependenciasDe(html) {
  const encontradas = new Set();
  for (const [, ruta] of html.matchAll(/(?:src|href)="(\/[^"#?]*)(?:\?[^"]*)?"/g)) {
    if (ruta.startsWith('//')) continue;            // "//otro-sitio.com/..."
    if (/\.(?:js|css|png|jpe?g|svg|webp|ico|woff2?)$/i.test(ruta)) encontradas.add(ruta);
  }
  return [...encontradas];
}


// ── ACTIVATE ────────────────────────────────────────────────────────
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // Borra las cachés de versiones anteriores (rider-v0, etc.).
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      // claim: tomar el control de las pestañas que ya están abiertas.
      // Sin esto, la primera visita no pasaría por este service worker
      // hasta recargar.
      await self.clients.claim();
    })()
  );
});


// ── FETCH ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;

  // Solo se manejan lecturas (GET). Guardar datos va directo a la red.
  if (peticion.method !== 'GET') return;

  // Solo archivos de ESTE sitio. Supabase (otro dominio) pasa sin tocar:
  // sus datos los guarda la propia aplicación en IndexedDB.
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  if (peticion.mode === 'navigate') {
    // El usuario abre o recarga una página.
    evento.respondWith(paginaRedPrimero(peticion, url));
  } else {
    // CSS, JS, íconos, manifiesto…
    evento.respondWith(cachePrimero(peticion));
  }
});

// PÁGINAS → primero la red, y si no hay (o tarda demasiado), la copia.
// Así, con señal siempre se ve la versión más nueva; sin señal, la guardada.
async function paginaRedPrimero(peticion, url) {
  const cache = await caches.open(CACHE);
  try {
    const respuesta = await conLimite(fetch(peticion), ESPERA_RED_MS);
    // Se guarda con la ruta sin "?evento_id=..." para tener una sola copia
    // de cada página. Una respuesta con redirección no se puede entregar
    // como página, por eso no se guarda.
    if (respuesta.ok && !respuesta.redirected) {
      cache.put(url.pathname, respuesta.clone());
    }
    return respuesta;
  } catch {
    // Sin red: la copia guardada (ignorando el "?evento_id=...") …
    const copia = await cache.match(url.pathname, { ...BUSCAR, ignoreSearch: true });
    if (copia) return copia;
    // … o, si esa página nunca se guardó, la página "sin conexión".
    return cache.match('/offline.html', BUSCAR);
  }
}

// ARCHIVOS → primero la copia, y solo si no está se pide a la red.
// Es seguro porque los nombres con código (/assets/app-8f3a1c.js) cambian
// cuando cambia su contenido. Lo que no lleva código (íconos, manifiesto)
// se actualiza subiendo VERSION arriba.
async function cachePrimero(peticion) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(peticion, BUSCAR);
  if (copia) return copia;
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch {
    return Response.error();   // sin red y sin copia: falla como siempre
  }
}

// Rechaza si la promesa no termina a tiempo.
function conLimite(promesa, ms) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error('Tiempo de espera agotado')), ms);
    promesa.then(
      (valor) => { clearTimeout(reloj); resolver(valor); },
      (error) => { clearTimeout(reloj); rechazar(error); }
    );
  });
}