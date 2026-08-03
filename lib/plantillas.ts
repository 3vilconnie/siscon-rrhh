// lib/plantillas.ts
// Registro de plantillas Word disponibles para la generación de documentos con Carbone.
// Este archivo es COMPARTIDO entre el cliente (vista) y el servidor (route handler):
// no debe importar nada exclusivo de servidor (fs, path, etc.).

import { Trabajador, Contrato } from '@/types';

/** Un campo (marcador) que la plantilla puede usar, para mostrarlo como referencia en la vista. */
export interface CampoPlantilla {
  marcador: string;
  descripcion: string;
}

/** Definición de una plantilla Word disponible en la carpeta /plantillas. */
export interface PlantillaDoc {
  id: string;
  nombre: string;
  descripcion: string;
  /** Nombre del archivo .docx dentro de la carpeta /plantillas del proyecto. */
  archivo: string;
  /** Si es true, la vista exige elegir un contrato antes de generar. */
  requiereContrato: boolean;
  /** Si es true, la vista muestra el formulario de datos de la notificación. */
  requiereDatosNotificacion?: boolean;
  /** Si es true, la vista muestra el editor del firmante (nombre, cargo, RUT). */
  requiereFirmante?: boolean;
}

/**
 * Estructura de datos que se envía a Carbone. En la plantilla Word cada valor
 * se referencia con el prefijo {d.}, por ejemplo {d.trabajador.nombre_completo}.
 */
export interface DatosDocumento {
  trabajador: {
    rut: number;
    dv: string;
    rut_formateado: string; // 12.345.678-9
    rut_miles: string; // 12.345.678 (sin dígito verificador)
    nombres: string;
    primer_apellido: string;
    segundo_apellido: string;
    nombre_completo: string;
    genero: string;
    tratamiento: string; // "don" / "doña" / "don(ña)"
    articulo: string; // "el" / "la" / "el(la)"
    sr_sra: string; // "SR." / "SRA." / "SR(A)."
    trabajador_a: string; // "TRABAJADOR" / "TRABAJADORA"
    del_dela: string; // "DEL" / "DE LA"
    genero_a: string; // "A" si es femenino, "" en otro caso (sufijo SR__/TRABAJADOR__)
  };
  contrato: {
    fecha_inicio: string; // ISO YYYY-MM-DD (Carbone la formatea con :formatD)
    fecha_termino: string; // ISO o "" si es indefinido
    fecha_termino_texto: string; // "Indefinido" cuando no hay término
    jornada: number;
    sueldo_base: number;
  } | null;
  documento: {
    ciudad: string;
    fecha_emision: string; // ISO YYYY-MM-DD
  };
  institucion: {
    nombre: string;
    region: string;
    departamento: string;
    seccion: string;
  };
  firmante: {
    nombre: string; // ej. "GUILLERMO EUGENIO CISTERNAS VALENZUELA"
    cargo: string; // ej. "DIRECTOR(I) CONAF REGIÓN DE ARICA Y PARINACOTA"
    rut: string; // ej. "61.313.000-4"
  };
  // Datos específicos de la Notificación de Fin de Contrato (null en otras plantillas).
  notificacion: {
    numero: string; // NOTIFICACIÓN Nº
    fecha_notificacion: string; // FECHA_MOD, ISO
    articulo: string; // referencia completa del artículo, ej. "159, N°4" o "161"
    causal: string; // texto de la causal (mayúsculas, tal como va en el documento)
    fin_contrato: string; // FIN_CONT, ISO (fecha de término comunicada)
    redactor_iniciales: string; // RDINICIALES, ya en minúscula
  } | null;
}

/** Una causal de término del catálogo del Código del Trabajo. */
export interface CausalItem {
  id: string; // identificador único, ej. "159-4"
  articulo: string; // lo que va tras "artículo " en el documento, ej. "159, N°4" o "161"
  causal: string; // texto de la causal (mayúsculas)
  etiqueta: string; // texto legible para el desplegable
}

/**
 * Catálogo de causales de término de contrato (Código del Trabajo).
 * El documento muestra: «artículo {articulo} del Código del Trabajo, que es; "{causal}"».
 */
