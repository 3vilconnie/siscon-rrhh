// lib/finiquitoCalculoXlsx.ts
// Genera el Excel "Calculo finiquito …" replicando la hoja «Principal» de la
// planilla original (Plantilla Calculo Finiquito.xlsm): mismo contenido, mismas
// fórmulas (autocontenidas, sin los VLOOKUP externos) y MISMA estética
// (fuente Arial, negritas, bordes de la tabla del período y del calendario, y
// los días del feriado coloreados en amarillo/azul como en la planilla).
//
// Usa `xlsx-js-style` (fork de SheetJS que sí escribe estilos de celda).

import * as XLSX from 'xlsx-js-style';
import PizZip from 'pizzip';
import { proyectarFeriado, type DatosFiniquito } from './finiquito';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Fallback de interop CJS/ESM: según el bundler, la API puede quedar en el
// namespace o bajo `.default`. `XL` apunta siempre al objeto con utils/write.
const XL: any = (XLSX as any).utils ? XLSX : (XLSX as any).default;

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const FMT_MILES = '#,##0';
const FMT_PESOS = '"$"#,##0';
const FMT_DEC2 = '0.00';
const FMT_FECHA = 'dd-mm-yyyy';

// --- estilos ---------------------------------------------------------------
const FUENTE = { name: 'Arial', sz: 10 };
const FUENTE_B = { name: 'Arial', sz: 10, bold: true };
const THIN = { style: 'thin', color: { rgb: '000000' } };
const BORDE = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const AMARILLO = { patternType: 'solid', fgColor: { rgb: 'FFFF00' } };
const AZUL = { patternType: 'solid', fgColor: { rgb: '00B0F0' } };
const CENTRO = { horizontal: 'center', vertical: 'center', wrapText: true };

/** Serial de Excel (días desde 1899-12-30) para una fecha ISO YYYY-MM-DD. */
function serialExcel(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}

/** dd-mm-yyyy a partir de ISO. */
function fechaDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** ISO YYYY-MM-DD de un Date UTC. */
function isoDeUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Celdas (con estilo base Arial ya aplicado).
function t(v: string, style?: any): any {
  return { t: 's', v, s: { font: FUENTE, ...style } };
}
function n(v: number, z?: string, style?: any): any {
  return { t: 'n', v, ...(z ? { z } : {}), s: { font: FUENTE, ...style } };
}
function f(formula: string, cache: number, z?: string, style?: any): any {
  return { t: 'n', f: formula, v: cache, ...(z ? { z } : {}), s: { font: FUENTE, ...style } };
}

/** Fila del encabezado del primer calendario; cada calendario ocupa 9 filas. */
const FILA_CAL_INICIAL = 30;
const FILAS_POR_CALENDARIO = 9;
/** Semanas dibujadas por calendario (fijo, para que las filas sean predecibles). */
const SEMANAS_POR_CALENDARIO = 6;

/**
 * Meses que hay que dibujar: desde el mes del término hasta el mes del último
 * día proyectado. Normalmente son 1 o 2 — el feriado casi siempre cruza al mes
 * siguiente, y sin ese segundo calendario los días coloreados no se ven.
 */
function mesesADibujar(
  terminoISO: string,
  fechas: string[],
): { anio: number; mes: number }[] {
  const [y, m] = terminoISO.split('-').map(Number);
  const inicio = { anio: y, mes: m - 1 }; // mes 0-based

  const ultima = fechas.length > 0 ? fechas[fechas.length - 1] : terminoISO;
  const [uy, um] = ultima.split('-').map(Number);
  const fin = { anio: uy, mes: um - 1 };

  const meses: { anio: number; mes: number }[] = [];
  const cursor = { ...inicio };
  // Cota de seguridad: un feriado proporcional nunca abarca tantos meses.
  for (let i = 0; i < 12; i++) {
    meses.push({ ...cursor });
    if (cursor.anio === fin.anio && cursor.mes === fin.mes) break;
    cursor.mes++;
    if (cursor.mes > 11) {
      cursor.mes = 0;
      cursor.anio++;
    }
  }
  return meses;
}

