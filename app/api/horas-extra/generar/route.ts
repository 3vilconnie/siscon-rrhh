// app/api/horas-extra/generar/route.ts
// Genera el Anexo de Contrato por horas extraordinarias desde
// plantillas/anexo-horas-extra.docx.
//
// Acepta uno o varios trabajadores en la misma petición: con uno devuelve el
// documento suelto, con varios los fusiona en un solo archivo (uno por página),
// que es como se venía usando la combinación de correspondencia en Word.
// Requiere runtime Node y, solo para PDF, LibreOffice instalado en el servidor.

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import PizZip from 'pizzip';
import type { DatosHorasExtra } from '@/lib/horasExtra';
import { mergeDocxBuffers } from '@/lib/mergeDocx';
import { resolverRutaPlantilla } from '@/lib/plantillaArchivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoPeticion {
  formato: 'pdf' | 'docx';
  documentos: DatosHorasExtra[];
}

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

const ARCHIVO_PLANTILLA = 'anexo-horas-extra.docx';

/** Renumera los ids de dibujo (el logo se repite en cada página al fusionar). */
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
    return NextResponse.json({ error: 'Agrega al menos un trabajador.' }, { status: 400 });
  }
  if (formato !== 'pdf' && formato !== 'docx') {
    return NextResponse.json({ error: 'Formato debe ser "pdf" o "docx".' }, { status: 400 });
  }

  const { ruta: rutaPlantilla, limpiar } = await resolverRutaPlantilla(ARCHIVO_PLANTILLA);
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

    // Con un solo documento no hace falta fusionar ni renumerar nada.
    const docx = buffers.length === 1 ? buffers[0] : renumerarIdsDibujos(mergeDocxBuffers(buffers));

    let salida: Buffer = docx;
    if (formato === 'pdf') {
      tempPdfSrc = path.join(os.tmpdir(), `horas-extra-${crypto.randomUUID()}.docx`);
      fs.writeFileSync(tempPdfSrc, docx);
      salida = await new Promise((resolve, reject) => {
        carbone.render(tempPdfSrc!, {}, { ...opciones, convertTo: 'pdf' }, (err, res) => {
          if (err) return reject(err);
          resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
        });
      });
    }

    const nombreArchivo =
      documentos.length === 1
        ? `anexo_horas_extra_${documentos[0].trabajador.rut_miles.replace(/\./g, '')}.${formato}`
        : `anexos_horas_extra_${documentos.length}.${formato}`;

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
    const faltaPlantilla = /ENOENT/.test(mensaje);
    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. El formato Word (.docx) no lo requiere.'
          : faltaPlantilla
            ? `No se encontró la plantilla "${ARCHIVO_PLANTILLA}".`
            : `Error al generar los anexos: ${mensaje}`,
      },
      { status: faltaPlantilla ? 404 : 500 },
    );
  } finally {
    limpiar();
    if (tempPdfSrc && fs.existsSync(tempPdfSrc)) {
      try {
        fs.unlinkSync(tempPdfSrc);
      } catch {
        /* limpieza best-effort */
      }
    }
  }
}
