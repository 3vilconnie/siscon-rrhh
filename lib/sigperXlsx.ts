// lib/sigperXlsx.ts
// Genera las dos planillas que se cargan a SIGPER:
//   · Carga de personal        → "Datos carga" + "Estructura carga" (.xlsx)
//   · Reconocimiento de Haberes → "DATOS" + "ESTRUCTURA" (.xls BIFF8)
//
// Se usa tanto desde Contratos Masivos como desde el contrato individual, para
// que ambos produzcan exactamente el mismo archivo. Los códigos institucionales
// viven en lib/contrato.ts (SIGPER_*).

import * as XLSX from 'xlsx';
import {
  SIGPER_CONSTANTES,
  SIGPER_PROGRAMAS,
  SIGPER_TIPO_TRABAJADOR,
  SIGPER_ENCABEZADOS_DATOS_CARGA,
  SIGPER_ESTRUCTURA_CARGA,
  SIGPER_CODIGO_AGRUPACION,
  SIGPER_ENCABEZADOS_BONOS,
  SIGPER_ESTRUCTURA_BONOS,
  type SigperTipoTrabajador,
} from '@/lib/contrato';

/**
 * SIGPER espera fechas REALES de Excel, no texto. Si se escriben como cadena
 * "dd-mm-yyyy", Excel las deja como texto plano y ni Excel ni SIGPER las
 * reconocen hasta que alguien las "toca" a mano. Por eso se calcula el serial
 * de Excel (días desde 1899-12-30) y luego se marca el formato en la celda.
 */
