// types/index.ts
export interface Contrato {
  id: string;
  jornada?: number;      // <-- Agrega el ?
  sueldo_base?: number;  // <-- Agrega el ?
  fecha_inicio: string;
  fecha_termino: string | null;
}

export interface Trabajador {
  rut: number;
  dv: string;
  nombres: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  contratos?: Contrato[];
  num_contratos?: number; 
}

export interface AlertaNotificacion {
  rut: number;
  dv?: string;
  nombreCompleto: string;
  totalContratos: number;
  tiene_vigente?: boolean;
  fecha_sugerida_retorno?: string;
  leida?: boolean;
}