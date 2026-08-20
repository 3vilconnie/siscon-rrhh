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
  /** 'biometrico' | 'libro' — método de control de asistencia (cláusula SEGUNDO). */
  control_asistencia?: string;
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
  control_asistencia?: string;
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
  /** Solo escribible con service role: el usuario no puede alterarlo desde el cliente. */
  app_metadata: {
    role?: string;
    /** RUT del trabajador asociado (sin DV); lo asigna un administrador. */
    rut?: number;
  };
  user_metadata?: { full_name?: string };
  banned_until?: string | null;
  created_at: string;
}

export type TipoLote = 'contrato' | 'anexo' | 'finiquito' | 'horas_extra';

/** Un lote generado (contratos, anexos o finiquitos masivos). */
export interface Lote {
  id: string;
  tipo: TipoLote;
  estado: 'generado' | 'anulado';
  cantidad: number;
  formato?: string | null;
  /** Configuración con la que se generó; permite reproducir el lote. */
  parametros: Record<string, unknown>;
  generado_por?: string | null;
  generado_en: string;
  anulado_por?: string | null;
  anulado_en?: string | null;
  motivo?: string | null;
  items?: LoteItem[];
}

/**
 * Un trabajador dentro del lote. Guarda los valores CALCULADOS al momento
 * de emitir, no referencias: si mañana cambia una fórmula, el lote sigue
 * mostrando lo que efectivamente se pagó.
 */
export interface LoteItem {
  id?: string;
  lote_id?: string;
  trabajador_rut: number;
  nombre_completo: string;
  fecha_inicio?: string | null;
  fecha_termino?: string | null;
  /** Sueldo base (contrato/anexo) o total a pagar (finiquito). */
  monto?: number | null;
  detalle?: Record<string, unknown>;
}

/** Parámetros del art. 159 N°4 inciso 5° (presunción de contrato indefinido). */
export interface ParametrosSistema {
  /** Marco temporal en meses (15 por ley). */
  ventana_meses: number;
  /** Meses de servicios acumulados que gatillan la presunción (12 por ley). */
  meses_acumulados: number;
  /** Contratos mínimos: «más de dos» ⇒ 3 por ley. */
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
