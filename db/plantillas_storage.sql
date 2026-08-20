-- =====================================================================
--  Bucket de Storage para las plantillas .docx activas (contrato, finiquito,
--  horas compensatorias, recepción, notificaciones, certificados).
-- =====================================================================
--  Permite reemplazar una plantilla desde el panel de Admin sin editar el
--  archivo a mano ni desplegar por git. Es privado: el servidor accede con
--  la clave de service role (igual que ya hace app/api/admin/usuarios), por
--  lo que NO se necesitan políticas RLS sobre storage.objects — el service
--  role las salta igual que ya hace hoy con auth.admin.*.
--
--  Estructura de objetos dentro del bucket:
--    <archivo>.docx                    -> versión activa actual
--    historial/<archivo>-<timestamp>   -> respaldo de la versión anterior
--
--  Mientras nadie suba nada, las rutas /generar siguen usando el archivo
--  del repositorio (plantillas/*.docx) tal como hoy — ver lib/plantillaArchivo.ts.
-- =====================================================================
--  Ejecutar una vez en Supabase -> SQL Editor. Es idempotente.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('plantillas', 'plantillas', false)
on conflict (id) do nothing;

-- Verificación:
--   select * from storage.buckets where id = 'plantillas';
