// Genera plantillas/finiquito.docx (plantilla Carbone) reutilizando el esqueleto
// válido de notificacion-fin-contrato.docx, incrustando el logo CONAF
// (public/logoconaf.png) y escribiendo un document.xml propio.
// Cada marcador {d.x} queda en un único run para que Carbone lo reemplace bien.
//
// Ejecutar:  node scripts/build-finiquito-docx.cjs
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'plantillas');
const base = fs.readFileSync(path.join(DIR, 'notificacion-fin-contrato.docx'));
const zip = new PizZip(base);

// --- logo ------------------------------------------------------------------
const LOGO = fs.readFileSync(path.join(ROOT, 'public', 'logoconaf.png'));
const LOGO_REL = 'rId10';
// Logo 593x251 (ratio 2.36). Se muestra a ~5,3 cm de ancho conservando proporción.
const LOGO_CX = 1900000; // EMU (~5,28 cm)
const LOGO_CY = Math.round(LOGO_CX / (593 / 251)); // conserva la proporción

zip.file('word/media/logoconaf.png', LOGO);

// Content types: registrar la extensión png.
let ct = zip.file('[Content_Types].xml').asText();
if (!/Extension="png"/.test(ct)) {
  ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  zip.file('[Content_Types].xml', ct);
}

// Relationship del logo en document.xml.rels.
let rels = zip.file('word/_rels/document.xml.rels').asText();
if (!rels.includes(LOGO_REL)) {
  rels = rels.replace(
    '</Relationships>',
    `<Relationship Id="${LOGO_REL}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logoconaf.png"/></Relationships>`,
  );
  zip.file('word/_rels/document.xml.rels', rels);
}

