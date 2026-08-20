// lib/horasExtra.ts
// Datos y helpers para el Anexo de Contrato por horas extraordinarias, que se
// genera con Carbone sobre plantillas/anexo-horas-extra.docx.
//
// Reemplaza la combinación de correspondencia que se hacía en Word contra la
// planilla "DATA -Plantilla horas extras.xlsm". La correspondencia entre las
// columnas de esa planilla y este módulo es directa:
//
//   INICIALES    -> documento.redactor_iniciales
//   FECHA_EMIS   -> documento.fecha_emision
//   NOMBRE       -> trabajador.nombre_upper        (tabla trabajadores)
//   APELLIDO_P   -> trabajador.apellido_p_upper    (tabla trabajadores)
//   APELLIDO_M   -> trabajador.apellido_m_upper    (tabla trabajadores)
//   GENERO       -> g.*                            (tabla trabajadores)
//   RUT / DV     -> trabajador.rut_miles / dv      (tabla trabajadores)
//   NACIONALIDAD -> trabajador.nacionalidad        (tabla trabajadores)
//   ESTADO_CIV   -> trabajador.estado_civil        (tabla trabajadores)
//   DOMICILIO    -> trabajador.domicilio           (tabla trabajadores)
//   CIUDAD       -> trabajador.comuna              (tabla trabajadores)
//   FECHA_NAC    -> trabajador.fecha_nac           (tabla trabajadores)
//   FECHA_HORAS  -> horas.mes_texto
//   HORAS        -> horas.total
//   SELECCIÓN    -> ya no existe: es la selección en pantalla.

import { textosGenero, type DatosContrato } from '@/lib/contrato';
import type { Trabajador } from '@/types';

export interface DatosHorasExtra {
  documento: {
    ciudad: string;
    fecha_emision: string; // ISO
    redactor_iniciales: string;
  };
  trabajador: {
    trato: string;
    nombre_upper: string;
    apellido_p_upper: string;
    apellido_m_upper: string;
    rut_miles: string;
    dv: string;
    nacionalidad: string;
    estado_civil: string;
    domicilio: string;
    comuna: string;
    fecha_nac: string; // ISO
  };
  g: DatosContrato['g'];
  horas: {
    /** Mes pactado, ya escrito en español: "junio 2026". */
    mes_texto: string;
    /** Mismo mes en ISO (primer día), para guardarlo y ordenarlo. */
    mes_iso: string;
    total: number;
  };
}

export interface EntradaHorasExtra {
  /** Mes de las horas pactadas, en formato "YYYY-MM". */
  mes: string;
  /** Total de horas extraordinarias pactadas para ese mes. */
  horas: number;
  /** Fecha del documento. Por defecto, el primer día del mes siguiente. */
  fechaEmision?: string; // ISO
  ciudad?: string;
  redactorIniciales?: string;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "2026-06" -> "junio 2026". Devuelve "" si el mes no es válido. */
export function mesEnPalabras(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? '');
  if (!m) return '';
  const indice = Number(m[2]) - 1;
  if (indice < 0 || indice > 11) return '';
  return `${MESES[indice]} ${m[1]}`;
}

/**
 * Fecha de emisión por defecto: el primer día del mes SIGUIENTE al pactado.
 * Es lo que se venía haciendo en la planilla (horas de junio -> emitido el
 * 1 de julio), porque el anexo se firma una vez cerrado el mes.
 */
export function emisionPorDefecto(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? '');
  if (!m) return new Date().toISOString().split('T')[0];
  const anio = Number(m[1]);
  const mesNum = Number(m[2]);
  const siguiente = mesNum === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mesNum + 1 };
  return `${siguiente.a}-${String(siguiente.m).padStart(2, '0')}-01`;
}

