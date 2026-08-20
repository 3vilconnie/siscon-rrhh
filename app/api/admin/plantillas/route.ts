// app/api/admin/plantillas/route.ts
// Lista el estado de cada plantilla registrada (GET) y activa un reemplazo
// subido desde el panel de Admin (POST). Protegido por proxy.ts, que ya
// exige rol admin en todo /api/admin/*.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { REGISTRO } from '@/lib/validarPlantillas';

const BUCKET = 'plantillas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Email del administrador autenticado (para la auditoría). */
async function obtenerActor(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.email ?? 'Administrador';
  } catch {
    return 'Administrador';
  }
}

function rutaHistorial(archivo: string) {
  return `historial/${archivo}`;
}

export async function GET() {
  try {
    const [{ data: activos }, { data: historial }] = await Promise.all([
      supabaseAdmin.storage.from(BUCKET).list(''),
      supabaseAdmin.storage.from(BUCKET).list('historial'),
    ]);

    const plantillas = REGISTRO.map(({ archivo, libFuente }) => {
      const activo = activos?.find((f) => f.name === archivo);
      const tieneHistorial = !!historial?.find((f) => f.name === archivo);
      return {
        archivo,
        libFuente,
        personalizada: !!activo,
        actualizadoEn: activo?.updated_at ?? null,
        tieneHistorial,
      };
    });

    return NextResponse.json({ plantillas });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo listar las plantillas: ${mensaje}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const file = formData.get('file');

    if (typeof archivo !== 'string' || !REGISTRO.some((r) => r.archivo === archivo)) {
      return NextResponse.json({ error: 'Plantilla desconocida.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo .docx a subir.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const tipoDocx =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Respalda la versión activa actual como "la anterior" (un solo respaldo,
    // se sobrescribe en cada reemplazo — no es una cola de versiones).
    const { data: actual } = await supabaseAdmin.storage.from(BUCKET).download(archivo);
    if (actual) {
      const bytesActuales = Buffer.from(await actual.arrayBuffer());
      await supabaseAdmin.storage.from(BUCKET).upload(rutaHistorial(archivo), bytesActuales, {
        contentType: tipoDocx,
        upsert: true,
      });
    }

    const { error: errSubida } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(archivo, bytes, { contentType: tipoDocx, upsert: true });
    if (errSubida) throw errSubida;

    await supabaseAdmin.from('auditoria').insert({
      actor: await obtenerActor(),
      accion: 'REEMPLAZAR_PLANTILLA',
      detalles: `Se activó una nueva versión de la plantilla "${archivo}".`,
    });

    return NextResponse.json({ message: 'Plantilla activada correctamente.' });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo activar la plantilla: ${mensaje}` }, { status: 500 });
  }
}
