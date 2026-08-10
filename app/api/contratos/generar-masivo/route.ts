// app/api/contratos/generar-masivo/route.ts
// Genera un contrato por trabajador desde plantillas/contrato-trabajo.docx, los
// fusiona en un solo documento (uno por página) y lo devuelve como DOCX o PDF.

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import PizZip from 'pizzip';
import type { DatosContrato } from '@/lib/contrato';
import { mergeDocxBuffers } from '@/lib/mergeDocx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoPeticion {
  formato: 'pdf' | 'docx';
  documentos: DatosContrato[];
}

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

const ARCHIVO_PLANTILLA = 'contrato-trabajo.docx';

/** Renumera los ids de dibujo (el logo se repite en cada página). */
function renumerarIdsDibujos(buf: Buffer): Buffer {
  const zip = new PizZip(buf);
  let xml = zip.file('word/document.xml')!.asText();
  let docPr = 1;
  xml = xml.replace(/<wp:docPr id="\d+"/g, () => `<wp:docPr id="${docPr++}"`);
  let cNvPr = 1;
  xml = xml.replace(/<pic:cNvPr id="\d+"/g, () => `<pic:cNvPr id="${cNvPr++}"`);
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' });
}

export async function POST(request: Request) {
  let cuerpo: CuerpoPeticion;
  try {
    cuerpo = (await request.json()) as CuerpoPeticion;
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  const { formato, documentos } = cuerpo;
  if (!Array.isArray(documentos) || documentos.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos un contrato.' }, { status: 400 });
  }
  if (formato !== 'pdf' && formato !== 'docx') {
    return NextResponse.json({ error: 'Formato debe ser "pdf" o "docx".' }, { status: 400 });
  }

  const rutaPlantilla = path.join(process.cwd(), 'plantillas', ARCHIVO_PLANTILLA);
  if (!fs.existsSync(rutaPlantilla)) {
    return NextResponse.json(
      { error: `No se encontró la plantilla "${ARCHIVO_PLANTILLA}".` },
      { status: 404 },
    );
  }

  const opciones = { lang: 'es-cl', timezone: 'America/Santiago' };
  let tempPdfSrc: string | null = null;

  try {
    const carbone = (await import('carbone')).default;

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

    const mergedDocx = renumerarIdsDibujos(mergeDocxBuffers(buffers));

    let salida: Buffer = mergedDocx;
    if (formato === 'pdf') {
      tempPdfSrc = path.join(os.tmpdir(), `contratos-masivo-${crypto.randomUUID()}.docx`);
      fs.writeFileSync(tempPdfSrc, mergedDocx);
      salida = await new Promise((resolve, reject) => {
        carbone.render(tempPdfSrc!, {}, { ...opciones, convertTo: 'pdf' }, (err, res) => {
          if (err) return reject(err);
          resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
        });
      });
    }

    const nombreArchivo = `contratos_masivo_${documentos.length}.${formato}`;
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
    const faltaLibreOffice =
      formato === 'pdf' && /soffice|libreoffice|could not|ENOENT|convert/i.test(mensaje);
    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. El formato Word (.docx) no lo requiere.'
          : `Error al generar los contratos: ${mensaje}`,
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
