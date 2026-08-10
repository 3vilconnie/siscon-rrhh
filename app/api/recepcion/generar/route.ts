// app/api/recepcion/generar/route.ts
// Rellena la plantilla plantillas/recepcion-documentos.docx con Carbone y devuelve
// el Formulario de Recepción de Documentos como PDF o DOCX.
// Requiere runtime Node y, solo para PDF, LibreOffice instalado en el servidor.

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import type { DatosRecepcion } from '@/lib/recepcion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoPeticion {
  formato: 'pdf' | 'docx';
  datos: DatosRecepcion;
}

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

const ARCHIVO_PLANTILLA = 'recepcion-documentos.docx';

export async function POST(request: Request) {
  let cuerpo: CuerpoPeticion;
  try {
    cuerpo = (await request.json()) as CuerpoPeticion;
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  const { formato, datos } = cuerpo;

  if (!datos) {
    return NextResponse.json({ error: 'Faltan los datos del formulario.' }, { status: 400 });
  }
  if (formato !== 'pdf' && formato !== 'docx') {
    return NextResponse.json({ error: 'Formato debe ser "pdf" o "docx".' }, { status: 400 });
  }

  const rutaPlantilla = path.join(process.cwd(), 'plantillas', ARCHIVO_PLANTILLA);
  if (!fs.existsSync(rutaPlantilla)) {
    return NextResponse.json(
      { error: `No se encontró la plantilla "${ARCHIVO_PLANTILLA}" en la carpeta /plantillas.` },
      { status: 404 },
    );
  }

  try {
    const carbone = (await import('carbone')).default;

    const opciones: Record<string, unknown> = { lang: 'es-cl', timezone: 'America/Santiago' };
    if (formato === 'pdf') opciones.convertTo = 'pdf';

    const resultado: Buffer = await new Promise((resolve, reject) => {
      carbone.render(rutaPlantilla, datos, opciones, (err: Error | null, res: Buffer | string) => {
        if (err) return reject(err);
        resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
      });
    });

    const nombreArchivo = `recepcion_documentos.${formato}`;

    return new NextResponse(new Uint8Array(resultado), {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPES[formato],
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    const faltaLibreOffice =
      formato === 'pdf' && /soffice|libreoffice|could not|ENOENT|convert/i.test(mensaje);

    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. El formato Word (.docx) no requiere LibreOffice.'
          : `Error al generar el documento: ${mensaje}`,
      },
      { status: 500 },
    );
  }
}
