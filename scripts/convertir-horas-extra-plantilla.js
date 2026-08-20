#!/usr/bin/env node
// scripts/convertir-horas-extra-plantilla.js
//
// Convierte "Plantilla horas extras.docm" (combinación de correspondencia de
// Word) en "plantillas/anexo-horas-extra.docx", con marcadores {d....} que
// entiende Carbone.
//
// Se ejecutó UNA vez para crear la plantilla; queda versionado para poder
// regenerarla si el documento original cambia:
//   node scripts/convertir-horas-extra-plantilla.js "<ruta al .docm original>"
//
// Comparte la mecánica con scripts/convertir-anexo-plantilla.js (ver ahí la
// explicación de cómo se recorren los runs de un campo de combinación). Dos
// particularidades de este documento:
//
//   1. Viene como .docm pero NO tiene macros (no hay word/vbaProject.bin), así
//      que basta con corregir el content-type de la parte principal para que
//      sea un .docx válido.
//   2. El original trae un campo mal escrito: "IF MERGFIELD GENERO" (sin la E).
//      Word no lo resuelve y lo imprime como "¡Error! Marcador no definido.".
//      El conversor lo reconoce igual y lo corrige.

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ORIGEN =
  process.argv[2] ||
  'C:\\Users\\Constanza.Ramos\\Documents\\PLANTILLA ANEXO CONTRATO\\Anexo horas extra\\Plantilla horas extras.docm';
const DESTINO = path.join(__dirname, '..', 'plantillas', 'anexo-horas-extra.docx');

/**
 * Traduce la instrucción completa de un campo al marcador Carbone equivalente.
 * Devuelve null si no se reconoce (se deja el campo intacto para no romper nada).
 */
function marcadorPara(instruccion) {
  const t = instruccion.replace(/\s+/g, ' ').trim();

  // Condicionales por género. Se acepta MERGFIELD además de MERGEFIELD porque
  // el documento original tiene esa errata en el primer "el/la".
  if (/MERGE?FIELD\s+GENERO/.test(t)) {
    if (/= "F" "la" "el"/.test(t)) return '{d.g.el_la}';
    if (/= "F" "a" "o"/.test(t)) return '{d.g.genero_o_a}';
    if (/= "F" "a" ""/.test(t)) return '{d.g.genero_a}';
    return null;
  }

  // Encabezado y datos del documento.
  if (/MERGEFIELD\s+INICIALES/.test(t)) return '{d.documento.redactor_iniciales}';
  if (/MERGEFIELD\s+FECHA_EMIS/.test(t)) return '{d.documento.fecha_emision:formatD(LL)}';

  // Datos del trabajador.
  if (/MERGEFIELD\s+NOMBRE/.test(t)) return '{d.trabajador.nombre_upper}';
  if (/MERGEFIELD\s+APELLIDO_P/.test(t)) return '{d.trabajador.apellido_p_upper}';
  if (/MERGEFIELD\s+APELLIDO_M/.test(t)) return '{d.trabajador.apellido_m_upper}';
  if (/MERGEFIELD\s+RUT/.test(t)) return '{d.trabajador.rut_miles}';
  if (/MERGEFIELD\s+DV/.test(t)) return '{d.trabajador.dv}';
  if (/MERGEFIELD\s+NACIONALIDAD/.test(t)) return '{d.trabajador.nacionalidad}';
  if (/MERGEFIELD\s+ESTADO_CIV/.test(t)) return '{d.trabajador.estado_civil}';
  if (/MERGEFIELD\s+DOMICILIO/.test(t)) return '{d.trabajador.domicilio}';
  // En el original el campo de ciudad perdió la palabra MERGEFIELD y quedó
  // como una instrucción suelta " CIUDAD ".
  if (/\bCIUDAD\b/.test(t)) return '{d.trabajador.comuna}';
  if (/MERGEFIELD\s+FECHA_NAC/.test(t)) return '{d.trabajador.fecha_nac:formatD(LL)}';

  // Detalle de horas. El mes se entrega ya escrito en español ("junio 2026")
  // en vez de delegarlo a un formato de fecha, para no depender del locale
  // que tenga instalado el servidor.
  if (/MERGEFIELD\s+FECHA_HORAS/.test(t)) return '{d.horas.mes_texto}';
  if (/MERGEFIELD\s+HORAS/.test(t)) return '{d.horas.total}';

  return null;
}

function escaparXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function convertir(xml) {
  const partes = xml.split(/(<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>)/);
  const salida = [];

  let profundidad = 0;
  let buffer = [];
  let instruccion = '';
  let rPrMostrado = null;
  let reemplazados = 0;
  let omitidos = 0;

  for (const parte of partes) {
    const esRun = /^<w:r(?:\s|>)/.test(parte);
    if (!esRun) {
      if (profundidad === 0) salida.push(parte);
      else buffer.push(parte);
      continue;
    }

    const abre = parte.includes('w:fldCharType="begin"');
    const separa = parte.includes('w:fldCharType="separate"');
    const cierra = parte.includes('w:fldCharType="end"');

    if (abre) {
      profundidad++;
      buffer.push(parte);
      continue;
    }

    if (profundidad === 0) {
      salida.push(parte);
      continue;
    }

    buffer.push(parte);

    const instr = [...parte.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)];
    for (const m of instr) instruccion += ' ' + m[1];

    if (separa) {
      rPrMostrado = null;
    } else if (rPrMostrado === null && /<w:t[\s>]/.test(parte) && !cierra) {
      const m = parte.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      rPrMostrado = m ? m[0] : '';
    }

    if (cierra) {
      profundidad--;
      if (profundidad === 0) {
        const marcador = marcadorPara(instruccion);
        if (marcador) {
          salida.push(
            `<w:r>${rPrMostrado ?? ''}<w:t xml:space="preserve">${escaparXml(marcador)}</w:t></w:r>`,
          );
          reemplazados++;
        } else {
          salida.push(buffer.join(''));
          omitidos++;
          console.warn('  ! campo no reconocido, se deja intacto:', instruccion.trim().slice(0, 90));
        }
        buffer = [];
        instruccion = '';
        rPrMostrado = null;
      }
    }
  }

  if (profundidad !== 0) throw new Error('Campos desbalanceados en el documento original.');
  return { xml: salida.join(''), reemplazados, omitidos };
}

function main() {
  if (!fs.existsSync(ORIGEN)) {
    console.error(`No se encontró el documento original:\n  ${ORIGEN}`);
    process.exit(1);
  }

  const zip = new PizZip(fs.readFileSync(ORIGEN));

  if (zip.file('word/vbaProject.bin')) {
    console.error('El documento tiene macros; este conversor no las conserva.');
    process.exit(1);
  }

  const original = zip.file('word/document.xml').asText();

  console.log('Convirtiendo campos de combinación a marcadores Carbone...');
  const { xml, reemplazados, omitidos } = convertir(original);
  zip.file('word/document.xml', xml);

  // .docm -> .docx: la parte principal cambia de content-type.
  const ct = zip
    .file('[Content_Types].xml')
    .asText()
    .replace(
      'application/vnd.ms-word.document.macroEnabled.main+xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    );
  zip.file('[Content_Types].xml', ct);

  // Se quita el vínculo al origen de datos: la plantilla nueva la rellena
  // Carbone, no la combinación de correspondencia de Word.
  if (zip.file('word/settings.xml')) {
    const s = zip
      .file('word/settings.xml')
      .asText()
      .replace(/<w:mailMerge>[\s\S]*?<\/w:mailMerge>/g, '');
    zip.file('word/settings.xml', s);
  }
  if (zip.file('word/recipientData.xml')) zip.remove('word/recipientData.xml');
  if (zip.file('word/_rels/settings.xml.rels')) zip.remove('word/_rels/settings.xml.rels');

  fs.writeFileSync(DESTINO, zip.generate({ type: 'nodebuffer' }));
  console.log(`  campos reemplazados: ${reemplazados}`);
  console.log(`  campos intactos    : ${omitidos}`);
  console.log(`\nPlantilla escrita en: ${DESTINO}`);
}

main();
