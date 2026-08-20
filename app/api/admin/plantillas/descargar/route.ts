// app/api/admin/plantillas/descargar/route.ts
// Devuelve el .docx que el sistema está usando actualmente para una
// plantilla (la personalizada de Storage o, si no hay, la del repositorio),
// para que el administrador la abra en Word, la edite y la vuelva a subir.
// Protegido por proxy.ts (rol admin en todo /api/admin/*).

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { buscarEnRegistro } from '@/lib/validarPlantillas';
import { resolverRutaPlantilla } from '@/lib/plantillaArchivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const archivo = new URL(request.url).searchParams.get('archivo');

  if (!archivo || !buscarEnRegistro(archivo)) {
    return NextResponse.json({ error: 'Plantilla desconocida.' }, { status: 400 });
  }

  const { ruta, limpiar } = await resolverRutaPlantilla(archivo);

  try {
    if (!fs.existsSync(ruta)) {
      return NextResponse.json({ error: `No se encontró la plantilla "${archivo}".` }, { status: 404 });
    }
    const bytes = fs.readFileSync(ruta);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${archivo}"`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    limpiar();
  }
}
