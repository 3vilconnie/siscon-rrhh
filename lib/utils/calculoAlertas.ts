// lib/utils/calculoAlertas.ts
import { Trabajador } from '@/types';

export function evaluarAlertaContinuidad(trabajador: Trabajador, fechaReferencia: Date = new Date()) {
  if (!trabajador.contratos || trabajador.contratos.length < 2) {
    return { califica: false, totalContratos: 0 };
  }

  const quinceMesesAtras = new Date(fechaReferencia);
  quinceMesesAtras.setMonth(quinceMesesAtras.getMonth() - 15);

  // 1. Filtrar el marco de 15 meses y ordenar
  const contratosVentana = trabajador.contratos
    .filter(c => new Date(c.fecha_inicio) >= quinceMesesAtras)
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  // 2. Validar si tiene contrato vigente
  const tieneContratoActivo = contratosVentana.some(c => {
    if (!c.fecha_termino) return true;
    const fTermino = new Date(c.fecha_termino);
    fTermino.setHours(0, 0, 0, 0);
    const hoySinHoras = new Date(fechaReferencia);
    hoySinHoras.setHours(0, 0, 0, 0);
    return fTermino >= hoySinHoras;
  });

  // 3. Medir la brecha temporal (< 3 meses)
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

        if (diferenciaMeses < 3) {
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

  // 4. Calcular fecha sugerida de retorno (si califica)
  let fechaSugerida = 'Revisar ficha';
  if (contratosConsecutivosMax >= 2 && tieneContratoActivo) {
    const contratosConTermino = contratosVentana.filter(c => c.fecha_termino);
    if (contratosConTermino.length > 0) {
      const ultimoTermino = new Date(contratosConTermino[contratosConTermino.length - 1].fecha_termino!);
      ultimoTermino.setMonth(ultimoTermino.getMonth() + 3);
      fechaSugerida = ultimoTermino.toLocaleDateString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
  }

  return {
    califica: contratosConsecutivosMax >= 2 && tieneContratoActivo,
    totalContratos: contratosConsecutivosMax,
    fechaSugerida,
    tieneVigente: tieneContratoActivo
  };
}