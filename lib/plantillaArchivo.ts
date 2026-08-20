// lib/plantillaArchivo.ts
// Resuelve qué archivo .docx debe leer Carbone para una plantilla dada:
// la versión personalizada subida desde el panel de Admin (Supabase
// Storage, bucket "plantillas"), si existe, o si no, el archivo bundleado
// en /plantillas del repositorio — el mismo comportamiento de siempre.
//
// Por qué no basta con sobrescribir el archivo en /plantillas: la app corre
// en un servidor persistente, pero un futuro `git pull` + reinicio
// restauraría lo que diga el repositorio, borrando en silencio cualquier
// plantilla que un administrador haya subido. Guardar la versión activa en
// Storage la desacopla del ciclo de despliegue.
//
// carbone.render() exige una RUTA de archivo en disco, no acepta un Buffer
// en memoria (ver node_modules/carbone/lib/file.js, openTemplate). Por eso,
// cuando existe una versión en Storage, se vuelca a un archivo temporal
// antes de devolver la ruta.
//
// Solo para servidor: usa fs/path y la clave de service role.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'plantillas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface PlantillaResuelta {
  /** Ruta en disco lista para pasarle a carbone.render(). */
  ruta: string;
  /** Borra el archivo temporal, si se creó uno. Llamar siempre en un finally. */
  limpiar: () => void;
  /** true si se usó la versión personalizada de Storage; false si se usó la del repositorio. */
  personalizada: boolean;
}

/** Ruta del archivo bundleado en el repositorio (el comportamiento de siempre). */
function rutaRepositorio(archivo: string): string {
  return path.join(process.cwd(), 'plantillas', archivo);
}

/**
 * Resuelve la ruta en disco que debe usar carbone.render() para `archivo`
 * (p.ej. "contrato-trabajo.docx"). Nunca lanza: ante cualquier problema con
 * Storage, cae silenciosamente a la versión del repositorio.
 */
export async function resolverRutaPlantilla(archivo: string): Promise<PlantillaResuelta> {
  const rutaBase = rutaRepositorio(archivo);
  const sinCambios: PlantillaResuelta = { ruta: rutaBase, limpiar: () => {}, personalizada: false };

  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(archivo);
    if (error || !data) return sinCambios;

    const bytes = Buffer.from(await data.arrayBuffer());
    const rutaTemporal = path.join(os.tmpdir(), `plantilla-${crypto.randomUUID()}-${archivo}`);
    fs.writeFileSync(rutaTemporal, bytes);

    return {
      ruta: rutaTemporal,
      personalizada: true,
      limpiar: () => {
        try {
          if (fs.existsSync(rutaTemporal)) fs.unlinkSync(rutaTemporal);
        } catch {
          /* limpieza best-effort */
        }
      },
    };
  } catch {
    return sinCambios;
  }
}
