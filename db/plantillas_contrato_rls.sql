-- =====================================================================
--  Política RLS para "plantillas_contrato"
-- =====================================================================
--  Supabase activa Row Level Security automáticamente al crear una tabla
--  desde el SQL Editor. Sin políticas, RLS bloquea TODO acceso (incluido
--  el de usuarios autenticados) — por eso la app recibía 403 Forbidden
--  al intentar leer/guardar plantillas.
--
--  Este script permite a cualquier usuario autenticado leer, crear,
--  editar y eliminar plantillas (mismo nivel de acceso que ya tiene hoy
--  sobre "trabajadores" y "contratos").
--
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente.
-- =====================================================================

alter table public.plantillas_contrato enable row level security;

drop policy if exists "plantillas_contrato_select_autenticados" on public.plantillas_contrato;
create policy "plantillas_contrato_select_autenticados"
  on public.plantillas_contrato
  for select
  to authenticated
  using (true);

drop policy if exists "plantillas_contrato_insert_autenticados" on public.plantillas_contrato;
create policy "plantillas_contrato_insert_autenticados"
  on public.plantillas_contrato
  for insert
  to authenticated
  with check (true);

drop policy if exists "plantillas_contrato_update_autenticados" on public.plantillas_contrato;
create policy "plantillas_contrato_update_autenticados"
  on public.plantillas_contrato
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "plantillas_contrato_delete_autenticados" on public.plantillas_contrato;
create policy "plantillas_contrato_delete_autenticados"
  on public.plantillas_contrato
  for delete
  to authenticated
  using (true);

-- Verificación:
--   select policyname, cmd, roles from pg_policies where tablename = 'plantillas_contrato';
