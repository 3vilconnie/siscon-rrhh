// lib/utils/calculoAlertas.ts
//
// Presunción de contrato indefinido del artículo 159 N°4, inciso quinto, del
// Código del Trabajo: norma anti-fraude que impide encadenar contratos a plazo
// fijo con interrupciones breves para no reconocer antigüedad.
//
// Los CUATRO requisitos son COPULATIVOS: deben cumplirse todos a la vez.
//   1. Más de dos contratos          → al menos 3 contratos con el mismo empleador
//   2. Servicios discontinuos        → debe existir al menos una brecha entre ellos
//   3. 12 meses o más acumulados     → suma de la duración efectiva trabajada
//   4. Dentro de 15 meses corridos   → contados desde el primer día del primer contrato
//
// Ejemplo de la norma (se usa como caso de prueba):
//   C1 01-ene → 30-abr (4 m) · pausa mayo · C2 01-jun → 30-sep (4 m) ·
//   pausa octubre · C3 01-nov → 28-feb (4 m)
//   ⇒ 3 contratos discontinuos, 12 meses trabajados, lapso total 14 meses
//   ⇒ el contrato 3 se convierte en indefinido de pleno derecho.

import { Trabajador, Contrato } from '@/types';

/** Días de un mes comercial, igual criterio que el cálculo de finiquito. */
const DIAS_MES = 30;

/**
 * Margen para avisar ANTES de que se gatille la presunción. Un trabajador con
 * los demás requisitos y esta cantidad de meses acumulados aparece como
 * "próxima" para poder decidir la renovación antes de que sea irreversible.
 */
const MARGEN_PREVENTIVO_MESES = 2;

export interface ConfigAlertas {
  /** Marco temporal dentro del cual deben caber los servicios (15 por ley). */
  ventana_meses?: number;
  /** Meses de servicio acumulados que gatillan la presunción (12 por ley). */
  meses_acumulados?: number;
  /** Contratos mínimos ("más de dos" ⇒ 3 por ley). */
  minimo_contratos?: number;
}

export type NivelAlerta = 'ninguna' | 'proxima' | 'critica';

export interface RequisitosArt159 {
  /** 1. Al menos `minimo_contratos` contratos. */
  contratos: boolean;
  /** 2. Existe al menos una interrupción entre contratos. */
  discontinuo: boolean;
  /** 3. Suma de servicios ≥ `meses_acumulados`. */
  acumulado: boolean;
  /** 4. El conjunto cabe dentro de `ventana_meses`. */
  ventana: boolean;
}

export interface ResultadoAlerta {
  /** true si hay alerta (crítica o próxima). */
  califica: boolean;
  nivel: NivelAlerta;
  /** Contratos del grupo evaluado (los que caen en la ventana). */
  totalContratos: number;
  /** Meses de servicio efectivamente trabajados, sumados. */
  mesesTrabajados: number;
  /** Lapso total del grupo, del primer inicio al último término. */
  mesesVentana: number;
  esDiscontinuo: boolean;
  tieneVigente: boolean;
  /** Fecha desde la cual un nuevo contrato abre una ventana nueva. */
  fechaSugerida: string;
  requisitos: RequisitosArt159;
}

const SIN_ALERTA: ResultadoAlerta = {
  califica: false,
  nivel: 'ninguna',
  totalContratos: 0,
  mesesTrabajados: 0,
  mesesVentana: 0,
  esDiscontinuo: false,
  tieneVigente: false,
  fechaSugerida: '',
  requisitos: { contratos: false, discontinuo: false, acumulado: false, ventana: false },
};

/** Fecha ISO (YYYY-MM-DD) a Date UTC, sin desfase de zona horaria. */
function aUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function sumarMeses(fecha: Date, meses: number): Date {
  const r = new Date(fecha.getTime());
  r.setUTCMonth(r.getUTCMonth() + meses);
  return r;
}

function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 86400000);
}

