-- =====================================================================
--  Quita "prevision" y "salud" de plantillas_contrato: son datos del
--  trabajador (tabla "trabajadores"), no del molde del contrato. La app
--  ya no los lee ni los escribe.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente.
-- =====================================================================

alter table public.plantillas_contrato
  drop column if exists prevision,
  drop column if exists salud;

-- Verificación:
--   select column_name from information_schema.columns
--   where table_name = 'plantillas_contrato'
--   order by ordinal_position;