// --- helpers para construir OOXML -----------------------------------------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Un "run" de texto. opts: {b:bold, sz:half-points, u:underline}
function run(text, opts = {}) {
  const rpr = [];
  rpr.push('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>');
  if (opts.b) rpr.push('<w:b/><w:bCs/>');
  if (opts.u) rpr.push('<w:u w:val="single"/>');
  rpr.push(`<w:sz w:val="${opts.sz || 24}"/><w:szCs w:val="${opts.sz || 24}"/>`);
  return `<w:r><w:rPr>${rpr.join('')}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

// Un párrafo con runs. opts: {jc:'both'|'center'|'right', after:spacing}
function par(runs, opts = {}) {
  const ppr = [];
  if (opts.jc) ppr.push(`<w:jc w:val="${opts.jc}"/>`);
  const after = opts.after !== undefined ? opts.after : 120;
  ppr.push(`<w:spacing w:after="${after}" w:line="276" w:lineRule="auto"/>`);
  const pprXml = ppr.length ? `<w:pPr>${ppr.join('')}</w:pPr>` : '';
  return `<w:p>${pprXml}${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;
}

// Párrafo con el logo (imagen inline).
function parLogo() {
  const drawing =
    `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${LOGO_CX}" cy="${LOGO_CY}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
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

// Referencia al trabajador que se repite: "Don(ña) NOMBRE APE APE, RUT 12.345.678 - 9"
function refTrabajador(rutLabel) {
  return [
    run('{d.trabajador.tratamiento_cap} {d.trabajador.nombre_completo_upper}, '),
    run(`${rutLabel} {d.trabajador.rut_miles} - {d.trabajador.dv}`),
  ].join('');
}

// --- cuerpo del documento --------------------------------------------------
const P = [];

// Logo CONAF (arriba, como en la plantilla original)
P.push(parLogo());

// Membrete (negrita, tamaño reducido como el original)
P.push(par(run('CORPORACIÓN NACIONAL FORESTAL', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('REGIÓN DE ARICA Y PARINACOTA', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('DEPTO. FINANZAS Y ADMINISTRACIÓN', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('SECCIÓN RECURSOS HUMANOS', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('CDC/JAN/ {d.documento.redactor_iniciales}', { b: true, sz: 16 }), { jc: 'both', after: 200 }));

// Proyecto (cabecera dinámica)
P.push(par(run('{d.programa.proyecto}', { sz: 20 }), { jc: 'both', after: 240 }));

// Título
P.push(
  par(run('FINIQUITO {d.trabajador.del_dela} TRABAJADOR{d.trabajador.genero_a}', { b: true }), {
    jc: 'center',
    after: 240,
  }),
);

// Encabezado / comparecencia
P.push(
  par(
    [
      run(
        'En {d.documento.ciudad}, a {d.documento.fecha_emision:formatD(LL)}, entre la CORPORACIÓN NACIONAL FORESTAL, RUT: {d.institucion.rut}, {d.institucion.region}, representado por su Director Regional (I) {d.firmante.tratamiento} ',
      ),
      run('{d.firmante.nombre}', { b: true }),
      run(
        ', RUT: {d.firmante.rut}, de profesión {d.firmante.profesion}, Región de Arica y Parinacota, ambos con domicilio en {d.institucion.domicilio}, y ',
      ),
      run('{d.trabajador.tratamiento_cap} {d.trabajador.nombre_completo_upper}', { b: true }),
      run(', RUT: {d.trabajador.rut_miles} - {d.trabajador.dv}, acuerdan el siguiente finiquito:'),
    ],
    { jc: 'both' },
  ),
);

// PRIMERO
P.push(
  par(
    [
      run('PRIMERO: ', { b: true }),
      refTrabajador('RUT'),
      run(
        ', declara haber prestado sus servicios a la Corporación Nacional Forestal, desde el {d.contrato.fecha_inicio:formatD(LL)} hasta el {d.contrato.fecha_termino:formatD(LL)}, fecha última de término de sus servicios por “',
      ),
      run('{d.finiquito.terminos}', { b: true }),
      run('”, (Artículo N° {d.finiquito.articulo} del Código de Trabajo).'),
    ],
    { jc: 'both' },
  ),
);

// SEGUNDO
P.push(
  par(
    [
      run('SEGUNDO: ', { b: true }),
      refTrabajador('RUT'),
      run(
        ', declara recibir en este acto, a su entera satisfacción, de parte de la CORPORACIÓN NACIONAL FORESTAL, la suma que a continuación se indica, por los siguientes conceptos:',
      ),
    ],
    { jc: 'both' },
  ),
);
P.push(
  par(run('Feriado Proporcional ({d.finiquito.fp_texto} días): $ {d.finiquito.total_texto} .-'), {
    jc: 'both',
    after: 0,
  }),
);
P.push(
  par(run('TOTAL LÍQUIDO A PAGAR: $ {d.finiquito.total_texto} .-', { b: true }), {
    jc: 'both',
    after: 0,
  }),
);
P.push(par(run('SON: {d.finiquito.total_palabras}.'), { jc: 'both' }));

// TERCERO
P.push(
  par(
    [
      run('TERCERO: ', { b: true }),
      refTrabajador('RUT'),
      run(
        ', deja constancia que durante todo el tiempo que prestó servicios a la CORPORACIÓN NACIONAL FORESTAL, recibió de ésta correcta y oportuna el total de las remuneraciones convenidas, de acuerdo con su contrato de trabajo, clase de trabajo ejecutado, y que nada se le adeuda por los conceptos antes indicados ni por ningún otro, sea de origen legal o contractual derivado de la prestación de sus servicios y, motivo por el cual, no teniendo reclamo ni cargo alguno que formular en contra de la CORPORACIÓN NACIONAL FORESTAL, le otorga el más amplio y total finiquito, declaración que formula libre y espontáneamente, en perfecto y cabal conocimiento de cada uno y de todos sus derechos.',
      ),
    ],
    { jc: 'both' },
  ),
);

// CUARTO
P.push(
  par(
    [
      run('CUARTO: ', { b: true }),
      run('La CORPORACIÓN NACIONAL FORESTAL, declara que las cotizaciones previsionales de '),
      refTrabajador('RUT'),
      run(', se encuentran debidamente canceladas.'),
    ],
    { jc: 'both' },
  ),
);

// QUINTO
P.push(
  par(
    [
      run('QUINTO: ', { b: true }),
      run(
        'De conformidad a lo dispuesto por la Ley N°21.389, las partes dejan expresa constancia que el empleador no ha recibido sentencia alguna de algún Juzgado de Familia o de otro tipo, que indique deuda de pensión alimenticia a la fecha del término de la relación laboral.',
      ),
    ],
    { jc: 'both' },
  ),
);

// Cierre
P.push(
  par(
    run(
      'Para constancia firman las partes del presente Finiquito en tres ejemplares, quedando uno para {d.trabajador.tratamiento_cap} {d.trabajador.nombre_completo_upper}, uno para el Empleador y el tercero para la Inspección del Trabajo.',
    ),
    { jc: 'both', after: 700 },
  ),
);

// Firma
P.push(par(run('_______________________________', { sz: 22 }), { jc: 'center', after: 0 }));
P.push(par(run('{d.firmante.nombre_corto}', { b: true, sz: 22 }), { jc: 'center', after: 0 }));
P.push(par(run('{d.firmante.cargo}', { sz: 22 }), { jc: 'center', after: 0 }));
P.push(par(run('CORPORACIÓN NACIONAL FORESTAL', { sz: 22 }), { jc: 'center', after: 0 }));

// sección final (tamaño carta, márgenes)
const sectPr =
  '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';

const NS =
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"';

const documentXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  `<w:document ${NS}><w:body>${P.join('')}${sectPr}</w:body></w:document>`;

zip.file('word/document.xml', documentXml);

const out = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(path.join(DIR, 'finiquito.docx'), out);
console.log('OK -> plantillas/finiquito.docx', out.length, 'bytes (logo', LOGO_CX + 'x' + LOGO_CY, 'EMU)');
