import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falla rápido y con un mensaje claro si alguien olvidó su .env local,
  // en vez de un error críptico de "fetch failed" más adelante.
  console.error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en tu archivo .env. ' +
    'Revisa el README del repo para los valores compartidos del equipo.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