export const CAUSALES: CausalItem[] = [
  { id: '159-1', articulo: '159, N°1', causal: 'MUTUO ACUERDO DE LAS PARTES', etiqueta: 'Art. 159 N°1 – Mutuo acuerdo de las partes' },
  { id: '159-2', articulo: '159, N°2', causal: 'RENUNCIA DEL TRABAJADOR', etiqueta: 'Art. 159 N°2 – Renuncia del trabajador' },
  { id: '159-3', articulo: '159, N°3', causal: 'MUERTE DEL TRABAJADOR', etiqueta: 'Art. 159 N°3 – Muerte del trabajador' },
  { id: '159-4', articulo: '159, N°4', causal: 'VENCIMIENTO DEL PLAZO CONVENIDO EN EL CONTRATO', etiqueta: 'Art. 159 N°4 – Vencimiento del plazo convenido' },
  { id: '159-5', articulo: '159, N°5', causal: 'CONCLUSIÓN DEL TRABAJO O SERVICIO QUE DIO ORIGEN AL CONTRATO', etiqueta: 'Art. 159 N°5 – Conclusión del trabajo o servicio' },
  { id: '159-6', articulo: '159, N°6', causal: 'CASO FORTUITO O FUERZA MAYOR', etiqueta: 'Art. 159 N°6 – Caso fortuito o fuerza mayor' },
  { id: '160-1', articulo: '160, N°1', causal: 'CONDUCTAS INDEBIDAS Y GRAVES DEL TRABAJADOR, TALES COMO FALTA DE PROBIDAD, ACOSO SEXUAL, MALTRATO FÍSICO CONTRA EL EMPLEADOR U OTRO TRABAJADOR, INJURIAS CONTRA EL EMPLEADOR, CONDUCTA INMORAL QUE AFECTE LA EMPRESA Y ACOSO LABORAL', etiqueta: 'Art. 160 N°1 – Conductas indebidas y graves' },
  { id: '160-2', articulo: '160, N°2', causal: 'NEGOCIACIONES DEL TRABAJADOR DENTRO DEL GIRO DEL EMPLEADOR', etiqueta: 'Art. 160 N°2 – Negociaciones dentro del giro' },
  { id: '160-3', articulo: '160, N°3', causal: 'NO CONCURRENCIA DEL TRABAJADOR A SUS LABORES SIN CAUSA JUSTIFICADA', etiqueta: 'Art. 160 N°3 – No concurrencia sin causa justificada' },
  { id: '160-4', articulo: '160, N°4', causal: 'ABANDONO DEL TRABAJO, ENTENDIÉNDOSE POR TAL: A) LA SALIDA INJUSTIFICADA DEL TRABAJADOR DEL SITIO DE LA FAENA Y DURANTE LAS HORAS DE TRABAJO Y B) LA NEGATIVA A TRABAJAR SIN CAUSA JUSTIFICADA EN LAS FAENAS CONVENIDAS EN EL CONTRATO', etiqueta: 'Art. 160 N°4 – Abandono del trabajo' },
  { id: '160-5', articulo: '160, N°5', causal: 'ACTOS, OMISIONES O IMPRUDENCIAS TEMERARIAS', etiqueta: 'Art. 160 N°5 – Actos, omisiones o imprudencias temerarias' },
  { id: '160-6', articulo: '160, N°6', causal: 'EL PERJUICIO MATERIAL CAUSADO INTENCIONALMENTE EN LAS INSTALACIONES, MAQUINARIAS, HERRAMIENTAS, ÚTILES DE TRABAJO, PRODUCTOS O MERCADERÍAS', etiqueta: 'Art. 160 N°6 – Perjuicio material intencional' },
  { id: '160-7', articulo: '160, N°7', causal: 'INCUMPLIMIENTO GRAVE DE LAS OBLIGACIONES QUE IMPONE EL CONTRATO', etiqueta: 'Art. 160 N°7 – Incumplimiento grave del contrato' },
  { id: '161-nec', articulo: '161', causal: 'NECESIDADES DE LA EMPRESA, ESTABLECIMIENTO O SERVICIO', etiqueta: 'Art. 161 – Necesidades de la empresa' },
  { id: '161-des', articulo: '161', causal: 'DESAHUCIO ESCRITO DEL EMPLEADOR', etiqueta: 'Art. 161 – Desahucio escrito del empleador' },
  { id: '163bis', articulo: '163 bis', causal: 'POR HABER SIDO SOMETIDO EL EMPLEADOR, MEDIANTE RESOLUCIÓN JUDICIAL, A UN PROCEDIMIENTO CONCURSAL DE LIQUIDACIÓN DE SUS BIENES', etiqueta: 'Art. 163 bis – Procedimiento concursal de liquidación' },
];

/** Causal por defecto: la más común (vencimiento del plazo fijo). */
export const CAUSAL_DEFAULT_ID = '159-4';

/** Datos que la vista recolecta para una Notificación de Fin de Contrato. */
export interface DatosNotificacionInput {
  numero: string;
  fecha_notificacion: string; // ISO
  articulo: string; // referencia completa, ej. "159, N°4"
  causal: string; // texto de la causal
  fin_contrato?: string; // ISO; por defecto la fecha de término del contrato
  redactor_iniciales: string;
}

