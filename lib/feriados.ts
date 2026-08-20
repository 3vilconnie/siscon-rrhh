// lib/feriados.ts
// Feriados legales de Chile, usados para descontar días inhábiles en el
// cálculo del feriado proporcional del finiquito.
//
// Se combinan DOS fuentes:
//   1. Los calculables (este archivo): fechas fijas por ley + los derivados de
//      la Pascua de Resurrección + los desplazables de la Ley 19.668.
//   2. Los cargados a mano en la tabla `feriados` de Supabase: elecciones,
//      feriados creados por leyes puntuales, o correcciones a los calculados.
//      Ver lib/feriadosRepo.ts y db/feriados.sql.
//
// La segunda fuente existe porque hay feriados que NO son deducibles: los días
// de elección se fijan por ley cada vez. Si el sistema solo calculara, esos
// días se contarían como hábiles y el finiquito saldría mal sin aviso.
//
// Compartido cliente/servidor: no importar módulos exclusivos de servidor.

/** Región con feriado propio reconocida por el sistema. */
export const REGIONES_FERIADO = [
  { id: 'arica', etiqueta: 'Arica y Parinacota' },
  { id: 'ninguna', etiqueta: 'Sin feriado regional' },
] as const;

export type RegionFeriado = (typeof REGIONES_FERIADO)[number]['id'];

export interface Feriado {
  /** ISO YYYY-MM-DD */
  fecha: string;
  nombre: string;
  /** true si proviene de la tabla editable en vez del cálculo. */
  manual?: boolean;
}

function iso(y: number, mesIdx: number, dia: number): string {
  return new Date(Date.UTC(y, mesIdx, dia)).toISOString().slice(0, 10);
}

function diaSemana(fechaISO: string): number {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
}

function desplazar(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/**
 * Domingo de Pascua (algoritmo gregoriano anónimo, Meeus/Jones/Butcher).
 * De aquí salen Viernes Santo y Sábado Santo.
 */
export function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(anio, mes - 1, dia);
}

/**
 * Ley 19.668: el 29 de junio y el 12 de octubre se trasladan al lunes.
 * Si caen martes, miércoles o jueves → lunes de esa misma semana.
 * Si caen viernes → lunes de la semana siguiente.
 * Si caen sábado, domingo o lunes → se mantienen.
 *
 * NOTA: verifica estos dos casos con el calendario oficial del año en curso.
 * Si alguno no calza, corrígelo desde la tabla de feriados (Admin) — ahí puedes
 * excluir la fecha calculada y agregar la correcta.
 */
function trasladarALunes(fechaISO: string): string {
  const dow = diaSemana(fechaISO);
  if (dow >= 2 && dow <= 4) return desplazar(fechaISO, -(dow - 1)); // mar/mié/jue → lunes previo
  if (dow === 5) return desplazar(fechaISO, 3); // viernes → lunes siguiente
  return fechaISO;
}

/**
 * Ley 20.299 (Día de las Iglesias Evangélicas, 31 de octubre):
 * si cae martes se adelanta al viernes anterior; si cae miércoles se posterga
 * al viernes siguiente. En cualquier otro caso se mantiene.
 */
function trasladarIglesiasEvangelicas(fechaISO: string): string {
  const dow = diaSemana(fechaISO);
  if (dow === 2) return desplazar(fechaISO, -4); // martes → viernes anterior
  if (dow === 3) return desplazar(fechaISO, 3); // miércoles → viernes siguiente
  return fechaISO;
}

/** Feriados calculables de un año, para la región indicada. */
export function feriadosCalculados(anio: number, region: RegionFeriado = 'arica'): Feriado[] {
  const pascua = domingoDePascua(anio);

  const lista: Feriado[] = [
    { fecha: iso(anio, 0, 1), nombre: 'Año Nuevo' },
    { fecha: desplazar(pascua, -2), nombre: 'Viernes Santo' },
    { fecha: desplazar(pascua, -1), nombre: 'Sábado Santo' },
    { fecha: iso(anio, 4, 1), nombre: 'Día Nacional del Trabajo' },
    { fecha: iso(anio, 4, 21), nombre: 'Día de las Glorias Navales' },
    // Ley 21.357: se celebra en el solsticio de invierno (20 o 21 de junio
    // según el año). Se usa el 21 por defecto; si un año cae el 20, corrígelo
    // desde la tabla de feriados.
    { fecha: iso(anio, 5, 21), nombre: 'Día Nacional de los Pueblos Indígenas' },
    { fecha: trasladarALunes(iso(anio, 5, 29)), nombre: 'San Pedro y San Pablo' },
    { fecha: iso(anio, 6, 16), nombre: 'Virgen del Carmen' },
    { fecha: iso(anio, 7, 15), nombre: 'Asunción de la Virgen' },
    { fecha: iso(anio, 8, 18), nombre: 'Independencia Nacional' },
    { fecha: iso(anio, 8, 19), nombre: 'Día de las Glorias del Ejército' },
    { fecha: trasladarALunes(iso(anio, 9, 12)), nombre: 'Encuentro de Dos Mundos' },
    {
      fecha: trasladarIglesiasEvangelicas(iso(anio, 9, 31)),
      nombre: 'Día de las Iglesias Evangélicas y Protestantes',
    },
    { fecha: iso(anio, 10, 1), nombre: 'Día de Todos los Santos' },
    { fecha: iso(anio, 11, 8), nombre: 'Inmaculada Concepción' },
    { fecha: iso(anio, 11, 25), nombre: 'Navidad' },
  ];

  if (region === 'arica') {
    // Ley 20.663, feriado regional de Arica y Parinacota.
    lista.push({ fecha: iso(anio, 5, 7), nombre: 'Asalto y Toma del Morro de Arica' });
  }

  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Entrada de la tabla editable: agrega un feriado o excluye uno calculado. */
export interface FeriadoManual {
  fecha: string; // ISO
  nombre: string;
  /** Si es true, la fecha se QUITA del set (sirve para corregir un calculado). */
  excluir?: boolean;
  /** null = aplica a todas las regiones. */
  region?: string | null;
}

/**
 * Set de fechas inhábiles por feriado para un rango de años, combinando los
 * calculados con los cargados a mano. Es lo que consume el cálculo del
 * finiquito.
 */
export function construirSetFeriados(
  anios: number[],
  region: RegionFeriado = 'arica',
  manuales: FeriadoManual[] = [],
): Set<string> {
  const set = new Set<string>();

  for (const anio of anios) {
    for (const f of feriadosCalculados(anio, region)) set.add(f.fecha);
  }

  for (const m of manuales) {
    // Un feriado regional de otra región no aplica.
    if (m.region && m.region !== region) continue;
    if (m.excluir) set.delete(m.fecha);
    else set.add(m.fecha);
  }

  return set;
}

/** Devuelve el detalle (con nombres) para mostrar en pantalla. */
export function listarFeriados(
  anio: number,
  region: RegionFeriado = 'arica',
  manuales: FeriadoManual[] = [],
): Feriado[] {
  const calculados = feriadosCalculados(anio, region);
  const excluidas = new Set(
    manuales.filter((m) => m.excluir && (!m.region || m.region === region)).map((m) => m.fecha),
  );

  const agregados: Feriado[] = manuales
    .filter(
      (m) =>
        !m.excluir && (!m.region || m.region === region) && m.fecha.startsWith(String(anio)),
    )
    .map((m) => ({ fecha: m.fecha, nombre: m.nombre, manual: true }));

  return [...calculados.filter((f) => !excluidas.has(f.fecha)), ...agregados].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );
}
