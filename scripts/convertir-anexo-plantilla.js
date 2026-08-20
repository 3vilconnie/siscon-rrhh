#!/usr/bin/env node
// scripts/convertir-anexo-plantilla.js
//
// Convierte "AMPLIACION DE CONTRATO.docx" (plantilla de combinación de
// correspondencia de Word) en "plantillas/anexo-ampliacion.docx", con
// marcadores {d....} que entiende Carbone.
//
// Se ejecutó UNA vez para crear la plantilla; queda versionado para poder
// regenerarla si el documento original cambia:
//   node scripts/convertir-anexo-plantilla.js "<ruta al .docx original>"
//
// Cómo funciona: un campo de combinación en Word es una secuencia de runs
//   <w:r>…fldChar begin…</w:r> <w:r>…instrText…</w:r> …
//   <w:r>…fldChar separate…</w:r> <w:r>…<w:t>«CAMPO»</w:t></w:r>
//   <w:r>…fldChar end…</w:r>
// Los IF pueden anidar campos dentro, así que se lleva un contador de
// profundidad y solo se reemplazan los campos de nivel superior completos.
// El run de reemplazo hereda el <w:rPr> del run que mostraba el resultado,
// para conservar negritas, fuente y tamaño del documento original.

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ORIGEN =
  process.argv[2] ||
  'C:\\Users\\Constanza.Ramos\\Documents\\PLANTILLA ANEXO CONTRATO\\Anexo ampliación de contrato\\AMPLIACION DE CONTRATO.docx';
const DESTINO = path.join(__dirname, '..', 'plantillas', 'anexo-ampliacion.docx');

/**
 * Traduce la instrucción completa de un campo al marcador Carbone equivalente.
 * Devuelve null si no se reconoce (se deja el campo intacto para no romper nada).
 */
function marcadorPara(instruccion) {
  const t = instruccion.replace(/\s+/g, ' ').trim();

  // CABECERA: IF anidados que mapean PZD1/PZD3/CONADI al párrafo del proyecto.
  // En el sistema ese texto ya vive en PROGRAMAS_CONTRATO (lib/contrato.ts).
  if (/MERGEFIELD\s+CABECERA/.test(t)) return '{d.programa.proyecto}';

  // Condicionales por género: el texto ya viene resuelto en los datos.
  if (/MERGEFIELD\s+GENERO/.test(t)) {
    if (/= "F" "Doña" "Don"/.test(t)) return '{d.trabajador.trato}';
    if (/= "F" "la" "el"/.test(t)) return '{d.g.el_la}';
    if (/= "F" "a" ""/.test(t)) return '{d.g.genero_a}';
    return null;
  }

  // Campos simples.
  if (/MERGEFIELD\s+NOMBRE/.test(t)) return '{d.trabajador.nombre_upper}';
  if (/MERGEFIELD\s+APELLIDO_P/.test(t)) return '{d.trabajador.apellido_p_upper}';
  if (/MERGEFIELD\s+APELLIDO_M/.test(t)) return '{d.trabajador.apellido_m_upper}';
  if (/MERGEFIELD\s+RUT/.test(t)) return '{d.trabajador.rut_miles}';
  if (/MERGEFIELD\s+DV/.test(t)) return '{d.trabajador.dv}';
  if (/MERGEFIELD\s+DIRECCION/.test(t)) return '{d.trabajador.domicilio}';

  // Fechas: el formato \@ "d 'de' MMMM 'de' yyyy" equivale a formatD(LL).
  if (/MERGEFIELD\s+INICIO_CONT/.test(t)) return '{d.anexo.inicio_original:formatD(LL)}';
  if (/MERGEFIELD\s+NUEVO_INI/.test(t)) return '{d.anexo.nuevo_inicio:formatD(LL)}';
  // El nombre quedó partido en el original ("NU" + "EVO_TER").
  if (/MERGEFIELD\s+NU/.test(t) && /EVO_TER/.test(t))
    return '{d.anexo.nuevo_termino:formatD(LL)}';

  return null;
}

function escaparXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function convertir(xml) {
  // Se trocea en runs para poder recorrerlos controlando la profundidad.
  const partes = xml.split(/(<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>)/);
  const salida = [];

  let profundidad = 0;
  let buffer = []; // runs del campo en curso
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

    // Acumula la instrucción del campo (puede venir en varios instrText).
    const instr = [...parte.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)];
    for (const m of instr) instruccion += ' ' + m[1];

    // El run posterior a "separate" es el que muestra el resultado: de ahí se
    // toma el formato para el marcador.
    if (separa) {
      rPrMostrado = null; // el siguiente run con texto es el del resultado
    } else if (rPrMostrado === null && /<w:t[\s>]/.test(parte) && !cierra) {
      const m = parte.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      rPrMostrado = m ? m[0] : '';
    }

    if (cierra) {
      profundidad--;
      if (profundidad === 0) {
        const marcador = marcadorPara(instruccion);
        if (marcador) {
          salida.push(`<w:r>${rPrMostrado ?? ''}<w:t xml:space="preserve">${escaparXml(marcador)}</w:t></w:r>`);
          reemplazados++;
        } else {
          // No reconocido: se deja tal cual para no romper el documento.
          salida.push(buffer.join(''));
          omitidos++;
          console.warn('  ! campo no reconocido, se deja intacto:', instruccion.trim().slice(0, 80));
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
  const original = zip.file('word/document.xml').asText();

  console.log('Convirtiendo campos de combinación a marcadores Carbone...');
  const { xml, reemplazados, omitidos } = convertir(original);

  zip.file('word/document.xml', xml);

  // Se quita el vínculo al origen de datos de la combinación: la plantilla
  // nueva la rellena Carbone, no Word.
  if (zip.file('word/settings.xml')) {
    const s = zip
      .file('word/settings.xml')
      .asText()
      .replace(/<w:mailMerge>[\s\S]*?<\/w:mailMerge>/g, '');
    zip.file('word/settings.xml', s);
  }
  if (zip.file('word/recipientData.xml')) zip.remove('word/recipientData.xml');

  fs.writeFileSync(DESTINO, zip.generate({ type: 'nodebuffer' }));
  console.log(`  campos reemplazados: ${reemplazados}`);
  console.log(`  campos intactos    : ${omitidos}`);
  console.log(`\nPlantilla escrita en: ${DESTINO}`);
}

main();