/** Valores por defecto para una Notificación de término de plazo fijo (causal más común). */
export const NOTIFICACION_DEFAULTS: Omit<DatosNotificacionInput, 'numero'> = {
  fecha_notificacion: '',
  articulo: CAUSALES.find((c) => c.id === CAUSAL_DEFAULT_ID)!.articulo,
  causal: CAUSALES.find((c) => c.id === CAUSAL_DEFAULT_ID)!.causal,
  fin_contrato: '',
  redactor_iniciales: 'crh',
};

/** Datos institucionales fijos (los mismos que aparecen en el módulo de Recepción). */
export const INSTITUCION: DatosDocumento['institucion'] = {
  nombre: 'CORPORACIÓN NACIONAL FORESTAL',
  region: 'REGIÓN DE ARICA Y PARINACOTA',
  departamento: 'DEPTO. FINANZAS Y ADMINISTRACIÓN',
  seccion: 'SECCIÓN RECURSOS HUMANOS',
};

/** Firmante por defecto (editable en la vista al generar). */
export const FIRMANTE_DEFAULT: DatosDocumento['firmante'] = {
  nombre: 'GUILLERMO EUGENIO CISTERNAS VALENZUELA',
  cargo: 'DIRECTOR(I) CONAF REGIÓN DE ARICA Y PARINACOTA',
  rut: '61.313.000-4',
};

/**
 * Catálogo de plantillas. Para agregar una nueva:
 *   1. Diseña el .docx en Word con marcadores {d.trabajador.nombres}, etc.
 *   2. Guárdalo en la carpeta /plantillas del proyecto.
 *   3. Añade aquí su definición.
 */
export const PLANTILLAS: PlantillaDoc[] = [
  {
    id: 'certificado-antiguedad',
    nombre: 'Certificado de Antigüedad',
    descripcion: 'Certifica el período de servicio del trabajador según su contrato.',
    archivo: 'certificado-antiguedad.docx',
    requiereContrato: true,
  },
  {
    id: 'certificado-vigencia',
    nombre: 'Certificado de Vigencia de Contrato',
    descripcion: 'Acredita que el trabajador mantiene un contrato vigente.',
    archivo: 'certificado-vigencia.docx',
    requiereContrato: true,
  },
  {
    id: 'notificacion-fin-contrato',
    nombre: 'Notificación de Fin de Contrato',
    descripcion:
      'Comunica el término del contrato de plazo fijo (art. 159 N°4 del Código del Trabajo).',
    archivo: 'notificacion-fin-contrato.docx',
    requiereContrato: true,
    requiereDatosNotificacion: true,
    requiereFirmante: true,
  },
];

/**
 * Referencia de marcadores para mostrar en la vista, de modo que quien edite
 * la plantilla en Word sepa exactamente qué escribir (con la sintaxis {d.}).
 */
export const CAMPOS_DISPONIBLES: CampoPlantilla[] = [
  { marcador: '{d.trabajador.nombre_completo}', descripcion: 'Nombres y apellidos' },
  { marcador: '{d.trabajador.nombres}', descripcion: 'Solo nombres' },
  { marcador: '{d.trabajador.primer_apellido}', descripcion: 'Apellido paterno' },
  { marcador: '{d.trabajador.segundo_apellido}', descripcion: 'Apellido materno' },
  { marcador: '{d.trabajador.rut_formateado}', descripcion: 'RUT con puntos y guion (12.345.678-9)' },
  { marcador: '{d.trabajador.tratamiento}', descripcion: 'don / doña según género' },
  { marcador: '{d.trabajador.sr_sra}', descripcion: 'SR. / SRA. según género' },
  { marcador: '{d.trabajador.trabajador_a}', descripcion: 'TRABAJADOR / TRABAJADORA' },
  { marcador: '{d.trabajador.del_dela}', descripcion: 'DEL / DE LA según género' },
  { marcador: '{d.contrato.fecha_inicio:formatD(LL)}', descripcion: 'Fecha de inicio (30 de abril de 2026)' },
  { marcador: '{d.contrato.fecha_termino_texto}', descripcion: 'Fecha de término o "Indefinido"' },
  { marcador: '{d.contrato.jornada}', descripcion: 'Horas de jornada' },
  { marcador: '{d.contrato.sueldo_base:formatC(0)}', descripcion: 'Sueldo base como moneda sin decimales' },
  { marcador: '{d.documento.ciudad}', descripcion: 'Ciudad de emisión' },
  { marcador: '{d.documento.fecha_emision:formatD(LL)}', descripcion: 'Fecha de emisión en texto' },
  { marcador: '{d.institucion.nombre}', descripcion: 'Nombre de la institución' },
  { marcador: '{d.firmante.nombre}', descripcion: 'Nombre del firmante' },
  { marcador: '{d.firmante.cargo}', descripcion: 'Cargo del firmante' },
  { marcador: '{d.firmante.rut}', descripcion: 'RUT del firmante' },
  // Solo disponibles en la Notificación de Fin de Contrato:
  { marcador: '{d.notificacion.numero}', descripcion: 'Número de la notificación' },
  { marcador: '{d.notificacion.fin_contrato:formatD(LL)}', descripcion: 'Fecha de término comunicada' },
  { marcador: "{d.notificacion.fin_contrato:formatD('MMMM [de] YYYY')}", descripcion: 'Mes/año del término (cotizaciones)' },
  { marcador: '{d.notificacion.articulo}', descripcion: 'Artículo completo (ej. "159, N°4")' },
  { marcador: '{d.notificacion.causal}', descripcion: 'Texto de la causal' },
  { marcador: '{d.notificacion.redactor_iniciales}', descripcion: 'Iniciales del redactor (minúscula)' },
];

