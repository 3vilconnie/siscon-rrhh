// lib/finiquito.ts
// Cálculo de finiquito (feriado proporcional) y construcción de los datos que se
// envían a Carbone para emitir el documento de finiquito.
//
// Este archivo es COMPARTIDO entre cliente (vista) y servidor (route handler):
// no debe importar nada exclusivo de servidor (fs, path, etc.).
//
// La lógica replica exactamente la "Plantilla Calculo Finiquito.xlsm":
//   valor_día      = sueldo_imponible / 30
//   meses          = DATEDIF(inicio, término, "m")
//   días           = DATEDIF(inicio, término, "md")
//   días_hábiles   = 1.25 * meses + (1.25 / 30) * días        (factor feriado legal)
//   días_inhábiles = sábados/domingos/festivos del período proyectado (ajustable a mano)
//   FP             = ROUND(días_hábiles + días_inhábiles, 2)
//   TOTAL          = valor_día * FP
//
// Validado contra la planilla con el caso 15-09-2025 → 30-05-2026, sueldo
// 1.950.000: hábiles 10,625 → se proyectan 10 días (1-5 y 8-12 de junio),
// inhábiles 3 (31-may, 6-jun, 7-jun) ⇒ FP 13,63 y TOTAL 885.950.
//
// Otro caso de referencia: 02-03-2026 → 30-04-2026 con sueldo 600.000 da
// hábiles 2,42 e inhábiles estimados 2 (2 y 3 de mayo) ⇒ FP 4,42. En la hoja
// original ese finiquito quedó con 3 inhábiles porque el 1 de mayo es feriado:
// la estimación NO considera festivos, por eso el valor se puede ajustar a mano.

import { Trabajador, Contrato } from '@/types';

/** Factor de feriado legal: 15 días hábiles al año = 1,25 días hábiles por mes. */
export const FACTOR_FERIADO = 1.25;

/** Días considerados para el sueldo mensual (mes comercial). */
export const DIAS_MES = 30;

// ---------------------------------------------------------------------------
// Utilidades de fecha (equivalentes a DATEDIF de Excel)
// ---------------------------------------------------------------------------

/** Convierte una fecha ISO (YYYY-MM-DD) a Date en UTC, sin desfase de zona horaria. */
function fechaISOaUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** DATEDIF(d1, d2, "m"): meses completos entre dos fechas. */
export function datedifMeses(iso1: string, iso2: string): number {
  const d1 = fechaISOaUTC(iso1);
  const d2 = fechaISOaUTC(iso2);
  let meses = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
  if (d2.getUTCDate() < d1.getUTCDate()) meses--;
  return Math.max(0, meses);
}

/** DATEDIF(d1, d2, "md"): días restantes ignorando meses y años. */
export function datedifDias(iso1: string, iso2: string): number {
  const d1 = fechaISOaUTC(iso1);
  const d2 = fechaISOaUTC(iso2);
  let dias = d2.getUTCDate() - d1.getUTCDate();
  if (dias < 0) {
    // Días del mes anterior al de la fecha 2.
    const diasMesPrevio = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), 0)).getUTCDate();
    dias = d2.getUTCDate() + (diasMesPrevio - d1.getUTCDate());
  }
  return Math.max(0, dias);
}

/**
 * Proyecta el feriado en el calendario a partir del día siguiente al término
 * del contrato y devuelve qué fechas quedan marcadas como hábiles (las que
 * consumen el feriado) y cuáles como inhábiles (fines de semana intercalados).
 *
 * Replica la planilla original en dos puntos que son fáciles de errar:
 *
 *  1. Solo se proyectan los días hábiles ENTEROS (`Math.floor`). La fracción
 *     (p.ej. el 0,625 de 10,625) se suma aritméticamente al final, pero NO
 *     consume un día más del calendario. Redondear hacia arriba haría avanzar
 *     el cursor un día extra y, si ese día cae después de un fin de semana,
 *     arrastraría 2 días inhábiles que no corresponden.
 *
 *  2. El período arranca el día siguiente al término, aunque sea sábado o
 *     domingo: esos días también cuentan como inhábiles. Si el contrato
 *     termina un sábado, el domingo siguiente ya es parte del feriado.
 *
 * Los feriados legales se reciben en `feriados` (set de fechas ISO): un feriado
 * en medio del período NO consume día hábil y se cuenta como inhábil. Ver
 * lib/feriados.ts. Si no se entrega el set, solo se consideran fines de semana.
 */
