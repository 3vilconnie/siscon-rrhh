// types/index.ts

export interface Contrato {
  id: string;
  jornada?: number;
  sueldo_base?: number;
  fecha_inicio: string;
  fecha_termino: string | null;
  // Propiedad que a veces devuelve Supabase al hacer count
  count?: number; 
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

export interface Usuario {
  id: string;
  email: string;
  app_metadata: { role?: string };
  banned_until?: string | null;
  created_at: string;
}

export interface ParametrosSistema {
  ventana_meses: number;
  enfriamiento_meses: number;
  minimo_contratos: number;
}

export interface LogAuditoria {
  id: string;
  actor: string;
  accion: string;
  detalles: string;
  creado_en: string;
}