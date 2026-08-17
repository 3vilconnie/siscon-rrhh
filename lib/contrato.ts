// lib/contrato.ts
// Datos, catálogos y helpers para generar el Contrato de Trabajo de Plazo Fijo
// con Carbone sobre plantillas/contrato-trabajo.docx.
//
// Muchos campos del contrato (nacionalidad, estado civil, domicilio, previsión,
// salud, bonos, labores, etc.) NO están en la base de datos: se capturan en el
// formulario. Del trabajador y su contrato se pre-rellenan nombre, RUT, fechas
// y sueldo.
//
// Compartido cliente/servidor: no importar módulos exclusivos de servidor.

import { Trabajador, Contrato } from '@/types';
import { montoEnPalabras, formatearMiles } from '@/lib/finiquito';

// ---------------------------------------------------------------------------
// Catálogo de programas (CABECERA): proyecto, subtítulo del título y nombre.
// ---------------------------------------------------------------------------

export interface ProgramaContrato {
  id: string; // PZD1 / PZD3 / CONADI
  etiqueta: string;
  proyecto: string; // párrafo superior
  subtitulo: string; // "(FONDO DE TERCERO ...)" bajo el título
  nombre: string; // nombre del programa usado en la cláusula PRIMERO
}

export const PROGRAMAS_CONTRATO: ProgramaContrato[] = [
  {
    id: 'PZD3',
    etiqueta: 'PZD3 — Empleos Verdes (Reserva Biósfera Lauca)',
    proyecto:
      "PROYECTO: 'CONVENIO DE TRANSFERENCIA Y COLABORACIÓN, ENTRE LA SECRETARÍA REGIONAL MINISTERIAL DE AGRICULTURA DEL PROGRAMA PLAN ZONAS REZAGADAS- FNDR DENOMINADO 'TRANSFERENCIA, CAPACITACIÓN Y GENERACIÓN DE EMPLEOS VERDES EN LA RESERVA BIOSFERA LAUCA' CODIGO BIP 40045543-0 Y LA CORPORACIÓN NACIONAL FORESTAL DE LA REGIÓN DE ARICA Y PARINACOTA'",
    subtitulo:
      "(FONDO DE TERCERO CONVENIO DE TRANSFERENCIA PROGRAMA PLAN ZONAS REZAGADAS-FNDR DENOMINADO 'TRANSFERENCIA, CAPACITACIÓN Y GENERACIÓN DE EMPLEOS VERDES EN LA RESERVA BIOSFERA LAUCA')",
    nombre: 'Transferencia, capacitación y generación de empleos verdes en la Reserva Biosfera Lauca',
  },
  {
    id: 'PZD1',
    etiqueta: 'PZD1 — Servicios Ecosistémicos Andinos',
    proyecto:
      "PROYECTO: 'CONVENIO DE TRANSFERENCIA Y COLABORACIÓN, ENTRE LA SECRETARÍA REGIONAL MINISTERIAL DE AGRICULTURA DEL PROGRAMA PLAN ZONAS REZAGADAS- FNDR DENOMINADO 'RECUPERACIÓN SERVICIOS AMBIENTALES ECOSISTEMA ANDINO Y CAPACITACIÓN' CODIGO BIP 40045266-0 Y LA CORPORACIÓN NACIONAL FORESTAL DE LA REGIÓN DE ARICA Y PARINACOTA'",
    subtitulo:
      "(FONDO DE TERCERO CONVENIO DE TRANSFERENCIA PROGRAMA PLAN ZONAS REZAGADAS-FNDR DENOMINADO 'RECUPERACIÓN SERVICIOS AMBIENTALES ECOSISTEMA ANDINO Y CAPACITACIÓN')",
    nombre: 'Recuperación servicios ambientales ecosistema andino y capacitación',
  },
  {
    id: 'CONADI',
    etiqueta: 'CONADI — Riego para comunidades indígenas',
    proyecto:
      "PROYECTO: 'CONVENIO DE COLABORACIÓN ENTRE LA CORPORACIÓN NACIONAL FORESTAL Y LA DIRECCIÓN REGIONAL DE CONADI PARA LA PROMOCIÓN INTEGRAL DE RIEGO PARA PERSONAS INDÍGENAS, COMUNIDADES Y/O PARTE DE COMUNIDADES INDÍGENAS DE LA REGIÓN DE ARICA Y PARINACOTA'",
    subtitulo:
      '(FONDO DE TERCERO CONVENIO DE COLABORACIÓN ENTRE LA CORPORACIÓN NACIONAL FORESTAL Y LA DIRECCIÓN REGIONAL DE CONADI)',
    nombre:
      'Promoción integral de riego para personas indígenas, comunidades y/o parte de comunidades indígenas de la Región de Arica y Parinacota',
  },
];

