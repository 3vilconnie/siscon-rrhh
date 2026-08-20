// lib/feriadosRepo.ts
// Carga los feriados cargados a mano (tabla `feriados`) y los combina con los
// calculados, entregando el set que consume el cálculo del finiquito.
//
// Se separa de lib/feriados.ts para que ese archivo siga siendo puro y
// testeable sin base de datos.

import { supabase } from '@/lib/supabase';
import {
  construirSetFeriados,
  type FeriadoManual,
  type RegionFeriado,
} from '@/lib/feriados';

/** Trae los feriados cargados a mano. Ante cualquier error devuelve []. */
export async function cargarFeriadosManuales(): Promise<FeriadoManual[]> {
  const { data, error } = await supabase
    .from('feriados')
    .select('fecha, nombre, region, excluir')
    .order('fecha');

  if (error || !data) {
    // No se interrumpe el cálculo: se sigue con los feriados calculados.
    if (error) console.error('No se pudieron cargar los feriados manuales:', error.message);
    return [];
  }

  return data.map((f) => ({
    fecha: String(f.fecha).slice(0, 10),
    nombre: f.nombre,
    region: f.region,
    excluir: !!f.excluir,
  }));
}

/**
 * Set de feriados listo para `calcularFiniquito`, cubriendo los años que puede
 * abarcar el feriado proyectado (el año del término y el siguiente).
 */
export async function cargarSetFeriados(
  anioTermino: number,
  region: RegionFeriado = 'arica',
): Promise<Set<string>> {
  const manuales = await cargarFeriadosManuales();
  return construirSetFeriados([anioTermino, anioTermino + 1], region, manuales);
}