/**
 * Construye la hoja «Principal» del cálculo de finiquito para un trabajador.
 */
export function construirHojaCalculo(d: DatosFiniquito): XLSX.WorkSheet {
  const fin = d.finiquito;
  const habilesMeses = 1.25 * fin.meses;
  const habilesDias = (1.25 / 30) * fin.dias;
  const habiles = habilesMeses + habilesDias;
  const feriadoAPagar = habiles + fin.dias_inhabiles;

  const ws: XLSX.WorkSheet = {};
  const set = (addr: string, cell: any) => {
    ws[addr] = cell;
  };

  set('A1', t('Calculo finiquito', { font: { ...FUENTE_B, sz: 12 } }));

  set('A3', t('Nombre:', { font: FUENTE_B }));
  set('B3', t(d.trabajador.nombre_completo_upper));

  set('A4', t('Rut:', { font: FUENTE_B }));
  set('B4', n(Number(d.trabajador.rut_miles.replace(/\./g, ''))));
  set('C4', t(`-${d.trabajador.dv}`));

  set('A5', t('CAUSAL:', { font: FUENTE_B }));
  set('B5', t(`Artículo Nº ${fin.articulo} del Código del Trabajo — ${fin.terminos}`));

  set('A7', t('Contrato', { font: FUENTE_B }));
  set('A8', t('Fecha inicio:', { font: FUENTE_B }));
  set('B8', n(serialExcel(d.contrato.fecha_inicio), FMT_FECHA));
  set('A9', t('Fecha Término:', { font: FUENTE_B }));
  set('B9', n(serialExcel(d.contrato.fecha_termino), FMT_FECHA));

  set('A11', t('Factor '));
  set('B11', n(1.25));

  set('A13', t('Calculo valor sueldo por día:', { font: FUENTE_B }));
  set('A14', t('Sueldo Imp.', { font: FUENTE_B }));
  set('B14', n(fin.sueldo_imponible, FMT_MILES));
  set('A15', t('N° días por mes'));
  set('B15', n(30, FMT_MILES));
  set('A16', t('Valor sueldo por día', { font: FUENTE_B }));
  set('B16', f('B14/B15', fin.valor_dia, FMT_MILES));

  set('A18', t('Calculo días feriado legal (hábiles)', { font: FUENTE_B }));
  set(
    'A19',
    t(`${fechaDDMMYYYY(d.contrato.fecha_inicio)} A ${fechaDDMMYYYY(d.contrato.fecha_termino)}`),
  );
  set('B19', f('DATEDIF(B8,B9,"m")', fin.meses));
  set('C19', t('MESES'));
  set('D19', f('DATEDIF(B8,B9,"md")', fin.dias));
  set('E19', t('DÍAS'));

  // Tabla período · factor · total (con bordes y encabezados centrados).
  set('A22', t('periodo', { font: FUENTE_B, alignment: CENTRO, border: BORDE }));
  set('B22', t('Factor', { font: FUENTE_B, alignment: CENTRO, border: BORDE }));
  set('C22', t('Total días feriado hábiles', { font: FUENTE_B, alignment: CENTRO, border: BORDE }));
  ws['A23'] = { t: 's', f: 'B19&" MESES"', v: `${fin.meses} MESES`, s: { font: FUENTE, border: BORDE } };
  set('B23', n(1.25, undefined, { border: BORDE, alignment: { horizontal: 'center' } }));
  set('C23', f('B23*B19', habilesMeses, FMT_DEC2, { border: BORDE, alignment: { horizontal: 'center' } }));
  ws['A24'] = { t: 's', f: 'D19&" DÍAS"', v: `${fin.dias} DÍAS`, s: { font: FUENTE, border: BORDE } };
  set('B24', n(1.25, undefined, { border: BORDE, alignment: { horizontal: 'center' } }));
  set('C24', f('(B24/30)*D19', habilesDias, FMT_DEC2, { border: BORDE, alignment: { horizontal: 'center' } }));
  set('A25', t('', { border: BORDE }));
  set('B25', t('', { border: BORDE }));
  set('C25', f('SUM(C23:C24)', habiles, FMT_DEC2, { border: BORDE, alignment: { horizontal: 'center' } }));

  // Proyección del feriado. Se dibuja un calendario por cada mes que abarca,
  // porque el feriado casi siempre cruza al mes siguiente y con un solo
  // calendario los días proyectados quedarían fuera de la vista.
  const proyeccion = proyectarFeriado(
    d.contrato.fecha_termino,
    fin.dias_habiles,
    new Set(fin.feriados ?? []),
  );
  const setHabiles = new Set(proyeccion.habiles);
  const setInhabiles = new Set(proyeccion.inhabiles);
  const todasLasFechas = [...proyeccion.habiles, ...proyeccion.inhabiles].sort();
  const meses = mesesADibujar(d.contrato.fecha_termino, todasLasFechas);

  meses.forEach(({ anio, mes }, i) => {
    const filaEncabezado = FILA_CAL_INICIAL + i * FILAS_POR_CALENDARIO;
    const titulo =
      i === 0
        ? `Proyección Feriado: ${cap(MESES_ES[mes])} ${anio}`
        : `Mes Siguiente: ${cap(MESES_ES[mes])} ${anio}`;
    agregarCalendario(set, filaEncabezado, anio, mes, titulo, setHabiles, setInhabiles);
  });

  // El resumen arranca dos filas debajo de la última semana dibujada.
  const ultimaFilaCal =
    FILA_CAL_INICIAL + (meses.length - 1) * FILAS_POR_CALENDARIO + SEMANAS_POR_CALENDARIO;
  const r = ultimaFilaCal + 2;

  set(`A${r}`, t('Total día hábiles feriado ', { font: FUENTE_B }));
  set(`B${r}`, f('C25', habiles, FMT_DEC2));
  set(`C${r}`, t('(color amarillo)'));
  set(`A${r + 1}`, t('total días inhábiles feriado '));
  set(`B${r + 1}`, n(fin.dias_inhabiles));
  set(`C${r + 1}`, t('(color azul)'));
  set(`A${r + 2}`, t('total días feriado a pagar', { font: FUENTE_B }));
  set(`B${r + 2}`, f(`SUM(B${r}:B${r + 1})`, feriadoAPagar, FMT_DEC2, { font: FUENTE_B }));

  set(`A${r + 5}`, t('Total días feriado legal', { font: FUENTE_B }));
  set(`B${r + 5}`, f(`ROUND(B${r + 2},2)`, fin.fp, FMT_DEC2, { font: FUENTE_B }));
  set(`A${r + 6}`, t('Valor sueldo por día'));
  set(`B${r + 6}`, f('B16', fin.valor_dia, FMT_PESOS));
  set(`A${r + 7}`, t('Total Finiquito a pagar', { font: FUENTE_B }));
  set(`B${r + 7}`, f(`B${r + 6}*B${r + 5}`, fin.total, FMT_PESOS, { font: FUENTE_B }));

  ws['!ref'] = `A1:M${r + 7}`;
  // A: etiquetas; B: valores / Lunes; C-H: resto del calendario (caben los 7 días).
  ws['!cols'] = [
    { wch: 28.57 },
    { wch: 11 },
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
  ];
  return ws;
}