// ---------------------------------------------------------------------------
// Institución y director (firmante) por defecto.
// ---------------------------------------------------------------------------

export const INSTITUCION_CONTRATO = {
  rut: '61.313.000-4',
  domicilio: 'Avenida Vicuña Mackenna N° 820 de la ciudad de Arica',
};

export interface DirectorContrato {
  nombre: string;
  rut: string;
  cargo: string;
  profesion: string;
}

export const DIRECTOR_CONTRATO_DEFAULT: DirectorContrato = {
  nombre: 'GUILLERMO EUGENIO CISTERNAS VALENZUELA',
  rut: '7.472.509-0',
  cargo: 'Director Regional (I)',
  profesion: 'Ingeniero Forestal',
};

// ---------------------------------------------------------------------------
// Datos que recolecta la vista (los que no están en la BD son manuales).
// ---------------------------------------------------------------------------

export interface EntradaContrato {
  // Documento
  ciudad?: string;
  fechaEmision?: string; // ISO
  redactorIniciales?: string;
  programaId: string;
  /** Sobrescribe el nombre del programa (cláusula PRIMERO); si se omite, usa el del catálogo. */
  programaNombre?: string;
  // Trabajador (personales, manuales salvo nombre/rut)
  nacionalidad: string;
  estadoCivil: string;
  lugarNac: string;
  fechaNac: string; // ISO
  domicilio: string;
  comuna: string;
  // Contrato
  labores: string;
  lugarTrabajo: string;
  dependenciaDir: string;
  prevision: string;
  salud: string;
  bonoMovilizacion: number;
  bonoColacion: number;
  /** Si se define, controla explícitamente si aparece la cláusula de bonos. */
  incluirBonos?: boolean;
  director?: DirectorContrato;
  // Sobrescribe fechas/sueldo del contrato de la BD si hace falta
  inicioContrato: string; // ISO
  terminoContrato: string; // ISO
  sueldo: number;
}

// ---------------------------------------------------------------------------
// Objeto para Carbone (marcadores {d.})
// ---------------------------------------------------------------------------

export interface DatosContrato {
  documento: { ciudad: string; fecha_emision: string; redactor_iniciales: string };
  institucion: typeof INSTITUCION_CONTRATO;
  director: DirectorContrato & { trato: string };
  programa: { id: string; proyecto: string; subtitulo: string; nombre: string };
  trabajador: {
    trato: string; // Don / Doña
    nombre_upper: string;
    apellido_p_upper: string;
    apellido_m_upper: string;
    rut_miles: string;
    dv: string;
    nacionalidad: string;
    estado_civil: string;
    lugar_nac: string;
    fecha_nac: string; // ISO
    domicilio: string;
    comuna: string;
  };
  // Textos que dependen del género, ya resueltos.
  g: {
    el_la: string; // "el" / "la"
    El_La: string; // "El" / "La"
    el_trabajador: string; // "el trabajador" / "la trabajadora"
    El_trabajador: string; // "El trabajador" / "La trabajadora"
    del_trabajador: string; // "del trabajador" / "de la trabajadora"
    al_trabajador: string; // "al trabajador" / "a la trabajadora"
  };
  contrato: {
    inicio: string; // ISO
    termino: string; // ISO
    labores: string;
    lugar_trabajo: string;
    dependencia_dir: string;
    sueldo_texto: string; // 640.000
    sueldo_palabras: string; // SEISCIENTOS CUARENTA MIL PESOS
    prevision: string;
    salud: string;
  };
  bonos: {
    mostrar: boolean;
    numeral_ejemplares: string; // "DÉCIMO" / "NOVENO"
    mov_texto: string;
    mov_palabras: string;
    col_texto: string;
    col_palabras: string;
  };
}

