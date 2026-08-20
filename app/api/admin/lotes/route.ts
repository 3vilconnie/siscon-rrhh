// app/api/admin/lotes/route.ts
// Historial de lotes generados. Consultar y anular son operaciones de
// AUDITORÍA: van por service role y están detrás del guardia de rol de
// proxy.ts, que exige admin en todo /api/admin/*. Las tablas `lotes` y
// `lote_items` no tienen política de SELECT, así que un usuario no
// administrador tampoco puede leerlas consultando Supabase directo.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tipo = params.get('tipo');
    const desde = params.get('desde');
    const hasta = params.get('hasta');

    let consulta = supabaseAdmin
      .from('lotes')
      .select('*, items:lote_items(*)')
      .order('generado_en', { ascending: false })
      .limit(200);

    if (tipo) consulta = consulta.eq('tipo', tipo);
    if (desde) consulta = consulta.gte('generado_en', desde);
    // "hasta" es inclusivo: se compara contra el final de ese día.
    if (hasta) consulta = consulta.lte('generado_en', `${hasta}T23:59:59.999Z`);

    const { data, error } = await consulta;
    if (error) throw error;

    return NextResponse.json({ lotes: data ?? [] });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo obtener el historial: ${mensaje}` },
      { status: 500 },
    );
  }
}

/** Anula un lote (no lo borra: el historial debe conservarse). */
export async function PATCH(request: Request) {
  try {
    const { id, motivo } = (await request.json()) as { id?: string; motivo?: string };
    if (!id) return NextResponse.json({ error: 'Falta el id del lote.' }, { status: 400 });

    const actor = await obtenerActor();
    const { error } = await supabaseAdmin
      .from('lotes')
      .update({
        estado: 'anulado',
        anulado_por: actor,
        anulado_en: new Date().toISOString(),
        motivo: motivo?.trim() || null,
      })
      .eq('id', id);
    if (error) throw error;

    await supabaseAdmin.from('auditoria').insert({
      actor,
      accion: 'ANULAR_LOTE',
      detalles: `Lote ${id} anulado${motivo?.trim() ? `: ${motivo.trim()}` : '.'}`,
    });

    return NextResponse.json({ message: 'Lote anulado.' });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo anular: ${mensaje}` }, { status: 500 });
  }
}