/** Mes anterior al actual en formato "YYYY-MM": el que normalmente se pacta. */
export function mesAnterior(): string {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Campos del trabajador que la plantilla necesita y que la tabla `trabajadores`
 * puede tener vacíos. Se usa para avisar antes de generar, no para bloquear.
 */
export const CAMPOS_REQUERIDOS_HORAS_EXTRA = [
  { campo: 'genero', etiqueta: 'Género' },
  { campo: 'nacionalidad', etiqueta: 'Nacionalidad' },
  { campo: 'estado_civil', etiqueta: 'Estado civil' },
  { campo: 'domicilio', etiqueta: 'Domicilio' },
  { campo: 'comuna', etiqueta: 'Ciudad' },
  { campo: 'fecha_nac', etiqueta: 'Fecha de nacimiento' },
] as const;

/** Devuelve las etiquetas de los campos que le faltan al trabajador. */
export function camposFaltantes(t: Trabajador): string[] {
  return CAMPOS_REQUERIDOS_HORAS_EXTRA.filter((c) => {
    const v = (t as unknown as Record<string, unknown>)[c.campo];
    return v === null || v === undefined || String(v).trim() === '';
  }).map((c) => c.etiqueta);
}

export function construirDatosHorasExtra(
  trabajador: Trabajador,
  entrada: EntradaHorasExtra,
): DatosHorasExtra {
  const rutMiles = (trabajador.rut || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return {
    documento: {
      ciudad: entrada.ciudad?.trim() || 'Arica',
      fecha_emision: entrada.fechaEmision || emisionPorDefecto(entrada.mes),
      redactor_iniciales: (entrada.redactorIniciales ?? 'crh').toLowerCase(),
    },
    trabajador: {
      trato: trabajador.genero === 'F' ? 'Doña' : 'Don',
      nombre_upper: (trabajador.nombres ?? '').toUpperCase(),
      apellido_p_upper: (trabajador.primer_apellido ?? '').toUpperCase(),
      apellido_m_upper: (trabajador.segundo_apellido ?? '').toUpperCase(),
      rut_miles: rutMiles,
      dv: String(trabajador.dv ?? ''),
      nacionalidad: trabajador.nacionalidad ?? '',
      estado_civil: trabajador.estado_civil ?? '',
      domicilio: trabajador.domicilio ?? '',
      comuna: trabajador.comuna ?? '',
      fecha_nac: trabajador.fecha_nac ?? '',
    },
    g: textosGenero(trabajador.genero ?? undefined),
    horas: {
      mes_texto: mesEnPalabras(entrada.mes),
      mes_iso: `${entrada.mes}-01`,
      total: entrada.horas,
    },
  };
}

/**
 * Catálogo de marcadores de plantillas/anexo-horas-extra.docx.
 * Lo usa el validador de plantillas (lib/validarPlantillas.ts) para avisar si
 * un .docx subido desde Admin usa marcadores que este módulo no rellena.
 */
export const CAMPOS_HORAS_EXTRA = [
  {
    marcador: '{d.documento.redactor_iniciales}',
    descripcion: 'Iniciales de quien redacta (CDC/JAN/xxx)',
  },
  { marcador: '{d.documento.fecha_emision:formatD(LL)}', descripcion: 'Fecha del documento' },
  { marcador: '{d.trabajador.nombre_upper}', descripcion: 'Nombres en mayusculas' },
  { marcador: '{d.trabajador.apellido_p_upper}', descripcion: 'Apellido paterno en mayusculas' },
  { marcador: '{d.trabajador.apellido_m_upper}', descripcion: 'Apellido materno en mayusculas' },
  { marcador: '{d.trabajador.rut_miles}', descripcion: 'RUT con separador de miles' },
  { marcador: '{d.trabajador.dv}', descripcion: 'Digito verificador' },
  { marcador: '{d.trabajador.nacionalidad}', descripcion: 'Nacionalidad' },
  { marcador: '{d.trabajador.estado_civil}', descripcion: 'Estado civil' },
  { marcador: '{d.trabajador.domicilio}', descripcion: 'Domicilio' },
  { marcador: '{d.trabajador.comuna}', descripcion: 'Ciudad del domicilio' },
  { marcador: '{d.trabajador.fecha_nac:formatD(LL)}', descripcion: 'Fecha de nacimiento' },
  { marcador: '{d.g.el_la}', descripcion: 'el / la segun genero' },
  { marcador: '{d.g.genero_a}', descripcion: 'Sufijo a en femenino, vacio en masculino' },
  { marcador: '{d.g.genero_o_a}', descripcion: 'Sufijo o / a segun genero' },
  { marcador: '{d.horas.mes_texto}', descripcion: 'Mes pactado en palabras (junio 2026)' },
  { marcador: '{d.horas.total}', descripcion: 'Total de horas extraordinarias pactadas' },
];