function trato(genero?: string): string {
  if (genero === 'F') return 'Doña';
  if (genero === 'M') return 'Don';
  return 'Don(ña)';
}

/** Construye los textos que dependen del género (F = femenino). */
function textosGenero(genero?: string): DatosContrato['g'] {
  const f = genero === 'F';
  return {
    el_la: f ? 'la' : 'el',
    El_La: f ? 'La' : 'El',
    el_trabajador: f ? 'la trabajadora' : 'el trabajador',
    El_trabajador: f ? 'La trabajadora' : 'El trabajador',
    del_trabajador: f ? 'de la trabajadora' : 'del trabajador',
    al_trabajador: f ? 'a la trabajadora' : 'al trabajador',
  };
}

/** Catálogo único de AFP, usado en todos los formularios que piden "Previsión". */
export const AFP_OPCIONES = [
  'AFP Capital',
  'AFP Cuprum',
  'AFP Habitat',
  'AFP Modelo',
  'AFP PlanVital',
  'AFP ProVida',
  'AFP Uno',
];

/** Catálogo único de sistemas de salud, usado en todos los formularios que piden "Salud". */
export const SALUD_OPCIONES = [
  'FONASA',
  'BANMÉDICA',
  'COLMENA',
  'CONSALUD',
  'CRUZ BLANCA',
  'NUEVA MAS VIDA',
  'VIDA TRES',
  'ISAPRE FUNDACION',
  'FUSAT',
  'ESENCIAL',
];

/** Estados civiles (con forma masculina/femenina). */
export const ESTADOS_CIVILES = [
  { id: 'soltero', m: 'Soltero', f: 'Soltera' },
  { id: 'casado', m: 'Casado', f: 'Casada' },
  { id: 'divorciado', m: 'Divorciado', f: 'Divorciada' },
  { id: 'viudo', m: 'Viudo', f: 'Viuda' },
  { id: 'separado', m: 'Separado', f: 'Separada' },
  { id: 'conviviente', m: 'Conviviente civil', f: 'Conviviente civil' },
];

/** Devuelve la etiqueta del estado civil según el género (femenino si 'F'). */
export function estadoCivilLabel(id: string, genero?: string): string {
  const e = ESTADOS_CIVILES.find((x) => x.id === id) ?? ESTADOS_CIVILES[0];
  return genero === 'F' ? e.f : e.m;
}

/** Mapea una etiqueta guardada ("Soltera", "Casado"…) a su id; 'soltero' por defecto. */
export function estadoCivilIdDesdeLabel(label?: string | null): string {
  if (!label) return 'soltero';
  const l = label.trim().toLowerCase();
  const e = ESTADOS_CIVILES.find((x) => x.m.toLowerCase() === l || x.f.toLowerCase() === l);
  return e ? e.id : 'soltero';
}

/** Identidad del trabajador (viene de la BD o del formulario para un nuevo). */
export interface IdentidadContrato {
  nombres: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  rut: number;
  dv: string;
  genero?: string; // 'M' / 'F'
}

