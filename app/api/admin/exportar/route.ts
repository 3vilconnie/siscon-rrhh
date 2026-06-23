// app/api/admin/exportar/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OBTENER TODA LA NÓMINA PARA EXPORTACIÓN
export async function GET() {
  try {
    // Traemos todos los trabajadores con sus respectivos contratos
    const { data, error } = await supabaseAdmin
      .from('trabajadores')
      .select('rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, fecha_inicio, fecha_termino)');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}