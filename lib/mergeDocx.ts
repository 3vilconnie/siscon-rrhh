// lib/mergeDocx.ts
// Fusiona varios .docx (generados desde la MISMA plantilla) en uno solo,
// con una página por documento. Solo para uso en el servidor.
//
// Como todos los .docx provienen de la misma plantilla comparten estilos,
// tema y numeración idénticos, por lo que basta con concatenar el contenido
// del <w:body> de cada uno, separado por un salto de página, dentro del primero.

import PizZip from 'pizzip';

// Párrafo mínimo que fuerza el inicio en una página nueva sin dejar un
// párrafo vacío en la página anterior (evita páginas en blanco intermedias).
const SALTO_PAGINA =
  '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:after="0" w:line="1" w:lineRule="exact"/></w:pPr></w:p>';

/** Extrae el contenido interno del <w:body> (sin el <w:sectPr> final) y quita los bookmarks. */
function contenidoCuerpo(documentXml: string): string {
  const inicio = documentXml.indexOf('<w:body>') + '<w:body>'.length;
  const fin = documentXml.lastIndexOf('<w:sectPr');
  return documentXml.slice(inicio, fin).replace(/<w:bookmark(Start|End)[^>]*\/>/g, '');
}

/**
 * Fusiona los buffers de .docx en uno solo. Devuelve el buffer del .docx combinado.
 * Si se pasa un único documento, se devuelve tal cual.
 */
export function mergeDocxBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) throw new Error('No hay documentos para fusionar.');
  if (buffers.length === 1) return buffers[0];

  const zips = buffers.map((b) => new PizZip(b));
  const baseXml = zips[0].file('word/document.xml')!.asText();

  const prefijo = baseXml.slice(0, baseXml.indexOf('<w:body>') + '<w:body>'.length);
  const sufijo = baseXml.slice(baseXml.lastIndexOf('<w:sectPr')); // incluye </w:body></w:document>

  let cuerpo = contenidoCuerpo(baseXml);
  for (let i = 1; i < zips.length; i++) {
    cuerpo += SALTO_PAGINA + contenidoCuerpo(zips[i].file('word/document.xml')!.asText());
  }

  zips[0].file('word/document.xml', prefijo + cuerpo + sufijo);
  return zips[0].generate({ type: 'nodebuffer' });
}
