// Genera plantillas/contrato-trabajo.docx (plantilla Carbone) con el logo CONAF,
// el membrete y todas las cláusulas del Contrato de Trabajo de Plazo Fijo.
// Los textos que dependen del género se resuelven en lib/contrato.ts y llegan
// como campos ({d.g.el_trabajador}, etc.). La cláusula de bonos (NOVENO) se
// muestra condicionalmente con los formateadores showBegin/showEnd de Carbone.
//
// Ejecutar:  node scripts/build-contrato-docx.cjs
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
  rpr.push(`<w:sz w:val="${opts.sz || 24}"/><w:szCs w:val="${opts.sz || 24}"/>`);
  return `<w:r><w:rPr>${rpr.join('')}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}
function par(runs, opts = {}) {
  const jc = opts.jc || 'both';
  const after = opts.after !== undefined ? opts.after : 120;
  return `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:after="${after}" w:line="276" w:lineRule="auto"/></w:pPr>${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;
}
function parLogo() {
  const drawing =
    `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${LOGO_CX}" cy="${LOGO_CY}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="logoconaf"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="logoconaf"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${LOGO_REL}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LOGO_CX}" cy="${LOGO_CY}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return `<w:p><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>${drawing}</w:p>`;
}

// Tabla de horario (texto fijo).
function tablaHorario() {
  const bordes =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`)
      .join('') +
    '</w:tblBorders>';
  const cell = (txt, b) =>
    `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${run(txt, { b, sz: 20 })}</w:p></w:tc>`;
  const row = (a, c, d, b) => `<w:tr>${cell(a, b)}${cell(c, b)}${cell(d, b)}</w:tr>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${bordes}<w:tblLook w:val="04A0"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>` +
    row('Horario', 'Lunes a Jueves', 'Viernes', true) +
    row('Rango de Ingreso', 'De 07:30 hrs. a 09:30 hrs.', 'De 07:30 hrs. a 09:30 hrs.', false) +
    row('Rango de Salida', 'De 16:30 hrs. a 18:30 hrs.', 'De 13:30 hrs. a 15:30 hrs.', false) +
    `</w:tbl>`
  );
}

