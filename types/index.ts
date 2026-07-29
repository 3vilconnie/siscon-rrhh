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
  genero?: "SR" | "M" | "F" | string;
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

export interface RegistroHoraCompensatoria {
  id: string;
  trabajador_rut: number;
  fecha: string;
  horas_solicitadas: number;
  creado_en?: string;
}

// Interfaz para el resumen mensual/anual (Simulación de Hoja 1)
export interface ResumenHorasFuncionario {
  rut: number;
  dv: string;
  nombreCompleto: string;
  horasConsumidasAnuales: number;
  horasDisponiblesAnuales: number; // 44 - horasConsumidasAnuales
  horasConsumidasMesSeleccionado: number;
}


type TipoDocumento = 'Finiquito' | 'Contrato' | 'Anexo contrato' | 'Notificación' | 'Otro';

interface FormularioRecepcion {
  tiposDocumento: TipoDocumento[];
  detalleOtroTipo?: string; // Nuevo campo para guardar la especificación
  fechaRecepcion: string;
  cantidadDocumentos: string;
  detalles: DetalleDocumento[];
  quienEntrega: string;
  quienRecibe: string;

}  

export interface DetalleDocumento {
  id: number;
  fechaEmision: string;
  cabecera: string;
  nombre: string;
  apellidoP: string;
  apellidoM: string | null;
  genero: string | undefined;
  rut: string;
  dv: string;
}