export function construirDatosContrato(
  identidad: IdentidadContrato,
  entrada: EntradaContrato,
): DatosContrato {
  const genero = identidad.genero;
  const programa =
    PROGRAMAS_CONTRATO.find((p) => p.id === entrada.programaId) ?? PROGRAMAS_CONTRATO[0];
  const director = entrada.director ?? DIRECTOR_CONTRATO_DEFAULT;
  const bonoMov = entrada.bonoMovilizacion || 0;
  const bonoCol = entrada.bonoColacion || 0;
  const mostrarBonos =
    entrada.incluirBonos !== undefined ? entrada.incluirBonos : bonoMov + bonoCol > 0;

  const rutMiles = (identidad.rut || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return {
    documento: {
      ciudad: entrada.ciudad ?? 'Arica',
      fecha_emision: entrada.fechaEmision || new Date().toISOString().split('T')[0],
      redactor_iniciales: (entrada.redactorIniciales ?? 'crh').toLowerCase(),
    },
    institucion: INSTITUCION_CONTRATO,
    director: { ...director, trato: 'Don' },
    programa: {
      id: programa.id,
      proyecto: programa.proyecto,
      subtitulo: programa.subtitulo,
      nombre: entrada.programaNombre?.trim() ? entrada.programaNombre.trim() : programa.nombre,
    },
    trabajador: {
      trato: trato(genero),
      nombre_upper: identidad.nombres.toUpperCase(),
      apellido_p_upper: identidad.primer_apellido.toUpperCase(),
      apellido_m_upper: (identidad.segundo_apellido ?? '').toUpperCase(),
      rut_miles: rutMiles,
      dv: identidad.dv,
      nacionalidad: entrada.nacionalidad,
      estado_civil: entrada.estadoCivil,
      lugar_nac: entrada.lugarNac,
      fecha_nac: entrada.fechaNac,
      domicilio: entrada.domicilio,
      comuna: entrada.comuna,
    },
    g: textosGenero(genero),
    contrato: {
      inicio: entrada.inicioContrato,
      termino: entrada.terminoContrato,
      labores: entrada.labores,
      lugar_trabajo: entrada.lugarTrabajo,
      dependencia_dir: entrada.dependenciaDir,
      sueldo_texto: formatearMiles(entrada.sueldo || 0),
      sueldo_palabras: montoEnPalabras(entrada.sueldo || 0),
      prevision: entrada.prevision,
      salud: entrada.salud,
    },
    bonos: {
      mostrar: mostrarBonos,
      numeral_ejemplares: mostrarBonos ? 'DÉCIMO' : 'NOVENO',
      mov_texto: formatearMiles(bonoMov),
      mov_palabras: montoEnPalabras(bonoMov),
      col_texto: formatearMiles(bonoCol),
      col_palabras: montoEnPalabras(bonoCol),
    },
  };
}

/** Sugiere el contrato a usar (el vigente o el más reciente). */
export function contratoSugerido(t: Trabajador): Contrato | null {
  const contratos = t.contratos ?? [];
  if (contratos.length === 0) return null;
  const vigente = contratos.find((c) => !c.fecha_termino || new Date(c.fecha_termino) >= new Date());
  return (
    vigente ?? [...contratos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Referencia de marcadores para la vista.
// ---------------------------------------------------------------------------

export interface CampoContrato {
  marcador: string;
  descripcion: string;
}

// ---------------------------------------------------------------------------
// Carga masiva: mapeo de una fila de la planilla Excel a datos de contrato.
// ---------------------------------------------------------------------------

const MESES_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Convierte una fecha en texto ("1 de April de 2026", "01-04-2026"…) o serial de Excel a ISO. */
export function parseFechaTexto(valor: unknown): string {
  if (valor == null) return '';
  // Serial de Excel (número de días desde 1899-12-30).
  if (typeof valor === 'number' && valor > 0) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const txt = String(valor).trim();
  if (!txt) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) return txt.slice(0, 10);
  const m = txt.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/);
  if (m) {
    const mes = MESES_MAP[m[2]];
    if (mes) return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const m2 = txt.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m2) {
    const y = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${y}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }
  return '';
}

/** Determina el programa desde la CABECERA (acepta PZD1/PZD3/CONADI o el código BIP). */
function programaIdDesdeCabecera(cabecera: string): string {
  const c = (cabecera || '').toUpperCase();
  if (PROGRAMAS_CONTRATO.some((p) => p.id === c)) return c;
  if (c.includes('40045543')) return 'PZD3';
  if (c.includes('40045266')) return 'PZD1';
  if (c.includes('CONADI')) return 'CONADI';
  return PROGRAMAS_CONTRATO[0].id;
}

/** Convierte un número con formato (" 700,000 ", " - ") a entero. */
export function parseNumeroCL(valor: unknown): number {
  if (typeof valor === 'number') return Math.round(valor);
  const t = String(valor ?? '').replace(/[^\d]/g, '');
  return t ? parseInt(t, 10) : 0;
}

/** Normaliza una clave de columna del Excel (mayúsculas, sin espacios ni acentos). */
function normalizarClave(k: string): string {
  return k
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

export interface FiltroFilaContrato {
  datos: DatosContrato;
  nombre: string;
  rut: number;
  seleccion: boolean; // columna SELECCIÓN != "NO"
}

/**
 * Convierte una fila de la hoja «TRABAJADORES» de la planilla de contratos en
 * datos listos para Carbone. Devuelve null si la fila no tiene RUT válido.
 */
export function datosContratoDesdeFilaExcel(
  filaCruda: Record<string, unknown>,
): FiltroFilaContrato | null {
  const fila: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filaCruda)) fila[normalizarClave(k)] = v;
  const g = (nombre: string): string => {
    const v = fila[normalizarClave(nombre)];
    return v == null ? '' : String(v).trim();
  };

  const rut = parseNumeroCL(g('RUT'));
  if (!rut) return null;

  const programaId = programaIdDesdeCabecera(g('CABECERA'));
  const generoRaw = g('GENERO').toUpperCase();

  const datos = construirDatosContrato(
    {
      nombres: g('NOMBRE'),
      primer_apellido: g('APELLIDO_P'),
      segundo_apellido: g('APELLIDO_M') || null,
      rut,
      dv: g('DV'),
      genero: generoRaw === 'F' ? 'F' : generoRaw === 'M' ? 'M' : undefined,
    },
    {
      redactorIniciales: g('INICIALES') || 'crh',
      fechaEmision: parseFechaTexto(g('FECHA_EMIS')),
      programaId,
      programaNombre: g('PROGRAMA'),
      nacionalidad: g('NACIONALIDAD'),
      estadoCivil: g('ESTADO_CIVIL'),
      lugarNac: g('LUGAR_NAC'),
      fechaNac: parseFechaTexto(g('FECHA_NAC')),
      domicilio: g('DOMICILIO'),
      comuna: g('COMUNA'),
      labores: g('LABORES'),
      lugarTrabajo: g('LUGAR_TRAB'),
      dependenciaDir: g('DEPENDENCIA_DIR'),
      prevision: g('PREVISION'),
      salud: g('SALUD'),
      bonoMovilizacion: parseNumeroCL(g('BONO_MOV')),
      bonoColacion: parseNumeroCL(g('BONO_COL')),
      inicioContrato: parseFechaTexto(g('INICIO_CONT')),
      terminoContrato: parseFechaTexto(g('TERMINO_CONT')),
      sueldo: parseNumeroCL(g('SUELDO')),
    },
  );

  return {
    datos,
    nombre: `${g('NOMBRE')} ${g('APELLIDO_P')} ${g('APELLIDO_M')}`.trim(),
    rut,
    seleccion: g('SELECCION').toUpperCase() !== 'NO',
  };
}

export const CAMPOS_CONTRATO: CampoContrato[] = [
  { marcador: '{d.programa.proyecto}', descripcion: 'Proyecto/convenio (cabecera)' },
  { marcador: '{d.programa.subtitulo}', descripcion: 'Subtítulo bajo el título (Fondo de tercero…)' },
  { marcador: '{d.programa.nombre}', descripcion: 'Nombre del programa (cláusula PRIMERO)' },
  { marcador: '{d.trabajador.trato}', descripcion: 'Don / Doña' },
  { marcador: '{d.trabajador.nombre_upper}', descripcion: 'Nombres en mayúsculas' },
  { marcador: '{d.trabajador.apellido_p_upper}', descripcion: 'Apellido paterno' },
  { marcador: '{d.trabajador.apellido_m_upper}', descripcion: 'Apellido materno' },
  { marcador: '{d.trabajador.rut_miles} - {d.trabajador.dv}', descripcion: 'RUT y dígito verificador' },
  { marcador: '{d.trabajador.nacionalidad}', descripcion: 'Nacionalidad' },
  { marcador: '{d.trabajador.estado_civil}', descripcion: 'Estado civil' },
  { marcador: '{d.trabajador.lugar_nac}', descripcion: 'Lugar de nacimiento' },
  { marcador: '{d.trabajador.fecha_nac:formatD(LL)}', descripcion: 'Fecha de nacimiento' },
  { marcador: '{d.trabajador.domicilio}', descripcion: 'Domicilio' },
  { marcador: '{d.trabajador.comuna}', descripcion: 'Comuna' },
  { marcador: '{d.contrato.inicio:formatD(LL)}', descripcion: 'Inicio del contrato' },
  { marcador: '{d.contrato.termino:formatD(LL)}', descripcion: 'Término del contrato' },
  { marcador: '{d.contrato.labores}', descripcion: 'Labores' },
  { marcador: '{d.contrato.lugar_trabajo}', descripcion: 'Lugar de trabajo (comuna)' },
  { marcador: '{d.contrato.dependencia_dir}', descripcion: 'Dependencia directa' },
  { marcador: '{d.contrato.sueldo_texto}', descripcion: 'Sueldo (número con miles)' },
  { marcador: '{d.contrato.sueldo_palabras}', descripcion: 'Sueldo en palabras' },
  { marcador: '{d.contrato.prevision}', descripcion: 'Régimen previsional (AFP)' },
  { marcador: '{d.contrato.salud}', descripcion: 'Sistema de salud' },
  { marcador: '{d.bonos.mov_texto} / {d.bonos.col_texto}', descripcion: 'Bonos movilización / colación' },
  { marcador: '{d.director.nombre}', descripcion: 'Nombre del director (firmante)' },
];

// ---------------------------------------------------------------------------
// Exportación a SIGPER (carga masiva de personal, sector público).
//
// Códigos institucionales fijos, asignados por SIGPER/DIPRES para los
// programas de fondo de terceros que administra CONAF. No dependen de datos
// de la app; se hardcodean aquí igual que PROGRAMAS_CONTRATO.
// ---------------------------------------------------------------------------

/** Códigos SIGPER constantes para todos los programas de fondo de terceros. */
export const SIGPER_CONSTANTES = {
  escalafonDipres: 4, // Tipo contrato fondo de terceros
  programaPresupuestario: 99, // Fondo de terceros
  programa: 999, // Fondo de terceros
  subPrograma: 1, // ADM Unidades Demandantes
  tarea: 1, // Remuneraciones
  actividad: 1, // Remuneraciones
  fuenteFinanciamiento: 1,
  seccion: 1010, // Dirección Regional
};

/** Catálogo SIGPER de "Proyecto" por programa. No coincide 1:1 con PROGRAMAS_CONTRATO:
 *  PZD2 y Picaflor son solo para SIGPER, no generan contrato Word en este sistema. */
export const SIGPER_PROGRAMAS = [
  { id: 'PZD1', etiqueta: 'PZD1', proyecto: 27 },
  { id: 'PZD2', etiqueta: 'PZD2', proyecto: 29 },
  { id: 'PZD3', etiqueta: 'PZD3', proyecto: 28 },
  { id: 'CONADI', etiqueta: 'CONADI', proyecto: 9 },
  { id: 'PICAFLOR', etiqueta: 'Picaflor', proyecto: 26 },
];

/** Cargo legal + Escalafón SIGPER, pareados según si el trabajador es Obrero o Profesional. */
export const SIGPER_TIPO_TRABAJADOR = {
  obrero: { cargoLegal: 70, escalafon: 12, etiqueta: 'Obrero' },
  profesional: { cargoLegal: 78, escalafon: 11, etiqueta: 'Profesional' },
} as const;

export type SigperTipoTrabajador = keyof typeof SIGPER_TIPO_TRABAJADOR;

/** Infiere la Unidad laboral SIGPER desde el "Lugar de trabajo" (comuna) ya usado en el contrato. */
export function unidadLaboralSigperDesdeLugar(lugarTrabajo: string): number | null {
  const l = lugarTrabajo.trim().toLowerCase();
  if (l.includes('putre')) return 11504; // Área Putre
  if (l.includes('arica')) return 11502; // Oficina Regional Arica y Parinacota
  return null;
}

/** Encabezados de la hoja "Datos carga", en el orden exacto que espera SIGPER. */
export const SIGPER_ENCABEZADOS_DATOS_CARGA = [
  'RUN funcionario',
  'Escalafón',
  'Escalafón DIPRES',
  'Cargo legal',
  'Jornada',
  'Unidad laboral',
  'Sección',
  'Proyecto',
  'Fuente de financiamiento',
  'Programa presupuestario',
  'Programa',
  'Sub programa',
  'Tarea',
  'Actividad',
  'Fecha inicio',
  'Fecha término',
  'Sueldo base',
];

/** Hoja "Estructura carga": documentación estática, copiada de la plantilla oficial de SIGPER. */
export const SIGPER_ESTRUCTURA_CARGA: [string, string, string][] = [
  ['Campo', 'Tipo dato', 'Alcance'],
  ['RUN funcionario', 'N(9)', 'Sin dígito verificador'],
  ['Escalafón', 'C(6)', 'Según tabla "Escalafón instituciones"'],
  ['Escalafón DIPRES', 'N(6)', 'Según tabla'],
  ['Cargo legal', 'N(6)', 'Según tabla "Cargos"'],
  ['Jornada', 'N(2,1)', ''],
  ['Unidad laboral', 'N(7)', 'Según tabla "Unidades laborales"'],
  ['Sección', 'N(4)', 'Según tabla "Seccion administrativa"'],
  ['Proyecto', 'N(10)', 'Según tabla "Proyectos"'],
  ['Fuente de financiamiento', 'N(2)', 'Según tabla "Fuente de financiamiento"'],
  ['Programa presupuestario', 'C(4)', 'Según tabla "Programa presupuestario"'],
  ['Estructura Programática - Programa', 'C(4)', 'Según tabla "Programa"'],
  ['Estructura programática - Sub programa', 'C(4)', 'Según tabla "Sub programa"'],
  ['Estructura programática - Tarea', 'C(4)', 'Según tabla "Tarea"'],
  ['Estructura programática - Actividad', 'C(4)', 'Según tabla "Actividad"'],
  ['Fecha inicio', 'D(8)', 'DD-MM-YYYY'],
  ['Fecha término', 'D(8)', 'DD-MM-YYYY'],
  ['Sueldo base', 'N(13)', 'Sin separador de miles'],
];

// ---------------------------------------------------------------------------
// SIGPER — Reconocimiento de Haberes (voucher de bonos de movilización y
// colación). Formato .xls (BIFF8) heredado, distinto del de la carga de
// personal: una fila por cada bono que tenga el trabajador, no por trabajador.
// ---------------------------------------------------------------------------

/** Código de agrupación SIGPER para cada tipo de bono. */
export const SIGPER_CODIGO_AGRUPACION = {
  colacion: 'ALIMENTAC',
  movilizacion: 'MOVILIZAC',
} as const;

export const SIGPER_ENCABEZADOS_BONOS = [
  'RUN funcionario',
  'Código agrupación',
  'Fecha cumplimiento',
  'Fecha de inicio',
  'Fecha de término',
  'Factor',
  'Observaciones',
  'Fecha Inicio Prox. Pago',
  'Ind. de Reingreso',
  'Porcentaje A.F.C',
];

/** Hoja "ESTRUCTURA" del voucher de bonos, copiada de la plantilla oficial de SIGPER. */
export const SIGPER_ESTRUCTURA_BONOS: [string, string, string][] = [
  ['CAMPO', 'TIPO DE DATO', 'OBSERVACIONES'],
  ['RUN funcionario', 'Numerico(9)', ''],
  ['Código agrupación', 'Caracter(11)', 'Segun Tabla "Agrupación de Formula"'],
  ['Fecha cumplimiento', 'D(8)', 'DD-MM-YYYY, solo para agrupación de BIENIOS'],
  ['Fecha de inicio', 'D(8)', 'DD-MM-YYYY'],
  ['Fecha de término', 'D(8)', 'DD-MM-YYYY'],
  ['Factor ', '(TEXTO) Numerico. Decimal(12.4)', ''],
  ['Observaciones', 'Caracter(255)', ''],
  ['Fecha Pago Prox. Bienio', 'D(8)', 'DD-MM-YYYY'],
  ['Ind. de Reingreso', 'Caracter(1)', 'Debe ser N'],
  ['Porcentaje A.F.C', 'Numerico, Decimal(6,2)', 'Solo si agrupación es AFC'],
];
