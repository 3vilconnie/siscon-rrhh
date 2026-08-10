// lib/recepcion.ts
// Datos y catálogos para el Formulario de Recepción de Documentos, que se rellena
// con Carbone sobre plantillas/recepcion-documentos.docx.
//
// Compartido cliente/servidor: no importar módulos exclusivos de servidor.

import { DetalleDocumento } from '@/types';

/** Tipos de documento que se pueden marcar en el formulario. */
export const TIPOS_RECEPCION = ['Finiquito', 'Contrato', 'Anexo contrato', 'Notificación', 'Otro'];

/** Datos institucionales fijos del membrete. */
export const INSTITUCION_RECEPCION = {
  nombre: 'CORPORACIÓN NACIONAL FORESTAL',
  region: 'REGIÓN DE ARICA Y PARINACOTA',
  departamento: 'DEPTO. FINANZAS Y ADMINISTRACIÓN',
  seccion: 'SECCIÓN RECURSOS HUMANOS',
};

/** Una fila de la tabla de detalle, ya lista para la plantilla. */
export interface DetalleRecepcion {
  fecha_emision: string; // "DD-MM-YYYY" o ""
  programa: string;
  rut: string;
  dv: string;
  nombre: string;
  apellido_p: string;
  apellido_m: string;
  genero: string; // "M" / "F" / "S/R"
}

/** Estructura enviada a Carbone (marcadores {d.}). */
export interface DatosRecepcion {
  institucion: typeof INSTITUCION_RECEPCION;
  documento: {
    redactor_iniciales: string;
    ciudad: string;
    fecha_recepcion: string; // ISO YYYY-MM-DD
    descripcion: string;
    tipos: string; // tipos seleccionados, unidos por coma
  };
  detalles: DetalleRecepcion[];
  entrega: string;
  recibe: string;
}

/** Entrada que recolecta la vista de recepción. */
export interface EntradaRecepcion {
  tipos: string[];
  detalleOtro?: string;
  fechaRecepcion: string; // ISO
  descripcion: string;
  detalles: DetalleDocumento[];
  entrega: string;
  recibe: string;
  ciudad?: string;
  redactorIniciales?: string;
}

/** Mapea el género almacenado a su etiqueta en el documento. */
function generoEtiqueta(g?: string): string {
  if (g === 'M') return 'M';
  if (g === 'F') return 'F';
  return 'S/R';
}

/** Formatea una fecha ISO a DD-MM-YYYY (o "" si viene vacía). */
function fechaDDMMYYYY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** Une los tipos seleccionados en un texto legible (expandiendo "Otro"). */
export function tiposComoTexto(tipos: string[], detalleOtro?: string): string {
  return tipos
    .map((t) => (t === 'Otro' && detalleOtro ? `Otro: ${detalleOtro}` : t))
    .join(', ');
}

/** Construye el objeto de datos para Carbone a partir de lo que llena la vista. */
export function construirDatosRecepcion(input: EntradaRecepcion): DatosRecepcion {
  return {
    institucion: INSTITUCION_RECEPCION,
    documento: {
      redactor_iniciales: (input.redactorIniciales ?? 'crh').toLowerCase(),
      ciudad: input.ciudad ?? 'Arica',
      fecha_recepcion: input.fechaRecepcion || new Date().toISOString().split('T')[0],
      descripcion: input.descripcion,
      tipos: tiposComoTexto(input.tipos, input.detalleOtro),
    },
    detalles: input.detalles.map((d) => ({
      fecha_emision: fechaDDMMYYYY(d.fechaEmision),
      programa: d.cabecera ?? '',
      rut: d.rut ?? '',
      dv: d.dv ?? '',
      nombre: d.nombre ?? '',
      apellido_p: d.apellidoP ?? '',
      apellido_m: d.apellidoM ?? '',
      genero: generoEtiqueta(d.genero),
    })),
    entrega: input.entrega,
    recibe: input.recibe,
  };
}

/** Marcadores disponibles en la plantilla recepcion-documentos.docx. */
export interface CampoRecepcion {
  marcador: string;
  descripcion: string;
}

export const CAMPOS_RECEPCION: CampoRecepcion[] = [
  { marcador: '{d.documento.tipos}', descripcion: 'Tipos de documento seleccionados' },
  { marcador: '{d.documento.fecha_recepcion:formatD(LL)}', descripcion: 'Fecha de recepción en texto' },
  { marcador: '{d.documento.descripcion}', descripcion: 'Cantidad / descripción general' },
  { marcador: '{d.documento.redactor_iniciales}', descripcion: 'Iniciales del redactor (CDC/JAN/…)' },
  { marcador: '{d.detalles[i].fecha_emision}', descripcion: 'Fecha de emisión de cada fila (DD-MM-YYYY)' },
  { marcador: '{d.detalles[i].programa}', descripcion: 'Programa de cada fila' },
  { marcador: '{d.detalles[i].rut}', descripcion: 'RUT de cada fila' },
  { marcador: '{d.detalles[i].dv}', descripcion: 'Dígito verificador de cada fila' },
  { marcador: '{d.detalles[i].nombre}', descripcion: 'Nombre de cada fila' },
  { marcador: '{d.detalles[i].apellido_p}', descripcion: 'Apellido paterno de cada fila' },
  { marcador: '{d.detalles[i].apellido_m}', descripcion: 'Apellido materno de cada fila' },
  { marcador: '{d.detalles[i].genero}', descripcion: 'Género de cada fila (M/F/S/R)' },
  { marcador: '{d.entrega}', descripcion: 'Quien entrega' },
  { marcador: '{d.recibe}', descripcion: 'Quien recibe' },
];
