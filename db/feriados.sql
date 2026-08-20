-- =====================================================================
--  Feriados legales para el cálculo del feriado proporcional del finiquito.
-- =====================================================================
--  El sistema CALCULA solo los feriados deducibles (fechas fijas, los
--  derivados de la Pascua y los desplazables de la Ley 19.668) — ver
--  lib/feriados.ts. Esta tabla cubre los que NO son deducibles:
--
--    · Días de elección (se fijan por ley cada vez).
--    · Feriados creados por leyes puntuales.
--    · Correcciones a un feriado calculado que haya quedado mal
--      (p. ej. el Día de los Pueblos Indígenas sigue el solsticio y puede
--      caer 20 o 21 de junio según el año).
--
--  Para CORREGIR un feriado calculado se agrega la misma fecha con
--  excluir = true, y luego la fecha correcta como una fila nueva.
--
--  region = '' significa NACIONAL (aplica a todo el país). Si se indica
--  (p. ej. 'arica'), solo cuenta cuando el finiquito se emite para esa región.
--
--  Se usa cadena vacía y NO null a propósito: la llave primaria incluye
--  "region", y en PostgreSQL una PRIMARY KEY obliga a NOT NULL en todas sus
--  columnas. Además, en SQL NULL nunca es igual a NULL, así que un upsert
--  sobre una columna nullable no detectaría el conflicto y duplicaría filas.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente.
-- =====================================================================

create table if not exists public.feriados (
  fecha    date not null,
  nombre   text not null,
  region   text not null default '',   -- '' = nacional
  excluir  boolean not null default false,
  creado_en timestamptz not null default now(),
  primary key (fecha, region)
);

-- Ajuste para tablas creadas con la versión anterior de este script
-- (region sin default). Es inofensivo si la tabla ya está correcta.
alter table public.feriados alter column region set default '';

-- Índice para filtrar por año rápido al calcular un finiquito.
create index if not exists feriados_fecha_idx on public.feriados (fecha);

alter table public.feriados enable row level security;

-- Lectura: cualquier usuario autenticado (el cálculo corre en el navegador).
drop policy if exists "feriados_select_autenticados" on public.feriados;
create policy "feriados_select_autenticados"
  on public.feriados for select to authenticated using (true);

-- Escritura: también autenticados; la pantalla de mantención vive en el panel
-- de Admin, que ya está protegido por rol en proxy.ts.
drop policy if exists "feriados_insert_autenticados" on public.feriados;
create policy "feriados_insert_autenticados"
  on public.feriados for insert to authenticated with check (true);

drop policy if exists "feriados_update_autenticados" on public.feriados;
create policy "feriados_update_autenticados"
  on public.feriados for update to authenticated using (true) with check (true);

drop policy if exists "feriados_delete_autenticados" on public.feriados;
create policy "feriados_delete_autenticados"
  on public.feriados for delete to authenticated using (true);

-- Verificación:
--   select * from public.feriados order by fecha;