export function proyectarFeriado(
  fechaTerminoISO: string,
  diasHabiles: number,
  feriados: Set<string> = new Set(),
): { habiles: string[]; inhabiles: string[] } {
  const habiles: string[] = [];
  const inhabiles: string[] = [];

  const objetivo = Math.floor(diasHabiles);
  if (objetivo <= 0) return { habiles, inhabiles };

  const cursor = fechaISOaUTC(fechaTerminoISO);
  cursor.setUTCDate(cursor.getUTCDate() + 1); // día siguiente al término

  // Cota de seguridad para evitar bucles infinitos.
  for (let guardia = 0; guardia < 400 && habiles.length < objetivo; guardia++) {
    const dow = cursor.getUTCDay(); // 0 = domingo, 6 = sábado
    const iso = cursor.toISOString().slice(0, 10);
    const esFinDeSemana = dow === 0 || dow === 6;
    if (esFinDeSemana || feriados.has(iso)) inhabiles.push(iso);
    else habiles.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { habiles, inhabiles };
}

/** Estima los días inhábiles (fines de semana y feriados) del feriado proyectado. */
export function estimarDiasInhabiles(
  fechaTerminoISO: string,
  diasHabiles: number,
  feriados: Set<string> = new Set(),
): number {
  return proyectarFeriado(fechaTerminoISO, diasHabiles, feriados).inhabiles.length;
}

// ---------------------------------------------------------------------------
// Cálculo del finiquito
// ---------------------------------------------------------------------------

export interface FiniquitoInput {
  fechaInicio: string; // ISO
  fechaTermino: string; // ISO
  sueldoImponible: number;
  /** Días inhábiles del feriado (por defecto se estiman y luego se pueden ajustar). */
  diasInhabiles?: number;
  /** Feriados legales (fechas ISO) que caen dentro del feriado proyectado. */
  feriados?: Set<string>;
}

export interface ResultadoFiniquito {
  valorDia: number;
  meses: number;
  dias: number;
  diasHabiles: number; // sin redondear
  diasInhabiles: number;
  fp: number; // ROUND(hábiles + inhábiles, 2)
  total: number; // valorDia * fp
}

/** Redondea a n decimales como ROUND de Excel. */
function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

export function calcularFiniquito(input: FiniquitoInput): ResultadoFiniquito {
  const sueldo = input.sueldoImponible || 0;
  const valorDia = sueldo / DIAS_MES;

  const meses = datedifMeses(input.fechaInicio, input.fechaTermino);
  const dias = datedifDias(input.fechaInicio, input.fechaTermino);

  const diasHabiles = FACTOR_FERIADO * meses + (FACTOR_FERIADO / DIAS_MES) * dias;
  const diasInhabiles =
    input.diasInhabiles ??
    estimarDiasInhabiles(input.fechaTermino, diasHabiles, input.feriados ?? new Set());

  const fp = redondear(diasHabiles + diasInhabiles, 2);
  const total = Math.round(valorDia * fp);

  return { valorDia, meses, dias, diasHabiles, diasInhabiles, fp, total };
}

// ---------------------------------------------------------------------------
// Número a palabras (para "SON: ... PESOS")
// ---------------------------------------------------------------------------

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ESPECIALES: Record<number, string> = {
  10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
  16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
  20: 'VEINTE', 21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
  25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE',
};
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** Convierte 0..999 a palabras. */
function centenasAPalabras(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let texto = CENTENAS[c];
  if (resto > 0) {
    let restoTexto: string;
    if (resto < 10) restoTexto = UNIDADES[resto];
    else if (ESPECIALES[resto]) restoTexto = ESPECIALES[resto];
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      restoTexto = u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
    }
    texto = texto ? `${texto} ${restoTexto}` : restoTexto;
  }
  return texto;
}