const P = [];
// Membrete
P.push(parLogo());
P.push(par(run('CORPORACIÓN NACIONAL FORESTAL', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('REGIÓN DE ARICA Y PARINACOTA', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('DEPTO. DE FINANZAS Y ADMINISTRACIÓN', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('SECCIÓN RECURSOS HUMANOS', { b: true, sz: 16 }), { jc: 'both', after: 0 }));
P.push(par(run('CDC/JAN/ {d.documento.redactor_iniciales}', { b: true, sz: 16 }), { jc: 'both', after: 200 }));

// Proyecto + título
P.push(par(run('{d.programa.proyecto}', { sz: 20 }), { jc: 'both', after: 200 }));
P.push(par(run('CONTRATO DE TRABAJO DE PLAZO FIJO', { b: true, sz: 26 }), { jc: 'center', after: 40 }));
P.push(par(run('{d.programa.subtitulo}', { b: true, sz: 20 }), { jc: 'center', after: 240 }));

// Comparecencia
P.push(
  par([
    run(
      'En {d.documento.ciudad}, {d.documento.fecha_emision:formatD(LL)}, entre la CORPORACIÓN NACIONAL FORESTAL, en adelante “la Corporación” o CONAF, representada por su {d.director.cargo} {d.director.trato} ',
    ),
    run('{d.director.nombre}', { b: true }),
    run(
      ', RUT: {d.director.rut}, de profesión {d.director.profesion}, ambos domiciliados en {d.institucion.domicilio}, por una parte; y por la otra {d.trabajador.trato} ',
    ),
    run('{d.trabajador.nombre_upper} {d.trabajador.apellido_p_upper} {d.trabajador.apellido_m_upper}', { b: true }),
    run(
      ', cédula de identidad N° {d.trabajador.rut_miles} - {d.trabajador.dv}, {d.trabajador.nacionalidad}, {d.trabajador.estado_civil}, nacido en {d.trabajador.lugar_nac}, el {d.trabajador.fecha_nac:formatD(LL)}, domiciliado en {d.trabajador.domicilio}, comuna de {d.trabajador.comuna}, en adelante “{d.g.el_trabajador}”, vienen en celebrar el presente contrato de trabajo en los términos que a continuación se indica:',
    ),
  ]),
);

// PRIMERO
P.push(
  par([
    run('PRIMERO: ', { b: true }),
    run(
      '{d.g.El_trabajador}, a contar del {d.contrato.inicio:formatD(LL)}, se compromete a realizar labores de {d.contrato.labores}, para la implementación del Programa {d.programa.nombre}. Su lugar de trabajo será en la Comuna de {d.contrato.lugar_trabajo}, tendrá dependencia directa de {d.contrato.dependencia_dir}.',
    ),
  ]),
);

// SEGUNDO (jornada + tabla)
P.push(
  par([
    run('SEGUNDO: ', { b: true }),
    run(
      'La jornada ordinaria de trabajo será de 42 horas semanales, distribuidas de manera flexible de lunes a viernes, con los siguientes horarios diarios de ingreso y salida:',
    ),
  ]),
);
P.push(tablaHorario());
P.push(
  par(
    run(
      '{d.g.El_trabajador} podrá ingresar dentro del periodo establecido como rango de ingreso y podrá retirarse luego de cumplir la jornada ordinaria de nueve (9) horas de lunes a jueves y seis (6) horas el día viernes. Sin embargo, con el propósito de no afectar el normal funcionamiento del servicio y de acuerdo a lo establecido en el Título IV del Reglamento Interno de Orden, Higiene y Seguridad 2024 de CONAF, Art. 17, inciso 5, las jefaturas podrán instruir a los trabajadores que ingresen en un horario determinado y/o se coordinen con otro trabajador cuando se deban cumplir labores específicas o impostergables que condicionen el buen funcionamiento o continuidad de las labores propias de la Corporación. Se considerará dentro de la jornada de trabajo, 30 minutos de colación, tiempo que será imputable al horario de trabajo. El trabajador estará obligado a registrar su asistencia de ingreso y salida de su lugar de trabajo, a través de reloj biométrico geovictoria box.',
    ),
    { after: 200 },
  ),
);

// TERCERO
P.push(
  par([
    run('TERCERO: ', { b: true }),
    run(
      '{d.g.El_trabajador} recibirá del empleador una renta bruta mensual de $ {d.contrato.sueldo_texto} ({d.contrato.sueldo_palabras}) pagadero el mes vencido y se realizará dentro del Quinto día hábil del mes siguiente al período trabajado. De la remuneración bruta se descontarán todos los descuentos estrictamente legales. El medio de pago se realizará mediante transferencia electrónica a una cuenta bancaria señalada por {d.g.el_trabajador}, o en su defecto mediante abono bancario o emisión de cheque nominativo.',
    ),
  ]),
);

// CUARTO
P.push(
  par([
    run('CUARTO: ', { b: true }),
    run(
      'El presente contrato es de plazo fijo y tendrá vigencia desde el {d.contrato.inicio:formatD(LL)} hasta el {d.contrato.termino:formatD(LL)}.',
    ),
  ]),
);

// QUINTO
P.push(
  par([
    run('QUINTO: ', { b: true }),
    run(
      'Se deja constancia que {d.trabajador.trato} {d.trabajador.nombre_upper} {d.trabajador.apellido_p_upper} {d.trabajador.apellido_m_upper}, ingresó a la Corporación Nacional Forestal con fecha {d.contrato.inicio:formatD(LL)}.',
    ),
  ]),
);

// SEXTO (obligaciones)
P.push(
  par([
    run('SEXTO: ', { b: true }),
    run(
      'Son obligaciones esenciales {d.g.del_trabajador}, cuya infracción las partes entienden como causa justificada de terminación inmediata del presente Contrato, las siguientes: a) Cumplir íntegramente la jornada de trabajo. b) Cuidar y mantener, en perfecto estado de conservación, los útiles y otros bienes que le haya proporcionado la Corporación para ejecutar las labores. c) Realizar su trabajo y cumplir las instrucciones bajo las órdenes y supervisión del jefe de la Unidad. d) Cumplir con las obligaciones señaladas en el Reglamento Interno de Orden, Higiene y Seguridad y su documento adjunto de la Ley 20.005 sobre Acoso sexual. Ambos forman parte integrantes del presente Contrato, y son recepcionados conforme en este acto por el trabajador. e) Conocer la “Política de Prevención Trabajar con Calidad de Vida” que es parte integrante de este contrato, y recepcionados en este acto por {d.g.el_trabajador}.',
    ),
  ]),
);

// Confidencialidad
P.push(
  par([
    run('DE LA CONFIDENCIALIDAD: ', { b: true }),
    run(
      '{d.g.El_trabajador} no podrá divulgar información confidencial a la cual tenga acceso con motivo de sus funciones, sin autorización de la Corporación, excepto en aquellos casos en que lo exijan las leyes vigentes, en particular las tributarias y de seguridad social. En especial no podrá revelar a terceros lo siguiente: a) Información, de cualquiera naturaleza, relacionada con la Corporación y sus respectivos clientes, incluyendo, sin limitación alguna, las políticas de la Corporación, las operaciones sociales, técnicas, cuentas y personal de la Corporación; b) Información y datos obtenidos por {d.g.el_trabajador}, que sea de propiedad de la Corporación o de un tercero, y que la Corporación esté obligada a tratar como confidencial. La obligación de reserva del trabajador será permanente salvo que la Corporación haga pública dicha información. Todas aquellas obligaciones señaladas en los términos de referencia alusivos al presente contrato, que son conocidas por las partes contratantes, no se insertan y pasan a formar parte integrante del presente instrumento.',
    ),
  ]),
);

// SEPTIMO
P.push(
  par([
    run('SÉPTIMO: ', { b: true }),
    run(
      '{d.g.El_trabajador} inicia sus labores el día {d.contrato.inicio:formatD(LL)} y declara pertenecer al siguiente régimen previsional {d.contrato.prevision} y de salud {d.contrato.salud}.',
    ),
  ]),
);

// OCTAVO (viático)
P.push(
  par([
    run('OCTAVO: ', { b: true }),
    run(
      'Cuando {d.g.el_trabajador} por razones de servicio deba ausentarse del lugar de su desempeño habitual, tendrá derecho a percibir un subsidio, que se denominará viático, de $26.331 por medio día, y de $65.829 por día completo, para los gastos de alojamiento y alimentación, reajustable al porcentaje del sector público.',
    ),
  ]),
);

// NOVENO (bonos, condicional)
P.push(
  par([
    run('{d.bonos.mostrar:ifEQ(true):showBegin}NOVENO: ', { b: true }),
    run(
      'Las partes acuerdan que la Corporación otorgará {d.g.al_trabajador} un bono por movilización ascendente a la suma de $ {d.bonos.mov_texto} ({d.bonos.mov_palabras}), un bono de colación ascendente a la suma de $ {d.bonos.col_texto} ({d.bonos.col_palabras}), por cada mes que haya prestado servicios a CONAF en virtud del presente contrato. Precisado por el artículo 41 del Código del Trabajo, el inciso 2° del mismo precepto legal, la asignación de movilización presenta un carácter compensatorio, no constituye remuneración y se pagará proporcionalmente a los días trabajados.{d.bonos.mostrar:showEnd}',
    ),
  ]),
);

// Cláusula final (ejemplares)
P.push(
  par(
    [
      run('{d.bonos.numeral_ejemplares}: ', { b: true }),
      run(
        'El presente contrato se firma en tres ejemplares del mismo tenor y fecha, quedando uno en poder {d.g.del_trabajador}, el segundo en el lugar de trabajo y el tercero en las dependencias de la oficina regional de Arica.',
      ),
    ],
    { after: 700 },
  ),
);

// Firmas (dos columnas sin bordes)
const celdaFirma = (runs) =>
  `<w:tc><w:tcPr><w:tcW w:w="4560" w:type="dxa"/></w:tcPr>${runs.map((r) => `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${r}</w:p>`).join('')}</w:tc>`;
const firmas =
  `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>` +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((b) => `<w:${b} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
    .join('') +
  `</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="4560"/><w:gridCol w:w="4560"/></w:tblGrid><w:tr>` +
  celdaFirma([
    run('_______________________________'),
    run('{d.director.nombre}', { b: true }),
    run('{d.director.rut}'),
    run('{d.director.cargo}'),
    run('Corporación Nacional Forestal'),
    run('{d.institucion.rut}'),
  ]) +
  celdaFirma([
    run('_______________________________'),
    run('{d.trabajador.nombre_upper} {d.trabajador.apellido_p_upper} {d.trabajador.apellido_m_upper}', { b: true }),
    run('R.U.T. {d.trabajador.rut_miles} - {d.trabajador.dv}'),
  ]) +
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
fs.writeFileSync(path.join(DIR, 'contrato-trabajo.docx'), zip.generate({ type: 'nodebuffer' }));
console.log('OK -> plantillas/contrato-trabajo.docx');
