// app/api/admin/auditoria/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OBTENER LOS ÚLTIMOS 50 REGISTROS DE AUDITORÍA
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('auditoria')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(50); // Traemos los 50 eventos más recientes para no saturar la vista

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}