// app/api/contratos/generar/route.ts
// Rellena plantillas/contrato-trabajo.docx con Carbone y devuelve el Contrato de
// Trabajo de Plazo Fijo como PDF o DOCX.
// Requiere runtime Node y, solo para PDF, LibreOffice instalado en el servidor.

import { NextResponse } from 'next/server';
import { resolverRutaPlantilla } from '@/lib/plantillaArchivo';
import type { DatosContrato } from '@/lib/contrato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoPeticion {
  formato: 'pdf' | 'docx';
  datos: DatosContrato;
}

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

const ARCHIVO_PLANTILLA = 'contrato-trabajo.docx';

export async function POST(request: Request) {
  let cuerpo: CuerpoPeticion;
  try {
    cuerpo = (await request.json()) as CuerpoPeticion;
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  const { formato, datos } = cuerpo;

  if (!datos) {
    return NextResponse.json({ error: 'Faltan los datos del contrato.' }, { status: 400 });
  }
  if (formato !== 'pdf' && formato !== 'docx') {
    return NextResponse.json({ error: 'Formato debe ser "pdf" o "docx".' }, { status: 400 });
  }

  const { ruta: rutaPlantilla, limpiar } = await resolverRutaPlantilla(ARCHIVO_PLANTILLA);

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

    const nombreArchivo = `Contrato ${datos.trabajador.nombre_upper} ${datos.trabajador.apellido_p_upper} ${datos.trabajador.apellido_m_upper}.${formato}`;

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
    const faltaPlantilla = /ENOENT/.test(mensaje);

    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. El formato Word (.docx) no requiere LibreOffice.'
          : faltaPlantilla
            ? `No se encontró la plantilla "${ARCHIVO_PLANTILLA}".`
            : `Error al generar el contrato: ${mensaje}`,
      },
      { status: faltaPlantilla ? 404 : 500 },
    );
  } finally {
    limpiar();
  }
}
