-- =====================================================================
--  Auditoría automática a nivel de base de datos (Supabase / PostgreSQL)
-- =====================================================================
--  Registra en la tabla "auditoria" TODO INSERT / UPDATE / DELETE sobre las
--  tablas de datos, sin depender de que la aplicación lo haga. Captura al
--  usuario real (email del JWT) como "actor".
--
--  Cómo usarlo:
--    1. Abre Supabase -> SQL Editor.
--    2. Pega TODO este archivo y ejecútalo (Run). Es idempotente: se puede
--       volver a correr sin duplicar nada.
--    3. Verifica con las consultas del final.
--
--  Para revertirlo, ve al bloque "ROLLBACK" del final.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Función genérica que inserta el registro de auditoría.
--    SECURITY DEFINER: se ejecuta con privilegios del dueño de la función,
--    así el insert en "auditoria" funciona aunque el usuario tenga RLS.
-- ---------------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_claims text;
  v_actor  text;
  v_fila   jsonb;
  v_id     text;
begin
  -- Actor: email del usuario autenticado (JWT de PostgREST); si no hay JWT
  -- (por ejemplo, cambios hechos con la service role o desde el editor SQL),
  -- se usa el uid o "sistema".
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null and v_claims <> '' then
    v_actor := coalesce(
      v_claims::jsonb ->> 'email',
      v_claims::jsonb ->> 'sub',
      'usuario'
    );
  else
    begin
      v_actor := coalesce(auth.uid()::text, 'sistema');
    exception when others then
      v_actor := 'sistema';
    end;
  end if;

  -- Fila afectada (la nueva en INSERT/UPDATE, la anterior en DELETE).
  if (tg_op = 'DELETE') then
    v_fila := to_jsonb(old);
  else
    v_fila := to_jsonb(new);
  end if;

  -- Identificador legible de la fila según la tabla.
  v_id := coalesce(
    v_fila ->> 'id',
    v_fila ->> 'rut',
    v_fila ->> 'trabajador_rut',
    v_fila ->> 'clave',
    '¿?'
  );

  insert into public.auditoria (actor, accion, detalles)
  values (
    v_actor,
    upper(tg_op || '_' || tg_table_name),         -- p.ej. INSERT_CONTRATOS
    format('%s id=%s | %s', tg_table_name, v_id, v_fila::text)
  );

  return null; -- trigger AFTER: el valor de retorno se ignora
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Adjuntar el trigger a cada tabla de datos.
--    Se re-crea el trigger (drop + create) para que sea idempotente.
--    En UPDATE solo dispara si algún dato cambió realmente.
-- ---------------------------------------------------------------------

-- trabajadores
drop trigger if exists trg_auditoria on public.trabajadores;
create trigger trg_auditoria
  after insert or delete on public.trabajadores
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria_upd on public.trabajadores;
create trigger trg_auditoria_upd
  after update on public.trabajadores
  for each row when (old.* is distinct from new.*)
  execute function public.registrar_auditoria();

-- contratos
drop trigger if exists trg_auditoria on public.contratos;
create trigger trg_auditoria
  after insert or delete on public.contratos
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria_upd on public.contratos;
create trigger trg_auditoria_upd
  after update on public.contratos
  for each row when (old.* is distinct from new.*)
  execute function public.registrar_auditoria();

-- registros_horas_compensatorias
drop trigger if exists trg_auditoria on public.registros_horas_compensatorias;
create trigger trg_auditoria
  after insert or delete on public.registros_horas_compensatorias
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria_upd on public.registros_horas_compensatorias;
create trigger trg_auditoria_upd
  after update on public.registros_horas_compensatorias
  for each row when (old.* is distinct from new.*)
  execute function public.registrar_auditoria();

-- configuraciones (parámetros del sistema)
drop trigger if exists trg_auditoria on public.configuraciones;
create trigger trg_auditoria
  after insert or delete on public.configuraciones
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria_upd on public.configuraciones;
create trigger trg_auditoria_upd
  after update on public.configuraciones
  for each row when (old.* is distinct from new.*)
  execute function public.registrar_auditoria();

-- =====================================================================
-- VERIFICACIÓN (ejecutar por separado tras aplicar lo de arriba)
-- =====================================================================
-- a) ¿Quedaron creados los triggers?
--    select event_object_table, trigger_name, action_timing, event_manipulation
--    from information_schema.triggers
--    where trigger_name like 'trg_auditoria%'
--    order by event_object_table;
--
-- b) Prueba rápida: edita un trabajador o crea un contrato desde la app y luego:
--    select creado_en, actor, accion, detalles
--    from public.auditoria order by creado_en desc limit 20;

-- =====================================================================
-- ROLLBACK (para desactivar la auditoría automática)
-- =====================================================================
-- drop trigger if exists trg_auditoria on public.trabajadores;
-- drop trigger if exists trg_auditoria_upd on public.trabajadores;
-- drop trigger if exists trg_auditoria on public.contratos;
-- drop trigger if exists trg_auditoria_upd on public.contratos;
-- drop trigger if exists trg_auditoria on public.registros_horas_compensatorias;
-- drop trigger if exists trg_auditoria_upd on public.registros_horas_compensatorias;
-- drop trigger if exists trg_auditoria on public.configuraciones;
-- drop trigger if exists trg_auditoria_upd on public.configuraciones;
-- drop function if exists public.registrar_auditoria();
