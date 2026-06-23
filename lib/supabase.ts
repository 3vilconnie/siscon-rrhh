// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validación de seguridad para que el sistema te avise si olvidaste el Paso 1
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase en el archivo .env.local'
  );
}

// Exportamos la instancia única de conexión que usará toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);