/**
 * Convierte un entero no negativo a palabras en mayúsculas (español, hasta miles
 * de millones). No incluye la palabra "PESOS".
 */
export function numeroALetras(n: number): string {
  const entero = Math.round(Math.abs(n));
  if (entero === 0) return 'CERO';

  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLÓN' : `${numeroALetras(millones)} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${centenasAPalabras(miles)} MIL`);
  }
  if (resto > 0) {
    partes.push(centenasAPalabras(resto));
  }

  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

/** Devuelve el monto en palabras seguido de "PESOS". Ej: 108400 → "CIENTO OCHO MIL CUATROCIENTOS PESOS". */
export function montoEnPalabras(n: number): string {
  return `${numeroALetras(n)} PESOS`;
}

// ---------------------------------------------------------------------------
// Catálogo de programas (cabecera / proyecto que va al inicio del finiquito)
// ---------------------------------------------------------------------------

export interface ProgramaFiniquito {
  id: string;
  nombre: string; // etiqueta para el desplegable
  proyecto: string; // párrafo que se imprime en el documento
}

export const PROGRAMAS_FINIQUITO: ProgramaFiniquito[] = [
  {
    id: 'empleos-verdes',
    nombre: 'Prog. Capacitación y Generación de Empleos Verdes',
    proyecto:
      "PROYECTO: 'CONVENIO DE TRANSFERENCIA Y COLABORACIÓN, ENTRE LA SECRETARÍA REGIONAL MINISTERIAL DE AGRICULTURA DEL PROGRAMA PLAN ZONAS REZAGADAS- FNDR DENOMINADO 'TRANSFERENCIA, CAPACITACIÓN Y GENERACIÓN DE EMPLEOS VERDES EN LA RESERVA BIOSFERA LAUCA' CODIGO BIP 40045543-0 Y LA CORPORACIÓN NACIONAL FORESTAL DE LA REGIÓN DE ARICA Y PARINACOTA'",
  },
  {
    id: 'servicios-ecosistemicos',
    nombre: 'Prog. Recuperación Servicios Ecosistémicos Andinos',
    proyecto:
      "PROYECTO: 'CONVENIO DE TRANSFERENCIA Y COLABORACIÓN, ENTRE LA SECRETARÍA REGIONAL MINISTERIAL DE AGRICULTURA DEL PROGRAMA PLAN ZONAS REZAGADAS- FNDR DENOMINADO 'RECUPERACIÓN SERVICIOS AMBIENTALES ECOSISTEMA ANDINO Y CAPACITACIÓN' CODIGO BIP 40045266-0 Y LA CORPORACIÓN NACIONAL FORESTAL DE LA REGIÓN DE ARICA Y PARINACOTA'",
  },
  {
    id: 'conadi',
    nombre: 'CONADI',
    proyecto:
      "PROYECTO: 'CONVENIO DE COLABORACIÓN ENTRE LA CORPORACIÓN NACIONAL FORESTAL Y LA DIRECCIÓN REGIONAL DE CONADI PARA LA PROMOCIÓN INTEGRAL DE RIEGO PARA PERSONAS INDÍGENAS, COMUNIDADES Y/O PARTE DE COMUNIDADES INDÍGENAS DE LA REGIÓN DE ARICA Y PARINACOTA'",
  },
  { id: 'ninguno', nombre: 'Sin proyecto', proyecto: '' },
];

// ---------------------------------------------------------------------------
// Causales de término (para el finiquito, mayormente artículo 159)
// ---------------------------------------------------------------------------

export interface CausalFiniquito {
  id: string;
  articulo: string; // lo que va tras "Artículo N° ", ej. "159, N°4"
  terminos: string; // razón del término (mayúsculas), ej. "VENCIMIENTO DEL PLAZO CONVENIDO"
  etiqueta: string;
}

