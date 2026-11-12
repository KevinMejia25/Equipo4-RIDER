import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Compila TODAS las pantallas: cada .html de la raíz es una entrada.
// Así nadie tiene que acordarse de registrar su pantalla nueva aquí; sin
// esto, "vite build" solo genera index.html y el resto da 404 al publicar.
const raiz = fileURLToPath(new URL('.', import.meta.url));
const paginas = Object.fromEntries(
  readdirSync(raiz)
    .filter((archivo) => archivo.endsWith('.html'))
    .map((archivo) => [archivo.replace(/\.html$/, ''), resolve(raiz, archivo)])
);

export default defineConfig({
  build: { rollupOptions: { input: paginas } },
});