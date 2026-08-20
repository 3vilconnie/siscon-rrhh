// app/api/admin/plantillas/probar/route.ts
// Genera un documento de prueba con el .docx recién subido (sin activarlo),
// usando el trabajador ficticio de lib/datosPrueba.ts. Permite revisar
// visualmente márgenes, formatos de fecha y montos antes de que la plantilla
// nueva empiece a usarse en documentos reales.
//
// carbone.render() exige una ruta en disco, así que el archivo subido se
// vuelca a un temporal y se borra al terminar.

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { buscarEnRegistro } from '@/lib/validarPlantillas';
import { datosPruebaPara } from '@/lib/datosPrueba';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export async function POST(request: Request) {
  let rutaTemporal: string | null = null;

  try {
    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const file = formData.get('file');
    const formato = formData.get('formato') === 'pdf' ? 'pdf' : 'docx';

    if (typeof archivo !== 'string' || !buscarEnRegistro(archivo)) {
      return NextResponse.json({ error: 'Plantilla desconocida.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo .docx a probar.' }, { status: 400 });
    }

    const datos = datosPruebaPara(archivo);

    const bytes = Buffer.from(await file.arrayBuffer());
    rutaTemporal = path.join(os.tmpdir(), `prueba-${crypto.randomUUID()}-${archivo}`);
    fs.writeFileSync(rutaTemporal, bytes);

    const carbone = (await import('carbone')).default;
    const opciones: Record<string, unknown> = { lang: 'es-cl', timezone: 'America/Santiago' };
    if (formato === 'pdf') opciones.convertTo = 'pdf';

    const resultado: Buffer = await new Promise((resolve, reject) => {
      carbone.render(rutaTemporal!, datos, opciones, (err: Error | null, res: Buffer | string) => {
        if (err) return reject(err);
        resolve(Buffer.isBuffer(res) ? res : Buffer.from(res));
      });
    });

    return new NextResponse(new Uint8Array(resultado), {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPES[formato],
        'Content-Disposition': `attachment; filename="PRUEBA_${archivo.replace(/\.docx$/, '')}.${formato}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    const faltaLibreOffice = /soffice|libreoffice|could not|convert/i.test(mensaje);
    return NextResponse.json(
      {
        error: faltaLibreOffice
          ? 'No se pudo convertir a PDF. Verifica que LibreOffice esté instalado en el servidor. La prueba en formato Word (.docx) no lo requiere.'
          : `No se pudo generar el documento de prueba: ${mensaje}`,
      },
      { status: 500 },
    );
  } finally {
    if (rutaTemporal && fs.existsSync(rutaTemporal)) {
      try {
        fs.unlinkSync(rutaTemporal);
      } catch {
        /* limpieza best-effort */
      }
    }
  }
}
