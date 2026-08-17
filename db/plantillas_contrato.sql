-- =====================================================================
--  Plantillas de Contrato: moldes reutilizables con los datos
--  transversales del contrato (labores, programa, jornada, sueldo
--  sugerido, bonos, etc.) para no tener que rellenarlos a mano cada vez.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente
--  (create table if not exists), así que se puede volver a correr sin
--  problema.
--
--  IMPORTANTE: esta tabla NO tiene relación (FK) hacia "contratos" ni
--  "trabajadores". Es intencional: al generar un contrato desde una
--  plantilla, sus valores se COPIAN al formulario y luego a la fila de
--  "contratos" como datos planos (igual que ya hace hoy la app). Así,
--  editar o eliminar una plantilla nunca puede alterar contratos que ya
--  se generaron con ella.
-- =====================================================================

create table if not exists public.plantillas_contrato (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  programa            text not null default 'PZD3',   -- PZD1 / PZD3 / CONADI
  labores             text,
  lugar_trabajo       text,
  dependencia_dir     text,
  jornada             numeric default 44,
  prevision           text,
  salud               text,
  incluir_bonos       boolean not null default false,
  bono_movilizacion   numeric not null default 0,
  bono_colacion       numeric not null default 0,
  ciudad              text default 'Arica',
  iniciales_redactor  text,
  sueldo_sugerido     numeric not null default 0,
  created_at          timestamptz not null default now()
);

-- Verificación:
--   select * from public.plantillas_contrato order by nombre;
