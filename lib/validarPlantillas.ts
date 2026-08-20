// lib/validarPlantillas.ts
// Versión TypeScript, para uso desde rutas de servidor, de la misma lógica
// que scripts/validar-plantillas.js: compara los marcadores {d....}
// realmente escritos en un .docx contra el catálogo CAMPOS_* que la app
// documenta para esa plantilla.
//
// scripts/validar-plantillas.js se deja tal cual (sigue sirviendo como
// chequeo de línea de comandos, sin depender de que la app esté corriendo).
// Esta es una duplicación pequeña y deliberada: unificar un script
// CommonJS con una ruta de Next.js en TypeScript no vale la complejidad
// frente a un puñado de líneas de lógica ya estable.
//
// Solo para servidor: usa fs/path. No importar desde un componente cliente.

import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const RAIZ = process.cwd();

export interface EntradaRegistro {
  archivo: string;
  libFuente: string;
  campos: string;
}

/**
 * Cada plantilla real (la que efectivamente lee una ruta /generar) se
 * asocia al archivo lib/*.ts que documenta sus marcadores en un array
 * CAMPOS_*. Si agregas una plantilla nueva, súmala aquí (y en el REGISTRO
 * equivalente de scripts/validar-plantillas.js).
 */
export const REGISTRO: EntradaRegistro[] = [
  { archivo: 'contrato-trabajo.docx', libFuente: 'lib/contrato.ts', campos: 'CAMPOS_CONTRATO' },
  // El Anexo de Ampliación usa la misma estructura de datos que el contrato
  // (DatosContrato), más el bloque {d.anexo.*}.
  { archivo: 'anexo-ampliacion.docx', libFuente: 'lib/contrato.ts', campos: 'CAMPOS_CONTRATO' },
  { archivo: 'finiquito.docx', libFuente: 'lib/finiquito.ts', campos: 'CAMPOS_FINIQUITO' },
  {
    archivo: 'anexo-horas-extra.docx',
    libFuente: 'lib/horasExtra.ts',
    campos: 'CAMPOS_HORAS_EXTRA',
  },
  {
    archivo: 'horas-compensatorias.docx',
    libFuente: 'lib/horasCompensatorias.ts',
    campos: 'CAMPOS_HORAS',
  },
  {
    archivo: 'recepcion-documentos.docx',
    libFuente: 'lib/recepcion.ts',
    campos: 'CAMPOS_RECEPCION',
  },
  // certificado-antiguedad.docx y notificacion-fin-contrato.docx comparten un
  // único catálogo de marcadores (ver lib/plantillas.ts): la notificación usa
  // algunos campos extra que el certificado no necesita, pero no al revés,
  // así que validar ambas contra el catálogo completo no genera falsos avisos.
  {
    archivo: 'certificado-antiguedad.docx',
    libFuente: 'lib/plantillas.ts',
    campos: 'CAMPOS_DISPONIBLES',
  },
  {
    archivo: 'notificacion-fin-contrato.docx',
    libFuente: 'lib/plantillas.ts',
    campos: 'CAMPOS_DISPONIBLES',
  },
];

// Reconoce un token {d.algo.algo[i]:formato(...)}, tanto en el .docx como
// dentro de los strings "marcador" de los catálogos CAMPOS_* (algunas
// entradas documentan dos marcadores juntos en un solo string, p.ej.
// '{d.trabajador.rut_miles} - {d.trabajador.dv}', así que ambos lados se
// procesan con el mismo extractor en vez de asumir "un string = un tag").
const REGEX_TAG = /\{d\.[a-zA-Z0-9_.]+(?:\[[^\]]*\])?(?::[^}]*)?\}/g;

