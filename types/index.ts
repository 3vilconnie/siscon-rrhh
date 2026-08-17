// types/index.ts

export interface Contrato {
  id: string;
  trabajador_rut: number;
  jornada?: number;
  sueldo_base?: number;
  fecha_inicio: string;
  fecha_termino: string | null;
  labores?: string | null;
  lugar_trabajo?: string | null;
  dependencia_dir?: string | null;
  programa?: string | null;
  bono_movilizacion?: number | null;
  bono_colacion?: number | null;
  count?: number;
  tipo?: 'contrato' | 'anexo';
  contrato_origen_id?: string | null;
}

export interface Trabajador {
  rut: number; // PK
  dv: string;
  nombres: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  genero?: 'SR' | 'M' | 'F' | string;
  created_at?: string;
  nacionalidad?: string | null;
  estado_civil?: string | null;
  fecha_nac?: string | null;
  lugar_nac?: string | null;
  domicilio?: string | null;
  comuna?: string | null;
  prevision?: string | null;
  salud?: string | null;
  contratos?: Contrato[];
  num_contratos?: number;
}


export interface PlantillaContrato {
  id: string;
  nombre: string;
  programa: string;
  labores: string | null;
  lugar_trabajo: string | null;
  dependencia_dir: string | null;
  jornada: number | null;
  incluir_bonos: boolean;
  bono_movilizacion: number;
  bono_colacion: number;
  ciudad: string | null;
  iniciales_redactor: string | null;
  sueldo_sugerido: number;
  created_at?: string;
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
  trabajador_rut: number; // Cambio de trabajador_id a trabajador_rut
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
