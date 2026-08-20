// lib/importarPersonales.ts
// Lee una planilla con datos personales de trabajadores y prepara los cambios
// que habría que aplicar sobre la tabla `trabajadores`.
//
// Nace de un problema concreto: los datos que necesita el Anexo de Horas Extra
// (domicilio, ciudad, fecha de nacimiento, estado civil, nacionalidad y género)
// existían solo en la planilla "DATA -Plantilla horas extras.xlsm" y estaban en
// NULL en la base. En vez de que el módulo lea la planilla cada vez, se importa
// una vez y de ahí en adelante todo sale de la base.
//
// Las columnas se reconocen por NOMBRE, no por posición, y se aceptan los dos
// vocabularios que aparecen en las planillas del usuario ("GENERO"/"Sexo",
// "FECHA_NAC"/"Fec_Nacimiento", etc.), así que sirve para cualquiera de sus
// hojas y para planillas futuras.

import { parseFechaTexto, parseNumeroCL } from '@/lib/contrato';

/** Campos que se pueden importar, con los encabezados que los identifican. */
const MAPA_COLUMNAS: Record<string, string[]> = {
  rut: ['rut'],
  dv: ['dv', 'digitoverificador'],
  nombres: ['nombre', 'nombres'],
  primer_apellido: ['apellidop', 'appaterno', 'apellidopaterno', 'primerapellido'],
  segundo_apellido: ['apellidom', 'apmaterno', 'apellidomaterno', 'segundoapellido'],
  genero: ['genero', 'sexo'],
  nacionalidad: ['nacionalidad'],
  estado_civil: ['estadociv', 'estadocivil'],
  domicilio: ['domicilio', 'direccion'],
  comuna: ['ciudad', 'comuna'],
  fecha_nac: ['fechanac', 'fecnacimiento', 'fechanacimiento'],
  lugar_nac: ['lugarnac', 'lugarnacimiento'],
  /** No pertenece a `trabajadores`: se aplica al contrato vigente. */
  programa: ['programa', 'unidad'],
};

/** Campos que se escriben en la tabla `trabajadores`. */
export const CAMPOS_TRABAJADOR = [
  'dv',
  'nombres',
  'primer_apellido',
  'segundo_apellido',
  'genero',
  'nacionalidad',
  'estado_civil',
  'domicilio',
  'comuna',
  'fecha_nac',
  'lugar_nac',
] as const;

export type CampoTrabajador = (typeof CAMPOS_TRABAJADOR)[number];

export interface FilaImportada {
  rut: number;
  /** Solo los campos presentes en la planilla y con valor. */
  valores: Partial<Record<CampoTrabajador, string>>;
  /** Programa a aplicar al contrato vigente, si la planilla lo trae. */
  programa?: string;
}

export interface ErrorImportacion {
  fila: number;
  motivo: string;
}

function normalizar(clave: string): string {
  return clave
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** "Masculino" / "M" -> "M"; "Femenino" / "F" -> "F"; cualquier otra cosa -> "". */
function normalizarGenero(valor: string): string {
  const v = normalizar(valor);
  if (v.startsWith('m')) return 'M';
  if (v.startsWith('f')) return 'F';
  return '';
}

/**
 * Traduce las filas crudas de una hoja (ya convertidas a objetos por `xlsx`)
 * a cambios listos para aplicar. Las filas sin RUT válido se descartan y se
 * informan aparte, para no aplicar una importación a medias en silencio.
 */
export function interpretarFilas(filas: Record<string, unknown>[]): {
  cambios: FilaImportada[];
  errores: ErrorImportacion[];
} {
  const cambios: FilaImportada[] = [];
  const errores: ErrorImportacion[] = [];
  // Un mismo trabajador puede aparecer en varias filas (la planilla de horas
  // extra tiene una fila por trabajador y mes): gana la última, que es la más
  // reciente, pero se van completando los huecos con lo que traigan las otras.
  const porRut = new Map<number, FilaImportada>();

  filas.forEach((cruda, indice) => {
    const numeroFila = indice + 2; // +1 por el encabezado, +1 porque Excel parte en 1

    // Índice de la fila por nombre de columna normalizado.
    const porClave: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cruda)) porClave[normalizar(k)] = v;

    /** Valor crudo de la primera columna con datos que corresponda al campo. */
    const leerCrudo = (campo: string): unknown => {
      for (const alias of MAPA_COLUMNAS[campo] ?? []) {
        const v = porClave[alias];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return undefined;
    };

    const leer = (campo: string): string => {
      const v = leerCrudo(campo);
      return v === undefined ? '' : String(v).trim();
    };

    const rut = parseNumeroCL(leer('rut'));
    if (!rut) {
      // Una fila totalmente vacía no es un error, solo relleno de la planilla.
      const tieneAlgo = Object.values(porClave).some((v) => String(v ?? '').trim() !== '');
      if (tieneAlgo) errores.push({ fila: numeroFila, motivo: 'RUT ausente o ilegible.' });
      return;
    }

    const valores: Partial<Record<CampoTrabajador, string>> = {};
    for (const campo of CAMPOS_TRABAJADOR) {
      const bruto = leer(campo);
      if (!bruto) continue;

      if (campo === 'genero') {
        const g = normalizarGenero(bruto);
        if (g) valores.genero = g;
        continue;
      }
      if (campo === 'fecha_nac') {
        // Se pasa el valor CRUDO: si viene como serial de Excel (37247) hay que
        // conservar el tipo número, porque parseFechaTexto distingue por tipo.
        const iso = parseFechaTexto(leerCrudo(campo));
        if (iso) valores.fecha_nac = iso;
        else
          errores.push({ fila: numeroFila, motivo: `Fecha de nacimiento ilegible: "${bruto}".` });
        continue;
      }
      valores[campo] = bruto;
    }

    const programa = leer('programa') || undefined;

    const previo = porRut.get(rut);
    if (previo) {
      Object.assign(previo.valores, valores);
      if (programa) previo.programa = programa;
    } else {
      const nuevo: FilaImportada = { rut, valores };
      if (programa) nuevo.programa = programa;
      porRut.set(rut, nuevo);
      cambios.push(nuevo);
    }
  });

  return { cambios, errores };
}