/** Extrae los strings `marcador: '...'` (o "...") de un array CAMPOS_* leyendo el .ts como texto. */
export function extraerCamposDesdeArchivo(rutaLib: string, nombreConstante: string): string[] {
  const contenido = fs.readFileSync(path.join(RAIZ, rutaLib), 'utf-8');

  const inicioConstante = contenido.indexOf(nombreConstante);
  if (inicioConstante === -1) {
    throw new Error(`No se encontró "${nombreConstante}" en ${rutaLib}.`);
  }
  // Se recorta desde la constante hasta el cierre `];` del array que la sigue,
  // para no capturar marcadores de otro catálogo si el archivo tiene más de uno.
  const cierre = contenido.indexOf('\n];', inicioConstante);
  const bloque = contenido.slice(inicioConstante, cierre === -1 ? undefined : cierre);

  const regexMarcador = /marcador:\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regexMarcador.exec(bloque))) {
    const valor = m[2];
    const tagsDelValor = valor.match(REGEX_TAG);
    if (tagsDelValor) tags.push(...tagsDelValor);
  }
  return tags;
}

/** Reduce un marcador a su ruta base: quita formato Carbone (:formatX(...)) e índices ([i], [0]). */
export function normalizarRuta(marcadorConLlaves: string): string {
  const sinLlaves = marcadorConLlaves.replace(/^\{/, '').replace(/\}$/, '');
  const sinFormato = sinLlaves.split(':')[0];
  const sinIndices = sinFormato.replace(/\[[^\]]*\]/g, '');
  return sinIndices.trim();
}

/**
 * Extrae los marcadores {d....} realmente escritos dentro de un .docx (todas
 * las partes XML del documento). Acepta tanto una ruta en disco como un
 * Buffer en memoria (necesario para validar un archivo recién subido, antes
 * de guardarlo en ningún lado).
 */
export function extraerMarcadoresDeDocx(origen: string | Buffer): string[] {
  const bytes = Buffer.isBuffer(origen) ? origen : fs.readFileSync(origen);
  const zip = new PizZip(bytes);
  const partesXml = Object.keys(zip.files).filter((f) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(f),
  );

  const encontrados = new Set<string>();
  for (const parte of partesXml) {
    const xml = zip.files[parte].asText();
    // Word suele partir un mismo marcador en varias etiquetas <w:t> (p.ej. por
    // el corrector ortográfico). Quitar las etiquetas XML reconstruye el texto
    // corrido.
    const textoPlano = xml.replace(/<[^>]+>/g, '');
    const encontradosEnParte = textoPlano.match(REGEX_TAG);
    if (encontradosEnParte) {
      for (const tag of encontradosEnParte) encontrados.add(tag);
    }
  }
  return [...encontrados];
}

export interface ResultadoValidacion {
  archivo: string;
  libFuente: string;
  totalEnDocx: number;
  noReconocidos: string[];
  noUtilizados: string[];
}

/** Valida un .docx (ruta o Buffer) contra el catálogo CAMPOS_* de una entrada del REGISTRO. */
export function validarPlantilla(
  origen: string | Buffer,
  { archivo, libFuente, campos }: EntradaRegistro,
): ResultadoValidacion {
  const camposConocidos = extraerCamposDesdeArchivo(libFuente, campos);
  const rutasConocidas = new Set(camposConocidos.map(normalizarRuta));

  const marcadoresEnDocx = extraerMarcadoresDeDocx(origen);
  const noReconocidos = marcadoresEnDocx.filter((tag) => !rutasConocidas.has(normalizarRuta(tag)));

  const rutasUsadas = new Set(marcadoresEnDocx.map(normalizarRuta));
  const noUtilizados = camposConocidos.filter((c) => !rutasUsadas.has(normalizarRuta(c)));

  return { archivo, libFuente, totalEnDocx: marcadoresEnDocx.length, noReconocidos, noUtilizados };
}

/** Busca una entrada del REGISTRO por nombre de archivo. */
export function buscarEnRegistro(archivo: string): EntradaRegistro | undefined {
  return REGISTRO.find((r) => r.archivo === archivo);
}
