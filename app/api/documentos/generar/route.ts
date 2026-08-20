// app/api/documentos/generar/route.ts
// Rellena una plantilla Word con Carbone y devuelve el documento como PDF o DOCX.
// Requiere runtime Node (Carbone usa fs / child_process) y, SOLO para PDF,
// LibreOffice instalado en el servidor (Carbone lo invoca por debajo).

import { NextResponse } from 'next/server';
import { resolverRutaPlantilla } from '@/lib/plantillaArchivo';
import { PLANTILLAS, type DatosDocumento } from '@/lib/plantillas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoPeticion {
  plantillaId: string;
  formato: 'pdf' | 'docx';
  datos: DatosDocumento;
}

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export async function POST(request: Request) {
  let cuerpo: CuerpoPeticion;
  try {
    cuerpo = (await request.json()) as CuerpoPeticion;
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  const { plantillaId, formato, datos } = cuerpo;

  if (!plantillaId || !datos) {
    return NextResponse.json({ error: 'Faltan datos: plantillaId y datos.' }, { status: 400 });
  }
  if (formato !== 'pdf' && formato !== 'docx') {
    return NextResponse.json({ error: 'Formato debe ser "pdf" o "docx".' }, { status: 400 });
  }

  const plantilla = PLANTILLAS.find((p) => p.id === plantillaId);
  if (!plantilla) {
    return NextResponse.json({ error: `Plantilla desconocida: ${plantillaId}` }, { status: 404 });
  }

  const { ruta: rutaPlantilla, limpiar } = await resolverRutaPlantilla(plantilla.archivo);

  try {
    // Import dinámico para mantener Carbone fuera del bundle del cliente.
    const carbone = (await import('carbone')).default;

    const opciones: Record<string, unknown> = { lang: 'es-cl', timezone: 'America/Santiago' };
    if (formato === 'pdf') opciones.convertTo = 'pdf';

    const resultado: Buffer = await new Promise((resolve, reject) => {
      carbone.render(rutaPlantilla, datos, opciones, (err: Error | null, res: Buffer | string) => {
        if (err) return reject(err);
        resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
      });
    });

    const nombreArchivo = `${plantilla.id}_${datos.trabajador?.rut ?? 'documento'}.${formato}`;

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
    // Error típico cuando falta LibreOffice y se pidió PDF.
    const faltaLibreOffice =
      formato === 'pdf' &&
      /soffice|libreoffice|could not|ENOENT|convert/i.test(mensaje);
    const faltaPlantilla = /ENOENT/.test(mensaje);

    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. El formato Word (.docx) no requiere LibreOffice.'
          : faltaPlantilla
            ? `No se encontró el archivo de plantilla "${plantilla.archivo}".`
            : `Error al generar el documento: ${mensaje}`,
      },
      { status: faltaPlantilla ? 404 : 500 },
    );
  } finally {
    limpiar();
  }
}
