// app/api/admin/plantillas/validar/route.ts
// Valida un .docx recién subido (sin guardarlo en ningún lado) contra el
// catálogo de marcadores conocidos para esa plantilla. Protegido por
// proxy.ts (rol admin en todo /api/admin/*).

import { NextResponse } from 'next/server';
import { buscarEnRegistro, validarPlantilla } from '@/lib/validarPlantillas';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const file = formData.get('file');

    if (typeof archivo !== 'string') {
      return NextResponse.json({ error: 'Falta indicar qué plantilla es.' }, { status: 400 });
    }
    const entrada = buscarEnRegistro(archivo);
    if (!entrada) {
      return NextResponse.json({ error: 'Plantilla desconocida.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo .docx a validar.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const resultado = validarPlantilla(bytes, entrada);

    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo validar la plantilla: ${mensaje}` }, { status: 500 });
  }
}
