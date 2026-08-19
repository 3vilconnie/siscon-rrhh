-- =====================================================================
--  Asigna el rol "admin" a un usuario en app_metadata.
-- =====================================================================
--  POR QUÉ ES NECESARIO:
--  El guardia de rutas (proxy.ts) y el navbar leen el rol desde
--  app_metadata.role. Si ningún usuario lo tiene, la consola de
--  administración queda inaccesible para todos (la página redirige y
--  /api/admin responde 403) — incluido el propio administrador.
--
--  Este script rompe ese "huevo y gallina": asigna el primer admin
--  directamente en la base. Una vez hecho, ese usuario puede asignar
--  roles al resto desde la consola, sin volver a tocar SQL.
--
--  app_metadata (y no user_metadata) es intencional: solo el service
--  role puede escribirlo. Si el rol viviera en user_metadata, cualquier
--  usuario podría auto-asignarse "admin" desde el navegador con
--  supabase.auth.updateUser().
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor.
--  IMPORTANTE: cambia el correo por el de la cuenta que corresponda.
--  Tras ejecutarlo, cierra sesión y vuelve a entrar para que el token
--  recoja el metadato actualizado.
-- =====================================================================

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'constanza.ramos@gmail.com';

-- Verificación (debe mostrar "role": "admin"):
--   select email, raw_app_meta_data
--   from auth.users
--   order by created_at;
