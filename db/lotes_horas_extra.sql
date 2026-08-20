-- db/lotes_horas_extra.sql
--
-- Ejecutar en el SQL Editor de Supabase. Hace dos cosas:
--
--  1. Agrega 'horas_extra' a los tipos de lote válidos, para que el módulo de
--     Anexos de Horas Extraordinarias deje el mismo rastro que los contratos,
--     anexos de ampliación y finiquitos masivos.
--
--  2. Vuelve a crear las políticas de INSERT de db/lotes.sql. Es idempotente:
--     si ya existían, quedan igual. Se repite aquí porque el registro de lotes
--     estaba fallando con "new row violates row-level security policy", que es
--     exactamente el error que aparece cuando esas políticas no están puestas.
--
-- Requiere haber ejecutado antes db/lotes.sql.
--
-- En los lotes de horas extra:
--   lote_items.monto   va en NULL (un anexo de horas no tiene monto asociado).
--   lote_items.detalle guarda { "horas": 32, "mes": "2026-06" }.
--   lotes.parametros   guarda { "mes": "2026-06", "fechaEmision": "...", ... }.

-- 1. Tipo nuevo -------------------------------------------------------------
alter table public.lotes drop constraint if exists lotes_tipo_check;
alter table public.lotes
  add constraint lotes_tipo_check
  check (tipo in ('contrato', 'anexo', 'finiquito', 'horas_extra'));

-- 2. Políticas de escritura -------------------------------------------------
-- Solo INSERT. NO se crea política de SELECT ni de UPDATE a propósito: leer el
-- historial y anular un lote son operaciones de auditoría y van por
-- /api/admin/lotes, que corre con service role detrás del guardia de rol de
-- proxy.ts. Sin política de SELECT, un usuario no administrador no puede leer
-- estas tablas ni consultando la API de Supabase directamente.
alter table public.lotes enable row level security;
alter table public.lote_items enable row level security;

drop policy if exists "lotes_insert" on public.lotes;
create policy "lotes_insert" on public.lotes for insert to authenticated with check (true);

drop policy if exists "lote_items_insert" on public.lote_items;
create policy "lote_items_insert" on public.lote_items for insert to authenticated with check (true);

-- Verificación: deberían aparecer exactamente dos filas, ambas cmd = INSERT.
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where tablename in ('lotes', 'lote_items');
