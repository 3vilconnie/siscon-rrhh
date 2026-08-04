// app/api/documentos/generar-masivo/route.ts
// Genera una notificación por trabajador desde la misma plantilla, las fusiona
// en un solo documento (una por página) y lo devuelve como DOCX o PDF.

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { PLANTILLAS, type DatosDocumento } from '@/lib/plantillas';
import { mergeDocxBuffers } from '@/lib/mergeDocx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoPeticion {
  plantillaId: string;
  formato: 'pdf' | 'docx';
  documentos: DatosDocumento[];
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

  const { plantillaId, formato, documentos } = cuerpo;

  if (!plantillaId || !Array.isArray(documentos) || documentos.length === 0) {
    return NextResponse.json(
      { error: 'Faltan datos: plantillaId y al menos un documento.' },
      { status: 400 },
    );
  }
  if (formato !== 'pdf' && formato !== 'docx') {
    return NextResponse.json({ error: 'Formato debe ser "pdf" o "docx".' }, { status: 400 });
  }

  const plantilla = PLANTILLAS.find((p) => p.id === plantillaId);
  if (!plantilla) {
    return NextResponse.json({ error: `Plantilla desconocida: ${plantillaId}` }, { status: 404 });
  }

  const rutaPlantilla = path.join(process.cwd(), 'plantillas', plantilla.archivo);
  if (!fs.existsSync(rutaPlantilla)) {
    return NextResponse.json(
      { error: `No se encontró el archivo de plantilla "${plantilla.archivo}".` },
      { status: 404 },
    );
  }

  const opciones = { lang: 'es-cl', timezone: 'America/Santiago' };
  let tempPdfSrc: string | null = null;

  try {
    const carbone = (await import('carbone')).default;

    // 1) Renderizar un .docx por trabajador.
    const buffers: Buffer[] = [];
    for (const datos of documentos) {
      const buf: Buffer = await new Promise((resolve, reject) => {
        carbone.render(rutaPlantilla, datos, opciones, (err, res) => {
          if (err) return reject(err);
          resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
        });
      });
      buffers.push(buf);
    }

    // 2) Fusionar en un solo .docx (una notificación por página).
    const mergedDocx = mergeDocxBuffers(buffers);

    // 3) DOCX: devolver directo. PDF: convertir el documento fusionado con LibreOffice.
    let salida: Buffer = mergedDocx;
    if (formato === 'pdf') {
      tempPdfSrc = path.join(os.tmpdir(), `notif-masiva-${crypto.randomUUID()}.docx`);
      fs.writeFileSync(tempPdfSrc, mergedDocx);
      salida = await new Promise((resolve, reject) => {
        carbone.render(tempPdfSrc!, {}, { ...opciones, convertTo: 'pdf' }, (err, res) => {
          if (err) return reject(err);
          resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
        });
      });
    }

    const nombreArchivo = `${plantilla.id}_masiva_${documentos.length}.${formato}`;
    return new NextResponse(new Uint8Array(salida), {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPES[formato],
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    const faltaLibreOffice = formato === 'pdf' && /soffice|libreoffice|could not|ENOENT|convert/i.test(mensaje);
    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. El formato Word (.docx) no lo requiere.'
          : `Error al generar los documentos: ${mensaje}`,
      },
      { status: 500 },
    );
  } finally {
    if (tempPdfSrc && fs.existsSync(tempPdfSrc)) {
      try {
        fs.unlinkSync(tempPdfSrc);
      } catch {
        /* limpieza best-effort */
      }
    }
  }
}
