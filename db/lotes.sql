-- =====================================================================
--  Registro de lotes: cada generación masiva de contratos, anexos o
--  finiquitos queda guardada con los valores que efectivamente se usaron.
-- =====================================================================
--  POR QUÉ SE COPIAN LOS VALORES Y NO SE APUNTA AL CONTRATO:
--  Las fórmulas cambian. El cálculo del feriado proporcional del finiquito
--  se corrigió dos veces (redondeo de días hábiles y feriados legales). Un
--  lote emitido en 2026 debe seguir mostrando lo que REALMENTE se pagó, no
--  lo que la fórmula actual calcularía hoy. Por eso lote_items guarda un
--  snapshot: montos, fechas y nombre del trabajador al momento del lote.
--
--  Es el mismo criterio de las plantillas de contrato: el molde no queda
--  enlazado al documento generado.
--
--  Los finiquitos, además, hoy no dejaban NINGÚN rastro: se generaban los
--  documentos y no quedaba registro de a quién ni por cuánto.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente.
-- =====================================================================

create table if not exists public.lotes (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,              -- contrato | anexo | finiquito
  estado       text not null default 'generado',
  cantidad     integer not null default 0,
  formato      text,                       -- pdf | docx | (null si no aplica)
  /** Configuración usada: programa, fechas, bonos, etc. Permite regenerar. */
  parametros   jsonb not null default '{}'::jsonb,
  generado_por text,
  generado_en  timestamptz not null default now(),
  anulado_por  text,
  anulado_en   timestamptz,
  motivo       text
);

alter table public.lotes drop constraint if exists lotes_tipo_check;
alter table public.lotes
  add constraint lotes_tipo_check check (tipo in ('contrato', 'anexo', 'finiquito'));

alter table public.lotes drop constraint if exists lotes_estado_check;
alter table public.lotes
  add constraint lotes_estado_check check (estado in ('generado', 'anulado'));

create index if not exists lotes_generado_en_idx on public.lotes (generado_en desc);
create index if not exists lotes_tipo_idx on public.lotes (tipo);

-- ---------------------------------------------------------------------
--  Una fila por trabajador dentro del lote.
--  Las columnas comunes (fechas, monto) están explícitas para poder
--  consultarlas y sumarlas; lo específico de cada tipo va en "detalle".
-- ---------------------------------------------------------------------
create table if not exists public.lote_items (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.lotes(id) on delete cascade,
  trabajador_rut  integer not null,
  /** Copia del nombre al momento del lote: si luego se corrige en la ficha,
   *  el lote sigue mostrando lo que decía el documento emitido. */
  nombre_completo text not null,
  fecha_inicio    date,
  fecha_termino   date,
  /** Sueldo base (contrato/anexo) o total a pagar (finiquito). */
  monto           numeric,
  detalle         jsonb not null default '{}'::jsonb
);

create index if not exists lote_items_lote_idx on public.lote_items (lote_id);
create index if not exists lote_items_rut_idx on public.lote_items (trabajador_rut);

-- ---------------------------------------------------------------------
--  RLS — mismo criterio que la tabla "auditoria":
--
--    · INSERT: cualquier usuario autenticado, porque el registro del lote
--      lo hace el navegador de quien genera los documentos.
--    · SELECT / UPDATE: NINGUNA política. Consultar el historial y anular
--      un lote son operaciones de auditoría, reservadas a administradores:
--      se hacen desde /api/admin/lotes, que corre con la service role
--      (salta RLS) y está detrás del guardia de rol de proxy.ts.
--
--  Al no existir política de SELECT, un usuario no administrador no puede
--  leer estas tablas ni siquiera consultando la API de Supabase directo.
-- ---------------------------------------------------------------------
alter table public.lotes enable row level security;
alter table public.lote_items enable row level security;

drop policy if exists "lotes_select" on public.lotes;
drop policy if exists "lotes_update" on public.lotes;
drop policy if exists "lote_items_select" on public.lote_items;

drop policy if exists "lotes_insert" on public.lotes;
create policy "lotes_insert" on public.lotes for insert to authenticated with check (true);

drop policy if exists "lote_items_insert" on public.lote_items;
create policy "lote_items_insert" on public.lote_items for insert to authenticated with check (true);

-- Verificación:
--   select l.tipo, l.generado_en, l.cantidad, count(i.id)
--   from public.lotes l left join public.lote_items i on i.lote_id = l.id
--   group by l.id order by l.generado_en desc;
