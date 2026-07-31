import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [valorDebounced, setValorDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setValorDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return valorDebounced;
}