function formatearFecha(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

interface ContratoNormalizado {
  inicio: Date;
  /** Término efectivo: el pactado o, si sigue vigente, la fecha de referencia. */
  termino: Date;
  vigente: boolean;
}

/**
 * Evalúa un grupo de contratos consecutivos como candidato a gatillar la
 * presunción. Devuelve las métricas de los 4 requisitos.
 */
function evaluarGrupo(
  grupo: ContratoNormalizado[],
  cfg: Required<ConfigAlertas>,
): { meses: number; lapso: number; discontinuo: boolean; requisitos: RequisitosArt159 } {
  // Requisito 3: duración efectiva sumada (días inclusivos → meses comerciales).
  const dias = grupo.reduce((acc, c) => acc + diasEntre(c.inicio, c.termino) + 1, 0);
  const meses = dias / DIAS_MES;

  // Requisito 4: lapso total, del primer inicio al último término.
  const lapsoDias = diasEntre(grupo[0].inicio, grupo[grupo.length - 1].termino) + 1;
  const lapso = lapsoDias / DIAS_MES;

  // Requisito 2: al menos una interrupción real entre contratos sucesivos.
  let discontinuo = false;
  for (let i = 1; i < grupo.length; i++) {
    if (diasEntre(grupo[i - 1].termino, grupo[i].inicio) - 1 > 0) {
      discontinuo = true;
      break;
    }
  }

  return {
    meses,
    lapso,
    discontinuo,
    requisitos: {
      contratos: grupo.length >= cfg.minimo_contratos,
      discontinuo,
      acumulado: meses >= cfg.meses_acumulados,
      ventana: lapso <= cfg.ventana_meses,
    },
  };
}

/**
 * Determina si un trabajador cae bajo la presunción del art. 159 N°4 inciso 5°.
 *
 * Recorre cada contrato como posible inicio de la ventana de 15 meses (no solo
 * el primero de todos): un trabajador con historial largo puede tener un grupo
 * que gatilla la norma años después del primer contrato.
 */
export function evaluarAlertaContinuidad(
  trabajador: Trabajador,
  config: ConfigAlertas = {},
  fechaReferencia: Date = new Date(),
): ResultadoAlerta {
  const cfg: Required<ConfigAlertas> = {
    ventana_meses: config.ventana_meses ?? 15,
    meses_acumulados: config.meses_acumulados ?? 12,
    minimo_contratos: config.minimo_contratos ?? 3,
  };

  const contratos: Contrato[] = trabajador.contratos ?? [];
  if (contratos.length < cfg.minimo_contratos - 1) return SIN_ALERTA;

  const hoy = new Date(
    Date.UTC(
      fechaReferencia.getUTCFullYear(),
      fechaReferencia.getUTCMonth(),
      fechaReferencia.getUTCDate(),
    ),
  );

  const normalizados: ContratoNormalizado[] = contratos
    .filter((c) => !!c.fecha_inicio)
    .map((c) => {
      const inicio = aUTC(c.fecha_inicio);
      // Un contrato sin término (indefinido o en curso) se computa hasta hoy.
      const vigente = !c.fecha_termino || aUTC(c.fecha_termino) >= hoy;
      const termino = c.fecha_termino ? aUTC(c.fecha_termino) : hoy;
      return { inicio, termino, vigente };
    })
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  if (normalizados.length === 0) return SIN_ALERTA;

  // Solo se alerta sobre personal con relación laboral vigente: la norma
  // importa para decidir si se puede o no terminar por vencimiento del plazo.
  const tieneVigente = normalizados.some((c) => c.vigente);
  if (!tieneVigente) return SIN_ALERTA;

  let mejor: ResultadoAlerta | null = null;

  for (let ancla = 0; ancla < normalizados.length; ancla++) {
    const inicioVentana = normalizados[ancla].inicio;
    const finVentana = sumarMeses(inicioVentana, cfg.ventana_meses);

    // Contratos que caben completos dentro de la ventana de 15 meses.
    const grupo = normalizados.filter(
      (c, i) => i >= ancla && c.inicio >= inicioVentana && c.termino <= finVentana,
    );
    if (grupo.length === 0) continue;

    const { meses, lapso, discontinuo, requisitos } = evaluarGrupo(grupo, cfg);

    const cumpleTodos =
      requisitos.contratos && requisitos.discontinuo && requisitos.acumulado && requisitos.ventana;

    // "Próxima": ya es discontinuo, cabe en la ventana y le falta poco —
    // sea por meses acumulados o por un contrato.
    const cercaPorMeses =
      meses >= cfg.meses_acumulados - MARGEN_PREVENTIVO_MESES && meses < cfg.meses_acumulados;
    const cercaPorContratos = grupo.length === cfg.minimo_contratos - 1;
    const esProxima =
      !cumpleTodos &&
      requisitos.discontinuo &&
      requisitos.ventana &&
      (grupo.length >= cfg.minimo_contratos || cercaPorContratos) &&
      (cercaPorMeses || (cercaPorContratos && meses >= cfg.meses_acumulados));

    if (!cumpleTodos && !esProxima) continue;

    const candidato: ResultadoAlerta = {
      califica: true,
      nivel: cumpleTodos ? 'critica' : 'proxima',
      totalContratos: grupo.length,
      mesesTrabajados: Math.round(meses * 100) / 100,
      mesesVentana: Math.round(lapso * 100) / 100,
      esDiscontinuo: discontinuo,
      tieneVigente,
      // Pasada la ventana del grupo, un contrato nuevo abre un cómputo nuevo.
      fechaSugerida: formatearFecha(sumarMeses(inicioVentana, cfg.ventana_meses + 1)),
      requisitos,
    };

    // Se prioriza la situación más grave; a igual nivel, la de más meses.
    const mejorPuntaje = mejor ? (mejor.nivel === 'critica' ? 1000 : 0) + mejor.mesesTrabajados : -1;
    const puntaje = (candidato.nivel === 'critica' ? 1000 : 0) + candidato.mesesTrabajados;
    if (puntaje > mejorPuntaje) mejor = candidato;
  }

  return mejor ?? { ...SIN_ALERTA, tieneVigente };
}
