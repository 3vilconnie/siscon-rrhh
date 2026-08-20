#!/usr/bin/env node
// scripts/validar-plantillas.js
//
// Valida que los marcadores {d....} escritos dentro de cada plantilla .docx
// existan realmente en el catálogo de campos que la app documenta para esa
// plantilla (CAMPOS_CONTRATO, CAMPOS_FINIQUITO, etc.). Detecta justo el tipo
// de error que un editor manual de Word introduce fácilmente: un tipeo como
// {fehca_inicio} en vez de {fecha_inicio}, o un marcador que quedó partido
// en dos fragmentos de texto por el corrector ortográfico de Word.
//
// Uso:
//   node scripts/validar-plantillas.js
//
// No requiere levantar la app ni la base de datos: solo lee los .docx de
// /plantillas y los archivos lib/*.ts como texto (no los ejecuta), así que
// no hace falta compilar TypeScript para correrlo.

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const RAIZ = path.join(__dirname, '..');
const DIR_PLANTILLAS = path.join(RAIZ, 'plantillas');

/**
 * Cada plantilla real (la que efectivamente lee una ruta /generar) se
 * asocia al archivo lib/*.ts que documenta sus marcadores en un array
 * CAMPOS_*. Si agregas una plantilla nueva, súmala aquí.
 */
const REGISTRO = [
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
function extraerCamposDesdeArchivo(rutaLib, nombreConstante) {
  const contenido = fs.readFileSync(path.join(RAIZ, rutaLib), 'utf-8');

  const inicioConstante = contenido.indexOf(`${nombreConstante}`);
  if (inicioConstante === -1) {
    throw new Error(`No se encontró "${nombreConstante}" en ${rutaLib}.`);
  }
  // Se recorta desde la constante hasta el cierre `];` del array que la sigue,
  // para no capturar marcadores de otro catálogo si el archivo tiene más de uno.
  const cierre = contenido.indexOf('\n];', inicioConstante);
  const bloque = contenido.slice(inicioConstante, cierre === -1 ? undefined : cierre);

  const regexMarcador = /marcador:\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  const tags = [];
  let m;
  while ((m = regexMarcador.exec(bloque))) {
    const valor = m[2];
    const tagsDelValor = valor.match(REGEX_TAG);
    if (tagsDelValor) {
      tags.push(...tagsDelValor);
    }
  }
  return tags;
}

/** Reduce un marcador a su ruta base: quita formato Carbone (:formatX(...)) e índices ([i], [0]). */
function normalizarRuta(marcadorConLlaves) {
  const sinLlaves = marcadorConLlaves.replace(/^\{/, '').replace(/\}$/, '');
  const sinFormato = sinLlaves.split(':')[0];
  const sinIndices = sinFormato.replace(/\[[^\]]*\]/g, '');
  return sinIndices.trim();
}

/** Extrae los marcadores {d....} realmente escritos dentro del .docx (todas las partes XML del documento). */
function extraerMarcadoresDeDocx(rutaDocx) {
  const zip = new PizZip(fs.readFileSync(rutaDocx));
  const partesXml = Object.keys(zip.files).filter((f) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(f),
  );

  const encontrados = new Set();
  for (const parte of partesXml) {
    const xml = zip.files[parte].asText();
    // Word suele partir un mismo marcador en varias etiquetas <w:t> (p.ej. por
    // el corrector ortográfico). Quitar las etiquetas XML reconstruye el texto
    // corrido, igual que ya hace la app al leer plantillas con Python/openpyxl.
    const textoPlano = xml.replace(/<[^>]+>/g, '');
    const encontradosEnParte = textoPlano.match(REGEX_TAG);
    if (encontradosEnParte) {
      for (const tag of encontradosEnParte) encontrados.add(tag);
    }
  }
  return [...encontrados];
}

function validarPlantilla({ archivo, libFuente, campos }) {
  const rutaDocx = path.join(DIR_PLANTILLAS, archivo);

  if (!fs.existsSync(rutaDocx)) {
    return { archivo, error: `El archivo no existe en /plantillas (referenciado desde ${libFuente}).` };
  }

  const camposConocidos = extraerCamposDesdeArchivo(libFuente, campos);
  const rutasConocidas = new Set(camposConocidos.map(normalizarRuta));

  const marcadoresEnDocx = extraerMarcadoresDeDocx(rutaDocx);
  const noReconocidos = marcadoresEnDocx.filter((tag) => !rutasConocidas.has(normalizarRuta(tag)));

  const rutasUsadas = new Set(marcadoresEnDocx.map(normalizarRuta));
  const noUtilizados = camposConocidos.filter((c) => !rutasUsadas.has(normalizarRuta(c)));

  return {
    archivo,
    libFuente,
    totalEnDocx: marcadoresEnDocx.length,
    noReconocidos,
    noUtilizados,
  };
}

function main() {
  console.log('Validando marcadores de plantillas Word...\n');

  let huboErrores = false;
  const archivosRegistrados = new Set(REGISTRO.map((r) => r.archivo));

  for (const entrada of REGISTRO) {
    const resultado = validarPlantilla(entrada);

    if (resultado.error) {
      huboErrores = true;
      console.log(`✗ ${resultado.archivo}`);
      console.log(`  ${resultado.error}\n`);
      continue;
    }

    if (resultado.noReconocidos.length === 0) {
      console.log(`✓ ${resultado.archivo} — ${resultado.totalEnDocx} marcador(es), todos reconocidos.`);
    } else {
      huboErrores = true;
      console.log(`✗ ${resultado.archivo} — marcador(es) no reconocidos:`);
      for (const tag of resultado.noReconocidos) {
        console.log(`    ${tag}`);
      }
      console.log(`  Revisa ${resultado.libFuente} (¿typo, o falta agregarlo al catálogo?)`);
    }

    if (resultado.noUtilizados.length > 0) {
      console.log(
        `  (info) ${resultado.noUtilizados.length} campo(s) documentado(s) en ${resultado.libFuente} que esta plantilla no usa — normal si no aplican a este documento.`,
      );
    }
    console.log('');
  }

  // Aviso informativo: archivos .docx sueltos en /plantillas que ningún
  // generar/route.ts ni lib/plantillas.ts referencia (p.ej. un ejemplo de
  // trabajo, o una plantilla nueva que aún no se registró aquí arriba).
  const archivosEnCarpeta = fs
    .readdirSync(DIR_PLANTILLAS)
    .filter((f) => f.endsWith('.docx') && !f.startsWith('~$'));
  const sinRegistrar = archivosEnCarpeta.filter((f) => !archivosRegistrados.has(f));
  if (sinRegistrar.length > 0) {
    console.log('(info) Archivos .docx en /plantillas sin registrar en este validador:');
    for (const f of sinRegistrar) console.log(`    ${f}`);
    console.log('');
  }

  if (huboErrores) {
    console.log('Resultado: se encontraron problemas. Revísalos antes de dar por buena la plantilla.');
    process.exit(1);
  } else {
    console.log('Resultado: todas las plantillas registradas están en orden.');
  }
}

main();
