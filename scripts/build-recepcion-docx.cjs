// Genera plantillas/recepcion-documentos.docx (plantilla Carbone) reutilizando el
// esqueleto válido de notificacion-fin-contrato.docx, con el logo CONAF, el
// membrete, los datos de recepción y una TABLA cuya fila de detalle se repite por
// cada documento recibido (sintaxis Carbone: {d.detalles[i].campo}).
//
// Ejecutar:  node scripts/build-recepcion-docx.cjs
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'plantillas');
const zip = new PizZip(fs.readFileSync(path.join(DIR, 'notificacion-fin-contrato.docx')));

// --- logo ------------------------------------------------------------------
const LOGO = fs.readFileSync(path.join(ROOT, 'public', 'logoconaf.png'));
const LOGO_REL = 'rId10';
const LOGO_CX = 1900000;
const LOGO_CY = Math.round(LOGO_CX / (593 / 251));
zip.file('word/media/logoconaf.png', LOGO);

let ct = zip.file('[Content_Types].xml').asText();
if (!/Extension="png"/.test(ct)) {
  ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  zip.file('[Content_Types].xml', ct);
}
let rels = zip.file('word/_rels/document.xml.rels').asText();
if (!rels.includes(LOGO_REL)) {
  rels = rels.replace(
    '</Relationships>',
    `<Relationship Id="${LOGO_REL}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logoconaf.png"/></Relationships>`,
  );
  zip.file('word/_rels/document.xml.rels', rels);
}

// --- helpers ---------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function run(text, opts = {}) {
  const rpr = ['<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'];
  if (opts.b) rpr.push('<w:b/><w:bCs/>');
  if (opts.color) rpr.push(`<w:color w:val="${opts.color}"/>`);
  rpr.push(`<w:sz w:val="${opts.sz || 24}"/><w:szCs w:val="${opts.sz || 24}"/>`);
  return `<w:r><w:rPr>${rpr.join('')}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function par(runs, opts = {}) {
  const ppr = [];
  if (opts.jc) ppr.push(`<w:jc w:val="${opts.jc}"/>`);
  const after = opts.after !== undefined ? opts.after : 120;
  ppr.push(`<w:spacing w:after="${after}" w:line="276" w:lineRule="auto"/>`);
  return `<w:p><w:pPr>${ppr.join('')}</w:pPr>${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;
}

function parLogo() {
  const drawing =
    `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${LOGO_CX}" cy="${LOGO_CY}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="logoconaf"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="logoconaf"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${LOGO_REL}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LOGO_CX}" cy="${LOGO_CY}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return `<w:p><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>${drawing}</w:p>`;
}

// --- tabla de detalle ------------------------------------------------------
const COLS = [
  { w: 1250, h: 'FECHA EMISIÓN', m: '{d.detalles[i].fecha_emision}' },
  { w: 1050, h: 'PROGRAMA', m: '{d.detalles[i].programa}' },
  { w: 1150, h: 'RUT', m: '{d.detalles[i].rut}' },
  { w: 520, h: 'DV', m: '{d.detalles[i].dv}' },
  { w: 1500, h: 'NOMBRE', m: '{d.detalles[i].nombre}' },
  { w: 1550, h: 'AP. PATERNO', m: '{d.detalles[i].apellido_p}' },
  { w: 1550, h: 'AP. MATERNO', m: '{d.detalles[i].apellido_m}' },
  { w: 700, h: 'GÉNERO', m: '{d.detalles[i].genero}' },
];

function celda(width, contenidoRun, { fill } = {}) {
  const shd = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '';
  const pPr = `<w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shd}<w:vAlign w:val="center"/></w:tcPr><w:p>${pPr}${contenidoRun}</w:p></w:tc>`;
}

function filaEncabezado() {
  const celdas = COLS.map((c) =>
    celda(c.w, run(c.h, { b: true, color: 'FFFFFF', sz: 16 }), { fill: '8B0000' }),
  ).join('');
  return `<w:tr><w:trPr><w:tblHeader/></w:trPr>${celdas}</w:tr>`;
}

function filaDetalle() {
  const celdas = COLS.map((c) => celda(c.w, run(c.m, { sz: 18 }))).join('');
  return `<w:tr>${celdas}</w:tr>`;
}

// Fila "límite": Carbone necesita un marcador {d.detalles[i+1]…} para saber
// dónde termina la sección repetida. Esta fila se consume al renderizar.
function filaLimite() {
  const celdas = COLS.map((c) =>
    celda(c.w, run(c.m.replace('[i]', '[i+1]'), { sz: 18 })),
  ).join('');
  return `<w:tr>${celdas}</w:tr>`;
}

function tablaDetalle() {
  const bordes =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`)
      .join('') +
    '</w:tblBorders>';
  const grid = COLS.map((c) => `<w:gridCol w:w="${c.w}"/>`).join('');
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${bordes}` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${filaEncabezado()}${filaDetalle()}${filaLimite()}</w:tbl>`
  );
}

// --- cuerpo ----------------------------------------------------------------
const P = [];
P.push(parLogo());
P.push(par(run('CORPORACIÓN NACIONAL FORESTAL', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('REGIÓN DE ARICA Y PARINACOTA', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('DEPTO. FINANZAS Y ADMINISTRACIÓN', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('SECCIÓN RECURSOS HUMANOS', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('CDC/JAN/ {d.documento.redactor_iniciales}', { b: true, sz: 16 }), { jc: 'both', after: 200 }));

P.push(par(run('FORMULARIO RECEPCIÓN DE DOCUMENTOS', { b: true, sz: 28 }), { jc: 'center', after: 240 }));

P.push(par([run('Tipo(s) de documento adjunto: ', { b: true }), run('{d.documento.tipos}')], { jc: 'both', after: 60 }));
P.push(
  par(
    [run('Fecha de recepción: ', { b: true }), run('{d.documento.fecha_recepcion:formatD(LL)}')],
    { jc: 'both', after: 60 },
  ),
);
P.push(par([run('Cantidad / Descripción general: ', { b: true }), run('{d.documento.descripcion}')], { jc: 'both', after: 200 }));

P.push(par(run('Detalle', { b: true }), { jc: 'both', after: 80 }));
P.push(tablaDetalle());
P.push(par(run(''), { after: 800 }));

// Firmas (entrega / recibe) en una tabla sin bordes de dos columnas.
const firmas =
  `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>` +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((b) => `<w:${b} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
    .join('') +
  `</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr>` +
  `<w:tblGrid><w:gridCol w:w="4560"/><w:gridCol w:w="4560"/></w:tblGrid><w:tr>` +
  `<w:tc><w:tcPr><w:tcW w:w="4560" w:type="dxa"/></w:tcPr>` +
  `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>${run('_______________________________')}</w:p>` +
  `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>${run('{d.entrega}', { b: true })}</w:p>` +
  `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('Entrega', { sz: 20 })}</w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="4560" w:type="dxa"/></w:tcPr>` +
  `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>${run('_______________________________')}</w:p>` +
  `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>${run('{d.recibe}', { b: true })}</w:p>` +
  `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('Recibe', { sz: 20 })}</w:p></w:tc>` +
  `</w:tr></w:tbl>`;
P.push(firmas);
P.push(par(run('')));

const sectPr =
  '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';

const NS =
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"';

const documentXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  `<w:document ${NS}><w:body>${P.join('')}${sectPr}</w:body></w:document>`;

zip.file('word/document.xml', documentXml);
const out = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(path.join(DIR, 'recepcion-documentos.docx'), out);
console.log('OK -> plantillas/recepcion-documentos.docx', out.length, 'bytes');