/** Formatea un RUT numérico + dígito verificador al formato chileno 12.345.678-9. */
export function formatearRut(rut: number, dv: string): string {
  const miles = rut.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${miles}-${dv}`;
}

/** Devuelve "don"/"doña"/"don(ña)" según el género registrado. */
function tratamientoPorGenero(genero?: string): string {
  if (genero === 'M') return 'don';
  if (genero === 'F') return 'doña';
  return 'don(ña)';
}

/** Devuelve "el"/"la"/"el(la)" según el género registrado. */
function articuloPorGenero(genero?: string): string {
  if (genero === 'M') return 'el';
  if (genero === 'F') return 'la';
  return 'el(la)';
}

/**
 * Construye el objeto de datos que se envía a Carbone a partir de un trabajador
 * y (opcionalmente) el contrato seleccionado.
 */
export function construirDatosDocumento(
  trabajador: Trabajador,
  contrato: Contrato | null,
  opciones: {
    ciudad?: string;
    notificacion?: DatosNotificacionInput;
    firmante?: DatosDocumento['firmante'];
  } = {},
): DatosDocumento {
  const segundo = trabajador.segundo_apellido ?? '';
  const genero = trabajador.genero;
  return {
    trabajador: {
      rut: trabajador.rut,
      dv: trabajador.dv,
      rut_formateado: formatearRut(trabajador.rut, trabajador.dv),
      rut_miles: trabajador.rut.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      nombres: trabajador.nombres,
      primer_apellido: trabajador.primer_apellido,
      segundo_apellido: segundo,
      nombre_completo: `${trabajador.nombres} ${trabajador.primer_apellido} ${segundo}`.trim(),
      genero: genero ?? 'SR',
      tratamiento: tratamientoPorGenero(genero),
      articulo: articuloPorGenero(genero),
      sr_sra: genero === 'F' ? 'SRA.' : genero === 'M' ? 'SR.' : 'SR(A).',
      trabajador_a: genero === 'F' ? 'TRABAJADORA' : 'TRABAJADOR',
      del_dela: genero === 'F' ? 'DE LA' : 'DEL',
      genero_a: genero === 'F' ? 'A' : '',
    },
    contrato: contrato
      ? {
          fecha_inicio: contrato.fecha_inicio,
          fecha_termino: contrato.fecha_termino ?? '',
          fecha_termino_texto: contrato.fecha_termino ?? 'Indefinido',
          jornada: contrato.jornada ?? 0,
          sueldo_base: contrato.sueldo_base ?? 0,
        }
      : null,
    documento: {
      ciudad: opciones.ciudad ?? 'Arica',
      fecha_emision: new Date().toISOString().split('T')[0],
    },
    institucion: INSTITUCION,
    firmante: opciones.firmante ?? FIRMANTE_DEFAULT,
    notificacion: opciones.notificacion
      ? {
          numero: opciones.notificacion.numero,
          fecha_notificacion:
            opciones.notificacion.fecha_notificacion || new Date().toISOString().split('T')[0],
          articulo: opciones.notificacion.articulo,
          causal: opciones.notificacion.causal,
          fin_contrato:
            opciones.notificacion.fin_contrato || contrato?.fecha_termino || '',
          redactor_iniciales: (opciones.notificacion.redactor_iniciales || '').toLowerCase(),
        }
      : null,
  };
}