export const CAUSALES_FINIQUITO: CausalFiniquito[] = [
  { id: '159-4', articulo: '159, N°4', terminos: 'VENCIMIENTO DEL PLAZO CONVENIDO', etiqueta: 'Art. 159 N°4 – Vencimiento del plazo convenido' },
  { id: '159-5', articulo: '159, N°5', terminos: 'CONCLUSIÓN DEL TRABAJO O SERVICIO QUE DIO ORIGEN AL CONTRATO', etiqueta: 'Art. 159 N°5 – Conclusión del trabajo o servicio' },
  { id: '159-1', articulo: '159, N°1', terminos: 'MUTUO ACUERDO DE LAS PARTES', etiqueta: 'Art. 159 N°1 – Mutuo acuerdo de las partes' },
  { id: '159-2', articulo: '159, N°2', terminos: 'RENUNCIA DEL TRABAJADOR', etiqueta: 'Art. 159 N°2 – Renuncia del trabajador' },
  { id: '161', articulo: '161', terminos: 'NECESIDADES DE LA EMPRESA, ESTABLECIMIENTO O SERVICIO', etiqueta: 'Art. 161 – Necesidades de la empresa' },
];

export const CAUSAL_FINIQUITO_DEFAULT_ID = '159-4';

// ---------------------------------------------------------------------------
// Referencia de marcadores para la plantilla Word (finiquito.docx)
// ---------------------------------------------------------------------------

export interface CampoFiniquito {
  marcador: string;
  descripcion: string;
}

/**
 * Marcadores {d.} que reconoce la plantilla finiquito.docx. Se muestran en la
 * vista para que quien edite el Word sepa exactamente qué escribir.
 */
export const CAMPOS_FINIQUITO: CampoFiniquito[] = [
  { marcador: '{d.programa.proyecto}', descripcion: 'Párrafo del proyecto/convenio (cabecera)' },
  { marcador: '{d.trabajador.nombre_completo_upper}', descripcion: 'Nombre del trabajador en MAYÚSCULAS' },
  { marcador: '{d.trabajador.tratamiento_cap}', descripcion: 'Don / Doña según género' },
  { marcador: '{d.trabajador.del_dela}', descripcion: 'DEL / DE LA (título)' },
  { marcador: '{d.trabajador.genero_a}', descripcion: 'Sufijo "A" femenino (TRABAJADOR__)' },
  { marcador: '{d.trabajador.rut_miles}', descripcion: 'RUT con puntos, sin dígito verificador' },
  { marcador: '{d.trabajador.dv}', descripcion: 'Dígito verificador del RUT' },
  { marcador: '{d.trabajador.rut_formateado}', descripcion: 'RUT completo con guion (12.345.678-9)' },
  { marcador: '{d.contrato.fecha_inicio:formatD(LL)}', descripcion: 'Fecha de inicio (1 de mayo de 2026)' },
  { marcador: '{d.contrato.fecha_termino:formatD(LL)}', descripcion: 'Fecha de término' },
  { marcador: '{d.documento.ciudad}', descripcion: 'Ciudad de emisión' },
  { marcador: '{d.documento.fecha_emision:formatD(LL)}', descripcion: 'Fecha de emisión en texto' },
  { marcador: '{d.documento.redactor_iniciales}', descripcion: 'Iniciales del redactor (CDC/JAN/…)' },
  { marcador: '{d.institucion.rut}', descripcion: 'RUT de la institución (61.313.000-4)' },
  { marcador: '{d.institucion.region}', descripcion: 'Región de la institución' },
  { marcador: '{d.institucion.domicilio}', descripcion: 'Domicilio de la institución' },
  { marcador: '{d.firmante.tratamiento}', descripcion: 'Don / Doña del firmante' },
  { marcador: '{d.firmante.nombre}', descripcion: 'Nombre completo del firmante' },
  { marcador: '{d.firmante.nombre_corto}', descripcion: 'Nombre bajo la firma (GUILLERMO CISTERNAS V.)' },
  { marcador: '{d.firmante.cargo}', descripcion: 'Cargo del firmante' },
  { marcador: '{d.firmante.rut}', descripcion: 'RUT del firmante' },
  { marcador: '{d.firmante.profesion}', descripcion: 'Profesión del firmante' },
  { marcador: '{d.finiquito.terminos}', descripcion: 'Razón del término (causal)' },
  { marcador: '{d.finiquito.articulo}', descripcion: 'Artículo del Código del Trabajo (159, N°4)' },
  { marcador: '{d.finiquito.fp_texto}', descripcion: 'Días de feriado proporcional (5,42)' },
  { marcador: '{d.finiquito.total_texto}', descripcion: 'Monto a pagar con miles (108.400)' },
  { marcador: '{d.finiquito.total_palabras}', descripcion: 'Monto en palabras (… PESOS)' },
];

