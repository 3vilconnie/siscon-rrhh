// lib/horasCompensatorias.ts
// Datos para el documento "Detalle de Horas Compensatorias" que se rellena con
// Carbone sobre plantillas/horas-compensatorias.docx.
//
// Compartido cliente/servidor: no importar módulos exclusivos de servidor.

/** Una fila del detalle (un permiso / consumo de horas). */
export interface DetalleHoraDoc {
  indice: number; // N° de fila (1-based)
  fecha: string; // "DD-MM-YYYY"
  horas: string; // número formateado (ej. "4" o "4,5")
}

/** Estructura enviada a Carbone (marcadores {d.}). */
export interface DatosHoras {
  documento: {
    ciudad: string;
    fecha_emision: string; // ISO
    redactor_iniciales: string;
    ano: number;
  };
  trabajador: {
    nombre_completo: string;
    rut_formateado: string; // 12.345.678-9
  };
  resumen: {
    consumidas: string;
    disponibles: string;
    tope: number;
    total_registros: number;
  };
  detalles: DetalleHoraDoc[];
}

export interface EntradaHoras {
  nombreCompleto: string;
  rut: number;
  dv: string;
  ano: number;
  tope: number;
  consumidas: number;
  disponibles: number;
  detalles: { fecha: string; horas_solicitadas: number }[];
  ciudad?: string;
  redactorIniciales?: string;
}

/** Formatea una fecha ISO a DD-MM-YYYY (o "" si viene vacía). */
function fechaDDMMYYYY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** Formatea un número con hasta 2 decimales al estilo chileno (coma decimal). */
function num(n: number): string {
  return n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

export function construirDatosHoras(input: EntradaHoras): DatosHoras {
  const rutMiles = input.rut.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return {
    documento: {
      ciudad: input.ciudad ?? 'Arica',
      fecha_emision: new Date().toISOString().split('T')[0],
      redactor_iniciales: (input.redactorIniciales ?? 'crh').toLowerCase(),
      ano: input.ano,
    },
    trabajador: {
      nombre_completo: input.nombreCompleto.toUpperCase(),
      rut_formateado: `${rutMiles}-${input.dv}`,
    },
    resumen: {
      consumidas: num(input.consumidas),
      disponibles: num(input.disponibles),
      tope: input.tope,
      total_registros: input.detalles.length,
    },
    detalles: input.detalles.map((d, i) => ({
      indice: i + 1,
      fecha: fechaDDMMYYYY(d.fecha),
      horas: num(d.horas_solicitadas),
    })),
  };
}

/** Marcadores disponibles en la plantilla horas-compensatorias.docx. */
export const CAMPOS_HORAS = [
  { marcador: '{d.trabajador.nombre_completo}', descripcion: 'Nombre del funcionario' },
  { marcador: '{d.trabajador.rut_formateado}', descripcion: 'RUT del funcionario' },
  { marcador: '{d.documento.ano}', descripcion: 'Año del reporte' },
  { marcador: '{d.resumen.consumidas}', descripcion: 'Horas consumidas en el año' },
  { marcador: '{d.resumen.disponibles}', descripcion: 'Horas disponibles' },
  { marcador: '{d.detalles[i].fecha}', descripcion: 'Fecha de cada permiso (DD-MM-YYYY)' },
  { marcador: '{d.detalles[i].horas}', descripcion: 'Horas de cada permiso' },
];
