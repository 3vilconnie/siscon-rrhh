-- =====================================================================
--  Amplía la tabla "contratos" para almacenar todos los datos de la
--  plantilla de contrato (personales del trabajador + propios del contrato).
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente
--  (add column if not exists), así que se puede volver a correr sin problema.
--  Todas las columnas son opcionales: los contratos existentes quedan con NULL.
-- =====================================================================

alter table public.trabajadores
  -- Datos personales del trabajador (recopilados al hacer el contrato)
  add column if not exists nacionalidad     text,
  add column if not exists estado_civil      text,
  add column if not exists lugar_nac         text,
  add column if not exists fecha_nac         date,
  add column if not exists domicilio         text,
  add column if not exists comuna            text,
  add column if not exists prevision         text,   -- AFP
  add column if not exists salud             text;   -- FONASA / Isapre

alter table public.contratos
  -- Datos propios del contrato
  add column if not exists labores           text,
  add column if not exists lugar_trabajo     text,
  add column if not exists dependencia_dir   text,
  add column if not exists programa          text,   -- PZD1 / PZD3 / CONADI
  add column if not exists bono_movilizacion numeric default 0,
  add column if not exists bono_colacion     numeric default 0;

-- Verificación:
--   select column_name, data_type
--   from information_schema.columns
--   where table_name = 'contratos'
--   order by ordinal_position;