// ---------------------------------------------------------------------------
// Institución / firmante por defecto (tomados de la plantilla original)
// ---------------------------------------------------------------------------

export const INSTITUCION_FINIQUITO = {
  nombre: 'CORPORACIÓN NACIONAL FORESTAL',
  rut: '61.313.000-4',
  region: 'REGIÓN DE ARICA Y PARINACOTA',
  domicilio: 'Avenida Vicuña Mackenna Nº 820 de la ciudad de Arica',
};

export interface FirmanteFiniquito {
  tratamiento: string; // "Don" / "Doña"
  nombre: string; // nombre completo (aparece en la introducción)
  nombre_corto: string; // como aparece bajo la firma, ej. "GUILLERMO CISTERNAS V."
  cargo: string;
  rut: string;
  profesion: string;
}

export const FIRMANTE_FINIQUITO_DEFAULT: FirmanteFiniquito = {
  tratamiento: 'Don',
  nombre: 'GUILLERMO EUGENIO CISTERNAS VALENZUELA',
  nombre_corto: 'GUILLERMO CISTERNAS V.',
  cargo: 'DIRECTOR REGIONAL (I)',
  rut: '7.472.509-0',
  profesion: 'Ingeniero Forestal',
};

// ---------------------------------------------------------------------------
// Construcción del objeto de datos para Carbone
// ---------------------------------------------------------------------------

