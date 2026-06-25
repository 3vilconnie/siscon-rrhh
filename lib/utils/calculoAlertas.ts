// lib/utils/calculoAlertas.ts
import { Trabajador } from '@/types';

export interface ConfigAlertas {
  ventana_meses?: number;
  enfriamiento_meses?: number;
  minimo_contratos?: number;
}

export function evaluarAlertaContinuidad(
  trabajador: Trabajador, 
  config: ConfigAlertas = {}, 
  fechaReferencia: Date = new Date()
) {
  const ventana = config.ventana_meses ?? 15;
  const enfriamiento = config.enfriamiento_meses ?? 3;
  const minContratos = config.minimo_contratos ?? 2;

  if (!trabajador.contratos || trabajador.contratos.length < minContratos) {
    return { califica: false, totalContratos: 0 };
  }

  const limiteTiempoAtras = new Date(fechaReferencia);
  limiteTiempoAtras.setMonth(limiteTiempoAtras.getMonth() - ventana);

  // 1. Filtrar y ordenar contratos cronológicamente
  const contratosVentana = trabajador.contratos
    .filter(c => new Date(c.fecha_inicio) >= limiteTiempoAtras)
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  // 2. Validar vigencia laboral actual
  const tieneContratoActivo = contratosVentana.some(c => {
    if (!c.fecha_termino) return true;
    const fTermino = new Date(c.fecha_termino);
    fTermino.setHours(0, 0, 0, 0);
    const hoySinHoras = new Date(fechaReferencia);
    hoySinHoras.setHours(0, 0, 0, 0);
    return fTermino >= hoySinHoras;
  });

  // 3. Evaluar la RACHA ACTUAL con cálculo calendario
  let rachaActual = 0;

  if (contratosVentana.length > 0) {
    rachaActual = 1;

    for (let i = 1; i < contratosVentana.length; i++) {
      const contratoPrevio = contratosVentana[i - 1];
      const contratoActual = contratosVentana[i];

      if (contratoPrevio.fecha_termino) {
        const dPrevio = new Date(contratoPrevio.fecha_termino);
        const dActual = new Date(contratoActual.fecha_inicio);
        
        // CÁLCULO CALENDARIO: Diferencia de meses reales considerando años
        // Ej: (2026 - 2025) * 12 + (Abril(3) - Diciembre(11)) = 12 + (-8) = 4 meses de diferencia entre inicios de mes
        let mesesDiferencia = (dActual.getFullYear() - dPrevio.getFullYear()) * 12 + (dActual.getMonth() - dPrevio.getMonth());

        // Ajuste fino: Si el contrato actual empezó a principio de mes, pero el anterior terminó a fin de mes,
        // la resta matemática de los meses da 1 menos del tiempo real "fuera".
        // Ej: 31-12 a 01-04 -> mesesDiferencia = 4. 
        // Si dActual.getDate() es 1, estuvo todo el mes previo fuera.
        
        // Para asegurar que el enfriamiento se cumpla, evaluamos si mesesDiferencia >= enfriamiento
        if (mesesDiferencia < enfriamiento) {
          rachaActual++;
        } else {
          // Ya cumplió el periodo de enfriamiento
          rachaActual = 1;
        }
      } else {
        rachaActual++;
      }
    }
  }

  // 4. Calcular fecha sugerida de término
  let fechaSugerida = 'Revisar ficha';
  if (rachaActual >= minContratos && tieneContratoActivo) {
    const contratosConTermino = contratosVentana.filter(c => c.fecha_termino);
    if (contratosConTermino.length > 0) {
      const ultimoTermino = new Date(contratosConTermino[contratosConTermino.length - 1].fecha_termino!);
      ultimoTermino.setMonth(ultimoTermino.getMonth() + enfriamiento);
      fechaSugerida = ultimoTermino.toLocaleDateString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
  }

  return {
    califica: rachaActual >= minContratos && tieneContratoActivo,
    totalContratos: rachaActual,
    fechaSugerida,
    tieneVigente: tieneContratoActivo
  };
}