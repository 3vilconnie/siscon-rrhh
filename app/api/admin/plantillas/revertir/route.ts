// app/api/admin/plantillas/revertir/route.ts
// Deshace el último reemplazo de una plantilla: restaura el respaldo de
// historial/ como versión activa o, si no hay respaldo, elimina la versión
// personalizada para que el sistema vuelva a usar el archivo del repositorio.
// Protegido por proxy.ts (rol admin en todo /api/admin/*).

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { buscarEnRegistro } from '@/lib/validarPlantillas';

const BUCKET = 'plantillas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

export async function POST(request: Request) {
  try {
    const { archivo } = (await request.json()) as { archivo?: string };

    if (!archivo || !buscarEnRegistro(archivo)) {
      return NextResponse.json({ error: 'Plantilla desconocida.' }, { status: 400 });
    }

    const rutaHistorial = `historial/${archivo}`;
    const { data: respaldo } = await supabaseAdmin.storage.from(BUCKET).download(rutaHistorial);

    let detalle: string;

    if (respaldo) {
      // Hay una versión anterior personalizada: se restaura como activa.
      const bytes = Buffer.from(await respaldo.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(archivo, bytes, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });
      if (error) throw error;
      await supabaseAdmin.storage.from(BUCKET).remove([rutaHistorial]);
      detalle = `Se restauró la versión anterior de la plantilla "${archivo}".`;
    } else {
      // Sin respaldo: se elimina la personalizada para volver a la del repositorio.
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove([archivo]);
      if (error) throw error;
      detalle = `Se descartó la plantilla personalizada "${archivo}"; vuelve a usarse la versión del sistema.`;
    }

    await supabaseAdmin.from('auditoria').insert({
      actor: await obtenerActor(),
      accion: 'REVERTIR_PLANTILLA',
      detalles: detalle,
    });

    return NextResponse.json({ message: detalle });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo revertir: ${mensaje}` }, { status: 500 });
  }
}