export function fechaExcelSerial(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

/** Primer día del mes: el "inicio de pago" del bono es el 1 del mes en que empieza el contrato. */
export function primerDiaDelMesSigper(iso: string): number {
  const [y, m] = iso.split('-');
  return fechaExcelSerial(`${y}-${m}-01`);
}

/** Día siguiente al término: es la "Fecha Inicio Prox. Pago" del bienio. */
export function diaSiguienteSigper(iso: string): number {
  return fechaExcelSerial(iso) + 1;
}

/** Marca como fecha (dd-mm-yyyy) las celdas de las columnas dadas, filas 2..N+1. */
function aplicarFormatoFecha(ws: XLSX.WorkSheet, columnas: string[], totalFilas: number) {
  for (const col of columnas) {
    for (let fila = 2; fila <= totalFilas + 1; fila++) {
      const celda = ws[`${col}${fila}`];
      if (celda) celda.z = 'dd-mm-yyyy';
    }
  }
}

/** Un trabajador dentro de la carga de personal. */
export interface FilaSigper {
  rut: number;
  tipo: SigperTipoTrabajador;
  sueldo: number;
}

export interface OpcionesCargaSigper {
  programaId: string;
  unidadLaboral: number;
  jornada: number;
  fechaInicio: string; // ISO
  fechaTermino: string; // ISO
}

/**
 * Genera y descarga la planilla de carga de personal. Devuelve la cantidad de
 * filas escritas. Lanza si falta algún dato obligatorio.
 */
export function descargarCargaSigper(
  trabajadores: FilaSigper[],
  opciones: OpcionesCargaSigper,
): number {
  const programa = SIGPER_PROGRAMAS.find((p) => p.id === opciones.programaId);
  if (!programa) throw new Error('Selecciona el Programa SIGPER.');
  if (!opciones.unidadLaboral) throw new Error('Indica la Unidad laboral SIGPER.');
  if (!opciones.fechaInicio || !opciones.fechaTermino)
    throw new Error('Completa la fecha de inicio y término.');
  if (trabajadores.length === 0) throw new Error('No hay trabajadores para exportar.');
  if (trabajadores.some((t) => t.sueldo <= 0))
    throw new Error('Indica el sueldo de cada trabajador.');

  const filas = trabajadores.map((t) => {
    const tipo = SIGPER_TIPO_TRABAJADOR[t.tipo];
    return [
      t.rut,
      tipo.escalafon,
      SIGPER_CONSTANTES.escalafonDipres,
      tipo.cargoLegal,
      opciones.jornada,
      opciones.unidadLaboral,
      SIGPER_CONSTANTES.seccion,
      programa.proyecto,
      SIGPER_CONSTANTES.fuenteFinanciamiento,
      SIGPER_CONSTANTES.programaPresupuestario,
      SIGPER_CONSTANTES.programa,
      SIGPER_CONSTANTES.subPrograma,
      SIGPER_CONSTANTES.tarea,
      SIGPER_CONSTANTES.actividad,
      fechaExcelSerial(opciones.fechaInicio),
      fechaExcelSerial(opciones.fechaTermino),
      t.sueldo,
    ];
  });

  const wsDatos = XLSX.utils.aoa_to_sheet([SIGPER_ENCABEZADOS_DATOS_CARGA, ...filas]);
  wsDatos['!cols'] = SIGPER_ENCABEZADOS_DATOS_CARGA.map(() => ({ wch: 16 }));
  aplicarFormatoFecha(wsDatos, ['O', 'P'], filas.length);

  const wsEstructura = XLSX.utils.aoa_to_sheet(SIGPER_ESTRUCTURA_CARGA);
  wsEstructura['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos carga');
  XLSX.utils.book_append_sheet(wb, wsEstructura, 'Estructura carga');
  XLSX.writeFile(wb, `sigper_carga_${opciones.programaId}_${filas.length}.xlsx`);

  return filas.length;
}

export interface OpcionesBonosSigper {
  fechaInicio: string; // ISO
  fechaTermino: string; // ISO
  bonoColacion: number;
  bonoMovilizacion: number;
}

/**
 * Genera y descarga el voucher de bonos (Reconocimiento de Haberes). Escribe
 * UNA FILA POR BONO de cada trabajador, no una por trabajador. Devuelve la
 * cantidad de filas escritas.
 */
export function descargarBonosSigper(
  ruts: number[],
  opciones: OpcionesBonosSigper,
): number {
  if (opciones.bonoColacion <= 0 && opciones.bonoMovilizacion <= 0)
    throw new Error('No hay bonos configurados.');
  if (!opciones.fechaInicio || !opciones.fechaTermino)
    throw new Error('Completa la fecha de inicio y término.');

  const inicio = primerDiaDelMesSigper(opciones.fechaInicio);
  const termino = fechaExcelSerial(opciones.fechaTermino);
  const proximoBienio = diaSiguienteSigper(opciones.fechaTermino);

  const filas: (string | number)[][] = [];
  for (const rut of ruts) {
    if (opciones.bonoColacion > 0) {
      filas.push([
        rut,
        SIGPER_CODIGO_AGRUPACION.colacion,
        '',
        inicio,
        termino,
        opciones.bonoColacion,
        '',
        proximoBienio,
        'N',
        0,
      ]);
    }
    if (opciones.bonoMovilizacion > 0) {
      filas.push([
        rut,
        SIGPER_CODIGO_AGRUPACION.movilizacion,
        '',
        inicio,
        termino,
        opciones.bonoMovilizacion,
        '',
        proximoBienio,
        'N',
        0,
      ]);
    }
  }

  if (filas.length === 0) throw new Error('No hay bonos configurados.');

  const wsDatos = XLSX.utils.aoa_to_sheet([SIGPER_ENCABEZADOS_BONOS, ...filas]);
  wsDatos['!cols'] = SIGPER_ENCABEZADOS_BONOS.map(() => ({ wch: 16 }));
  aplicarFormatoFecha(wsDatos, ['D', 'E', 'H'], filas.length);

  const wsEstructura = XLSX.utils.aoa_to_sheet(SIGPER_ESTRUCTURA_BONOS);
  wsEstructura['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDatos, 'DATOS');
  XLSX.utils.book_append_sheet(wb, wsEstructura, 'ESTRUCTURA');
  // .xls (BIFF8): es el formato de la plantilla oficial de SIGPER.
  XLSX.writeFile(wb, `sigper_bonos_${filas.length}.xls`, { bookType: 'biff8' });

  return filas.length;
}
