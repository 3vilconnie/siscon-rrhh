// lib/rut.ts
// Utilidades del RUT chileno, compartidas por los formularios que capturan
// identidad de trabajadores.

/**
 * Calcula el dígito verificador de un RUT con el algoritmo de módulo 11.
 * Acepta el cuerpo del RUT con o sin puntos; devuelve '' si no hay dígitos.
 */
export function calcularDV(cuerpoRut: string): string {
  const cuerpo = cuerpoRut.replace(/[^0-9]/g, '');
  if (!cuerpo) return '';

  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += multiplicador * parseInt(cuerpo.charAt(i));
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const dvCalculado = 11 - (suma % 11);
  if (dvCalculado === 11) return '0';
  if (dvCalculado === 10) return 'K';
  return dvCalculado.toString();
}
