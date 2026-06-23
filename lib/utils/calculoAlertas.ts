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
  // Asignación dinámica: Usa lo que viene de la BD o los valores tradicionales por defecto
  const ventana = config.ventana_meses ?? 15;
  const enfriamiento = config.enfriamiento_meses ?? 3;
  const minContratos = config.minimo_contratos ?? 2;

  if (!trabajador.contratos || trabajador.contratos.length < minContratos) {
    return { califica: false, totalContratos: 0 };
  }

  const limiteTiempoAtras = new Date(fechaReferencia);
  limiteTiempoAtras.setMonth(limiteTiempoAtras.getMonth() - ventana);

  // 1. Filtrar contratos dentro de la ventana dinámica
  const contratosVentana = trabajador.contratos
    .filter(c => new Date(c.fecha_inicio) >= limiteTiempoAtras)
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  // 2. Validar vigencia laboral
  const tieneContratoActivo = contratosVentana.some(c => {
    if (!c.fecha_termino) return true;
    const fTermino = new Date(c.fecha_termino);
    fTermino.setHours(0, 0, 0, 0);
    const hoySinHoras = new Date(fechaReferencia);
    hoySinHoras.setHours(0, 0, 0, 0);
    return fTermino >= hoySinHoras;
  });

  // 3. Evaluar brechas con el parámetro dinámico de enfriamiento
  let contratosConsecutivosMax = 0;
  let rachaActual = 0;

  if (contratosVentana.length > 0) {
    rachaActual = 1;
    contratosConsecutivosMax = 1;

    for (let i = 1; i < contratosVentana.length; i++) {
      const contratoPrevio = contratosVentana[i - 1];
      const contratoActual = contratosVentana[i];

      if (contratoPrevio.fecha_termino) {
        const finPrevio = new Date(contratoPrevio.fecha_termino);
        const inicioActual = new Date(contratoActual.fecha_inicio);
        const diferenciaMeses = (inicioActual.getTime() - finPrevio.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

        if (diferenciaMeses < enfriamiento) {
          rachaActual++;
          if (rachaActual > contratosConsecutivosMax) contratosConsecutivosMax = rachaActual;
        } else {
          rachaActual = 1;
        }
      } else {
        rachaActual++;
        if (rachaActual > contratosConsecutivosMax) contratosConsecutivosMax = rachaActual;
      }
    }
  }

  // 4. Calcular fecha sugerida basada en los nuevos parámetros
  let fechaSugerida = 'Revisar ficha';
  if (contratosConsecutivosMax >= minContratos && tieneContratoActivo) {
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
    califica: contratosConsecutivosMax >= minContratos && tieneContratoActivo,
    totalContratos: contratosConsecutivosMax,
    fechaSugerida,
    tieneVigente: tieneContratoActivo
  };
}