/** Formatea un número entero al estilo chileno con puntos de miles (108400 → "108.400"). */
export function formatearMiles(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formatea el RUT numérico + dígito verificador (12345678, "9" → "12.345.678-9"). */
export function formatearRutFiniquito(rut: number, dv: string): string {
  return `${formatearMiles(rut)}-${dv}`;
}

/** Devuelve "Don"/"Doña"/"Don(ña)" (capitalizado) según el género. */
function tratamientoCap(genero?: string): string {
  if (genero === 'M') return 'Don';
  if (genero === 'F') return 'Doña';
  return 'Don(ña)';
}

/**
 * Estructura enviada a Carbone. En la plantilla Word cada valor se referencia
 * con el prefijo {d.}, por ejemplo {d.trabajador.nombre_completo_upper}.
 */
export interface DatosFiniquito {
  trabajador: {
    nombre_completo_upper: string;
    nombres: string;
    primer_apellido: string;
    segundo_apellido: string;
    rut_miles: string;
    dv: string;
    rut_formateado: string;
    tratamiento_cap: string; // Don / Doña
    del_dela: string; // DEL / DE LA
    genero_a: string; // "A" si es femenino, "" en otro caso
  };
  contrato: {
    fecha_inicio: string; // ISO
    fecha_termino: string; // ISO
  };
  documento: {
    ciudad: string;
    fecha_emision: string; // ISO
    redactor_iniciales: string;
  };
  institucion: {
    nombre: string;
    rut: string;
    region: string;
    domicilio: string;
  };
  firmante: FirmanteFiniquito;
  programa: {
    nombre: string;
    proyecto: string;
  };
  finiquito: {
    terminos: string;
    articulo: string;
    sueldo_imponible: number; // base del cálculo
    valor_dia: number;
    meses: number;
    dias: number;
    dias_habiles: number; // sin redondear (2.4167)
    dias_habiles_texto: string; // ej. "2,42"
    dias_inhabiles: number;
    /** Feriados legales (ISO) considerados al proyectar; viajan con los datos
     *  para que el Excel de cálculo pinte los mismos días que el documento. */
    feriados: string[];
    fp: number; // 5.42
    fp_texto: string; // "5,42"
    total: number; // 108400
    total_texto: string; // "108.400"
    total_palabras: string; // "CIENTO OCHO MIL CUATROCIENTOS PESOS"
  };
}

export interface OpcionesFiniquito {
  ciudad?: string;
  redactorIniciales?: string;
  causal?: CausalFiniquito;
  programa?: ProgramaFiniquito;
  firmante?: FirmanteFiniquito;
  /** Días inhábiles ajustados a mano; si se omite, se estiman. */
  diasInhabiles?: number;
  /** Feriados legales (ISO). Ver lib/feriados.ts. */
  feriados?: Set<string>;
}

/** Formatea un número con coma decimal chilena y n decimales (2,42). */
function formatearDecimal(n: number, decimales: number): string {
  return n.toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Construye el objeto de datos de finiquito a partir del trabajador, el contrato
 * seleccionado y las opciones de la vista. Devuelve también el resultado del
 * cálculo por si la vista quiere mostrar el desglose.
 */
export function construirDatosFiniquito(
  trabajador: Trabajador,
  contrato: Contrato,
  opciones: OpcionesFiniquito = {},
): { datos: DatosFiniquito; resultado: ResultadoFiniquito } {
  const causal =
    opciones.causal ?? CAUSALES_FINIQUITO.find((c) => c.id === CAUSAL_FINIQUITO_DEFAULT_ID)!;
  const programa = opciones.programa ?? PROGRAMAS_FINIQUITO[0];
  const firmante = opciones.firmante ?? FIRMANTE_FINIQUITO_DEFAULT;
  const genero = trabajador.genero;

  const fechaTermino = contrato.fecha_termino ?? '';
  const resultado = calcularFiniquito({
    fechaInicio: contrato.fecha_inicio,
    fechaTermino,
    sueldoImponible: contrato.sueldo_base ?? 0,
    diasInhabiles: opciones.diasInhabiles,
    feriados: opciones.feriados,
  });

  const segundo = trabajador.segundo_apellido ?? '';

  const datos: DatosFiniquito = {
    trabajador: {
      nombre_completo_upper:
        `${trabajador.nombres} ${trabajador.primer_apellido} ${segundo}`.trim().toUpperCase(),
      nombres: trabajador.nombres,
      primer_apellido: trabajador.primer_apellido,
      segundo_apellido: segundo,
      rut_miles: formatearMiles(trabajador.rut),
      dv: trabajador.dv,
      rut_formateado: formatearRutFiniquito(trabajador.rut, trabajador.dv),
      tratamiento_cap: tratamientoCap(genero),
      del_dela: genero === 'F' ? 'DE LA' : 'DEL',
      genero_a: genero === 'F' ? 'A' : '',
    },
    contrato: {
      fecha_inicio: contrato.fecha_inicio,
      fecha_termino: fechaTermino,
    },
    documento: {
      ciudad: opciones.ciudad ?? 'Arica',
      fecha_emision: new Date().toISOString().split('T')[0],
      redactor_iniciales: (opciones.redactorIniciales ?? 'crh').toLowerCase(),
    },
    institucion: INSTITUCION_FINIQUITO,
    firmante,
    programa: { nombre: programa.nombre, proyecto: programa.proyecto },
    finiquito: {
      terminos: causal.terminos,
      articulo: causal.articulo,
      sueldo_imponible: contrato.sueldo_base ?? 0,
      valor_dia: resultado.valorDia,
      meses: resultado.meses,
      dias: resultado.dias,
      dias_habiles: resultado.diasHabiles,
      dias_habiles_texto: formatearDecimal(resultado.diasHabiles, 2),
      dias_inhabiles: resultado.diasInhabiles,
      feriados: [...(opciones.feriados ?? [])],
      fp: resultado.fp,
      fp_texto: formatearDecimal(resultado.fp, 2),
      total: resultado.total,
      total_texto: formatearMiles(resultado.total),
      total_palabras: montoEnPalabras(resultado.total),
    },
  };

  return { datos, resultado };
}
