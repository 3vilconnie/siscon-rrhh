-- =====================================================================
--  Distingue si un contrato es un contrato nuevo o un "Anexo de
--  Ampliación" de un contrato existente del mismo trabajador.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente, así que
--  se puede volver a correr sin problema.
--
--  "contrato_origen_id" solo se rellena cuando tipo = 'anexo': apunta al
--  contrato que se está ampliando. Es autorreferencial hacia la misma
--  tabla "contratos".
-- =====================================================================

alter table public.contratos
  add column if not exists tipo text not null default 'contrato',
  add column if not exists contrato_origen_id uuid references public.contratos(id);

alter table public.contratos
  drop constraint if exists contratos_tipo_check;
alter table public.contratos
  add constraint contratos_tipo_check check (tipo in ('contrato', 'anexo'));

-- Verificación:
--   select id, trabajador_rut, tipo, contrato_origen_id, fecha_inicio, fecha_termino
--   from public.contratos
--   order by fecha_inicio;
