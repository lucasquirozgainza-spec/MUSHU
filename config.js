// Configuración de la conexión compartida.
// Pega aquí la "Project URL" y la clave "anon public" de tu proyecto de Supabase
// (Supabase → Project Settings → API). La clave anon es pública por diseño: la seguridad
// la ponen las políticas RLS del archivo supabase/schema.sql. NUNCA pongas aquí la clave
// "service_role".
//
// Si lo dejas vacío, la app te pedirá los datos la primera vez (se guardan en el navegador).
export const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
