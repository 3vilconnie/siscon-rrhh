-- =====================================================================
--  Política RLS para el registro de auditoría desde la aplicación
-- =====================================================================
--  El registro de auditoría se hace desde el cliente (lib/auditoria.ts) con la
--  sesión del usuario autenticado. Para que ese INSERT funcione con RLS activo,
--  hay que permitir que "authenticated" pueda INSERTAR en "auditoria"
--  (pero NO leerla, editarla ni borrarla; eso queda para el panel admin, que
--   usa la service role del lado del servidor y salta RLS).
--
--  Ejecutar una vez en Supabase -> SQL Editor.
-- =====================================================================

alter table public.auditoria enable row level security;

-- Permitir INSERT a cualquier usuario autenticado.
drop policy if exists "auditoria_insert_autenticados" on public.auditoria;
create policy "auditoria_insert_autenticados"
  on public.auditoria
  for insert
  to authenticated
  with check (true);

-- (Opcional) Permitir SELECT solo a administradores. El panel de admin lee la
-- auditoría vía service role (servidor), así que esta política no es obligatoria;
-- descoméntala si además quieres leerla directo con la sesión del usuario admin.
--
-- drop policy if exists "auditoria_select_admin" on public.auditoria;
-- create policy "auditoria_select_admin"
--   on public.auditoria
--   for select
--   to authenticated
--   using ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' );

-- Verificación:
--   select policyname, cmd, roles from pg_policies where tablename = 'auditoria';
