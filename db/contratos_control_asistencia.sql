-- =====================================================================
--  Método de control de asistencia del contrato (cláusula SEGUNDO).
-- =====================================================================
--  Determina con qué frase se redacta la obligación de registrar entrada
--  y salida en el contrato:
--    'biometrico' -> "reloj biométrico geovictoria box"
--    'libro'      -> "libro de asistencia para este efecto"
--
--  Se guarda el CÓDIGO, no la frase: el texto final lo resuelve
--  construirDatosContrato() en lib/contrato.ts. Así, si algún día cambia
--  la redacción, se ajusta en un solo lugar y no hay que migrar datos.
--
--  Es texto con "check" (y no un booleano) por consistencia con la
--  columna "tipo" de esta misma tabla, y para admitir un tercer método
--  futuro sin cambiar el esquema.
--
--  El default 'biometrico' deja los contratos existentes con el texto
--  que ya tenían.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente.
-- =====================================================================

alter table public.contratos
  add column if not exists control_asistencia text not null default 'biometrico';

alter table public.contratos
  drop constraint if exists contratos_control_asistencia_check;
alter table public.contratos
  add constraint contratos_control_asistencia_check
  check (control_asistencia in ('biometrico', 'libro'));

-- Mismo campo en las plantillas (moldes reutilizables), para que un tipo de
-- contrato pueda traerlo predefinido.
alter table public.plantillas_contrato
  add column if not exists control_asistencia text not null default 'biometrico';

alter table public.plantillas_contrato
  drop constraint if exists plantillas_control_asistencia_check;
alter table public.plantillas_contrato
  add constraint plantillas_control_asistencia_check
  check (control_asistencia in ('biometrico', 'libro'));

-- Verificación:
--   select control_asistencia, count(*) from public.contratos group by 1;
