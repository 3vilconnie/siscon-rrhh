import { useState, useEffect } from 'react';

/**
 * Devuelve una versión "retrasada" de `value`: solo se actualiza cuando pasan
 * `delay` milisegundos sin que `value` cambie. Útil para búsquedas y filtros,
 * evitando ejecutar lógica pesada en cada tecla.
 *
 * @example
 * const [busqueda, setBusqueda] = useState('');
 * const busquedaDebounced = useDebounce(busqueda, 300);
 * // usa `busqueda` en el input y `busquedaDebounced` para filtrar
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [valorDebounced, setValorDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setValorDebounced(value), delay);
    return () => clearTimeout(timer); // cancela si `value` cambia antes del delay
  }, [value, delay]);

  return valorDebounced;
}
