// app/api/configuraciones/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Obtiene el email del usuario autenticado desde la cookie de sesión. */
async function obtenerActor(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    );
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.email ?? 'Administrador';
  } catch {
    return 'Administrador';
  }
}

// GET: Obtener parámetros (Accesible por cualquier usuario logueado para calcular alertas)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from('configuraciones').select('*');
    if (error) throw error;

    // Convertimos el array a un objeto clave-valor plano { ventana_meses: 15, ... }
    const configObj = data.reduce((acc: any, item: any) => {
      acc[item.clave] = item.valor;
      return acc;
    }, {});

    return NextResponse.json(configObj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Guardar modificaciones (Protegido para lógicas de administración)
export async function POST(request: Request) {
  try {
    const body = await request.json(); // Espera un objeto { ventana_meses, enfriamiento_meses, minimo_contratos }

    for (const [clave, valor] of Object.entries(body)) {
      const { error } = await supabaseAdmin.from('configuraciones').upsert({
        clave,
        valor: Number(valor),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    }

    // Registrar en Auditoría (con la service role, para no depender de RLS).
    const detalles = Object.entries(body)
      .map(([clave, valor]) => `${clave}=${Number(valor)}`)
      .join(', ');
    await supabaseAdmin.from('auditoria').insert({
      actor: await obtenerActor(),
      accion: 'MODIFICAR_CONFIGURACION',
      detalles: `Parámetros del sistema actualizados: ${detalles}`,
    });

    return NextResponse.json({ message: 'Parámetros del sistema guardados exitosamente' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