/**
 * Dibuja un calendario mensual completo (6 semanas, de lunes a domingo)
 * empezando en el lunes de la semana que contiene el día 1 del mes, igual que
 * la planilla original.
 *
 * Los días de meses vecinos que aparecen para completar la grilla se dibujan
 * SIN color: cada fecha se colorea únicamente en el calendario de su propio
 * mes, para no pintarla dos veces cuando dos calendarios se solapan.
 */
function agregarCalendario(
  set: (a: string, c: any) => void,
  filaEncabezado: number,
  anio: number,
  mesIdx: number,
  titulo: string,
  habiles: Set<string>,
  inhabiles: Set<string>,
) {
  set(`A${filaEncabezado}`, t(titulo, { font: FUENTE_B }));
  const cabeceras = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const colsCal = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
  cabeceras.forEach((h, i) =>
    set(`${colsCal[i]}${filaEncabezado}`, t(h, { font: FUENTE_B, alignment: CENTRO, border: BORDE })),
  );

  // Lunes de la semana que contiene el día 1 del mes.
  const primero = new Date(Date.UTC(anio, mesIdx, 1));
  const desplazamiento = (primero.getUTCDay() + 6) % 7; // 0 = ya es lunes
  const cursor = new Date(Date.UTC(anio, mesIdx, 1 - desplazamiento));

  for (let semana = 0; semana < SEMANAS_POR_CALENDARIO; semana++) {
    for (let col = 0; col < 7; col++) {
      const iso = isoDeUTC(cursor);
      const esDelMes = cursor.getUTCMonth() === mesIdx && cursor.getUTCFullYear() === anio;
      const serial = (cursor.getTime() - Date.UTC(1899, 11, 30)) / 86400000;

      let relleno: any = undefined;
      if (esDelMes) {
        if (habiles.has(iso)) relleno = AMARILLO;
        else if (inhabiles.has(iso)) relleno = AZUL;
      }

      set(`${colsCal[col]}${filaEncabezado + 1 + semana}`, {
        t: 'n',
        v: serial,
        z: 'd',
        s: {
          font: FUENTE,
          border: BORDE,
          alignment: { horizontal: 'center' },
          ...(relleno ? { fill: relleno } : {}),
        },
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nombre de archivo estilo «Calculo finiquito NOMBRE APELLIDOS.xlsx». */
export function nombreArchivoCalculo(d: DatosFiniquito): string {
  const limpio = d.trabajador.nombre_completo_upper.replace(/[\\/:*?"<>|]/g, '').trim();
  return `Calculo finiquito ${limpio}.xlsx`;
}

/** Libro con una sola hoja «Principal» para un trabajador. */
export function construirLibroCalculo(d: DatosFiniquito): XLSX.WorkBook {
  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, construirHojaCalculo(d), 'Principal');
  return wb;
}

/** Bytes .xlsx del cálculo de un trabajador. */
export function excelCalculoBuffer(d: DatosFiniquito): Uint8Array {
  const wb = construirLibroCalculo(d);
  return XL.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

/** Descarga el Excel de cálculo de un solo trabajador (cliente). */
export function descargarExcelCalculo(d: DatosFiniquito): void {
  const bytes = excelCalculoBuffer(d);
  descargarBlob(
    new Blob([bytes as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    nombreArchivoCalculo(d),
  );
}

/**
 * Descarga un ZIP con un Excel de cálculo por trabajador (uno por archivo),
 * replicando la carpeta «Excels_Trabajadores».
 */
export function descargarZipCalculos(lista: DatosFiniquito[], nombreZip: string): void {
  const zip = new PizZip();
  const usados = new Map<string, number>();
  for (const d of lista) {
    const nombreBase = nombreArchivoCalculo(d);
    const veces = usados.get(nombreBase) ?? 0;
    const nombre = veces > 0 ? nombreBase.replace(/\.xlsx$/, ` (${veces}).xlsx`) : nombreBase;
    usados.set(nombreBase, veces + 1);
    zip.file(nombre, excelCalculoBuffer(d));
  }
  const blob = zip.generate({ type: 'blob' });
  descargarBlob(blob, nombreZip);
}

function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
