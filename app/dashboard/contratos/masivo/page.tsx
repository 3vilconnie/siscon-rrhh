'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  InputGroup,
  Badge,
  Alert,
  Nav,
  Modal,
  Spinner,
} from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import { calcularDV } from '@/lib/rut';
import { formatearRutFiniquito } from '@/lib/finiquito';
import { Trabajador, PlantillaContrato } from '@/types';
import {
  PROGRAMAS_CONTRATO,
  ESTADOS_CIVILES,
  AFP_OPCIONES,
  SALUD_OPCIONES,
  CONTROL_ASISTENCIA,
  fraseControlAsistencia,
  SIGPER_CONSTANTES,
  SIGPER_PROGRAMAS,
  SIGPER_TIPO_TRABAJADOR,
  SIGPER_ENCABEZADOS_DATOS_CARGA,
  SIGPER_ESTRUCTURA_CARGA,
  SIGPER_CODIGO_AGRUPACION,
  SIGPER_ENCABEZADOS_BONOS,
  SIGPER_ESTRUCTURA_BONOS,
  unidadLaboralSigperDesdeLugar,
  estadoCivilLabel,
  estadoCivilIdDesdeLabel,
  construirDatosContrato,
  contratoSugerido,
  datosContratoDesdeFilaExcel,
  type DatosContrato,
  type SigperTipoTrabajador,
} from '@/lib/contrato';

// --- TIPOS ---
type EdicionTrabajador = {
  genero: string;
  nacionalidad: string;
  estadoCivilId: string;
  lugarNac: string;
  fechaNac: string;
  domicilio: string;
  comuna: string;
  prevision: string;
  salud: string;
  sueldoBase: number;
  contratoOrigenId: string;
  sigperTipo: SigperTipoTrabajador;
};

const EDICION_VACIA: EdicionTrabajador = {
  genero: '',
  nacionalidad: 'Chilena',
  estadoCivilId: 'soltero',
  lugarNac: '',
  fechaNac: '',
  domicilio: '',
  comuna: '',
  prevision: '',
  salud: '',
  sueldoBase: 0,
  contratoOrigenId: '',
  sigperTipo: 'obrero',
};

interface FilaExcel {
  datos: DatosContrato;
  nombre: string;
  rut: number;
  incluir: boolean;
}

export default function ContratosMasivosPage() {
  const [activeTab, setActiveTab] = useState<'nativo' | 'excel'>('nativo');

  // --- Datos reales ---
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loadingTrabajadores, setLoadingTrabajadores] = useState(true);

  // Estados para el flujo Nativo
  const [currentStep, setCurrentStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRuts, setSelectedRuts] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Paginación del listado de selección (Paso 1)
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

  // Estados para el Modal de Edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRut, setEditingRut] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<EdicionTrabajador>(EDICION_VACIA);

  // Estados para el Modal de Nuevo Trabajador
  const [showNewWorkerModal, setShowNewWorkerModal] = useState(false);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [newWorker, setNewWorker] = useState({
    rut: '',
    nombres: '',
    primerApellido: '',
    segundoApellido: '',
    genero: '',
  });

  // El DV se calcula solo desde el cuerpo del RUT (módulo 11), no se digita.
  const dvNuevo = calcularDV(newWorker.rut);

  // Estado para la configuración transversal del contrato
  const [config, setConfig] = useState({
    programaId: PROGRAMAS_CONTRATO[0].id,
    fechaInicio: '',
    fechaTermino: '',
    labores: '',
    lugarTrabajo: '',
    dependenciaDirecta: '',
    controlAsistencia: 'biometrico' as string,
    jornada: 44,
    prevision: 'AFP Uno',
    salud: 'FONASA',
    incluirBonos: false,
    bonoMovilizacion: 0,
    bonoColacion: 0,
    sueldoDefault: 0,
    ciudad: 'Arica',
    fechaEmision: new Date().toISOString().split('T')[0],
    inicialesRedactor: '',
    esAnexo: false,
    exportarSigper: false,
    sigperProgramaId: SIGPER_PROGRAMAS[0].id,
    sigperUnidadLaboral: null as number | null,
  });

  // Overrides por trabajador (datos personales + sueldo)
  const [customData, setCustomData] = useState<Record<number, Partial<EdicionTrabajador>>>({});
  const [guardarEnBase, setGuardarEnBase] = useState(false);
  const [generando, setGenerando] = useState<'pdf' | 'docx' | null>(null);
  const [generandoSigper, setGenerandoSigper] = useState(false);
  const [generandoBonosSigper, setGenerandoBonosSigper] = useState(false);

  // Plantillas de contrato (moldes reutilizables)
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');

  // --- Estado del tab Excel ---
  const [filasExcel, setFilasExcel] = useState<FilaExcel[]>([]);
  const [nombreArchivoExcel, setNombreArchivoExcel] = useState('');
  const [generandoExcel, setGenerandoExcel] = useState<'pdf' | 'docx' | null>(null);

  // --- CARGA DE TRABAJADORES ---
  const cargarTrabajadores = async () => {
    const { data, error } = await supabase
      .from('trabajadores')
      .select(
        'rut, dv, nombres, primer_apellido, segundo_apellido, genero, nacionalidad, estado_civil, fecha_nac, lugar_nac, domicilio, comuna, prevision, salud, contratos(id, jornada, sueldo_base, fecha_inicio, fecha_termino, labores, lugar_trabajo, dependencia_dir, programa, bono_movilizacion, bono_colacion)',
      )
      .order('primer_apellido');
    if (error) {
      toast.error('Error al cargar los trabajadores.');
      console.error(error);
    }
    setTrabajadores((data as Trabajador[]) ?? []);
  };

  const cargarPlantillas = async () => {
    const { data, error } = await supabase
      .from('plantillas_contrato')
      .select('*')
      .order('nombre');
    if (error) {
      console.error(error);
      return;
    }
    setPlantillas((data as PlantillaContrato[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoadingTrabajadores(true);
      await Promise.all([cargarTrabajadores(), cargarPlantillas()]);
      setLoadingTrabajadores(false);
    })();
  }, []);

  const aplicarPlantilla = (id: string) => {
    setPlantillaSeleccionadaId(id);
    const p = plantillas.find((x) => x.id === id);
    if (!p) return;
    setConfig((prev) => ({
      ...prev,
      programaId: p.programa,
      labores: p.labores ?? '',
      lugarTrabajo: p.lugar_trabajo ?? '',
      dependenciaDirecta: p.dependencia_dir ?? '',
      controlAsistencia: p.control_asistencia ?? 'biometrico',
      jornada: p.jornada ?? prev.jornada,
      incluirBonos: p.incluir_bonos,
      bonoMovilizacion: p.bono_movilizacion,
      bonoColacion: p.bono_colacion,
      ciudad: p.ciudad ?? prev.ciudad,
      inicialesRedactor: p.iniciales_redactor ?? prev.inicialesRedactor,
      sueldoDefault: p.sueldo_sugerido,
    }));
  };

  // --- DERIVADOS Y FILTROS ---
  const trabajadoresFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return trabajadores;
    return trabajadores.filter((t) => {
      const nombre =
        `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido ?? ''}`.toLowerCase();
      return nombre.includes(q) || t.rut.toString().includes(q.replace(/\./g, ''));
    });
  }, [searchTerm, trabajadores]);

  const seleccionadosData = trabajadores.filter((t) => selectedRuts.has(t.rut));

  // --- PAGINACIÓN (PASO 1) ---
  // La selección vive en selectedRuts (por RUT), así que se mantiene intacta al
  // cambiar de página: seleccionadosData filtra sobre la lista completa, no sobre
  // la página visible.
  const totalRegistros = trabajadoresFiltrados.length;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceUltimoRegistro = paginaSegura * registrosPorPagina;
  const indicePrimerRegistro = indiceUltimoRegistro - registrosPorPagina;
  const trabajadoresPagina = trabajadoresFiltrados.slice(
    indicePrimerRegistro,
    indiceUltimoRegistro,
  );

  const buscar = (termino: string) => {
    setSearchTerm(termino);
    setPaginaActual(1);
  };

  // --- MANEJADORES DE SELECCIÓN ---
  const toggleSelection = (rut: number) => {
    const newSelection = new Set(selectedRuts);
    if (newSelection.has(rut)) newSelection.delete(rut);
    else newSelection.add(rut);
    setSelectedRuts(newSelection);
  };

  /** El check del encabezado actúa solo sobre la página visible (comportamiento
   *  predecible: marca lo que el usuario está viendo, no los 322 registros). */
  const paginaCompletaSeleccionada =
    trabajadoresPagina.length > 0 && trabajadoresPagina.every((t) => selectedRuts.has(t.rut));

  const selectAll = () => {
    const newSelection = new Set(selectedRuts);
    if (paginaCompletaSeleccionada) {
      trabajadoresPagina.forEach((t) => newSelection.delete(t.rut));
    } else {
      trabajadoresPagina.forEach((t) => newSelection.add(t.rut));
    }
    setSelectedRuts(newSelection);
  };

  const seleccionarTodosFiltrados = () => {
    setSelectedRuts(new Set(trabajadoresFiltrados.map((t) => t.rut)));
  };

  // --- MANEJADORES DE NUEVO TRABAJADOR ---
  const handleCloseNewWorkerModal = () => {
    setShowNewWorkerModal(false);
    setNewWorker({
      rut: '',
      nombres: '',
      primerApellido: '',
      segundoApellido: '',
      genero: '',
    });
  };

  /** Crea el trabajador en la base de inmediato y lo deja seleccionado. */
  const handleSaveNewWorker = async () => {
    const rutNumero = parseInt(newWorker.rut.replace(/\D/g, ''), 10) || 0;
    if (!rutNumero || !dvNuevo || !newWorker.nombres.trim() || !newWorker.primerApellido.trim()) {
      toast.error('Ingresa al menos el RUT, los nombres y el apellido paterno.');
      return;
    }
    if (trabajadores.some((t) => t.rut === rutNumero)) {
      toast.error('Ya existe un trabajador con ese RUT.');
      return;
    }

    const workerToAdd: Trabajador = {
      rut: rutNumero,
      dv: dvNuevo,
      nombres: newWorker.nombres.trim().toUpperCase(),
      primer_apellido: newWorker.primerApellido.trim().toUpperCase(),
      segundo_apellido: newWorker.segundoApellido.trim()
        ? newWorker.segundoApellido.trim().toUpperCase()
        : null,
      genero: newWorker.genero || undefined,
      contratos: [],
    };

    setGuardandoNuevo(true);
    const toastId = toast.loading('Registrando trabajador...');
    try {
      const { error } = await supabase.from('trabajadores').insert({
        rut: workerToAdd.rut,
        dv: workerToAdd.dv,
        nombres: workerToAdd.nombres,
        primer_apellido: workerToAdd.primer_apellido,
        segundo_apellido: workerToAdd.segundo_apellido,
        genero: newWorker.genero || null,
      });
      if (error) throw error;

      await registrarAuditoria(
        ACCIONES.CREAR_TRABAJADOR,
        `RUT ${workerToAdd.rut}-${workerToAdd.dv}: ${workerToAdd.nombres} ${workerToAdd.primer_apellido} ${workerToAdd.segundo_apellido ?? ''}`.trim(),
      );

      // Queda en la lista local (al inicio, para verlo de inmediato) y seleccionado.
      setTrabajadores((prev) => [workerToAdd, ...prev]);
      setPaginaActual(1);
      setSelectedRuts((prev) => new Set(prev).add(rutNumero));

      toast.success('Trabajador creado y seleccionado.', { id: toastId });
      handleCloseNewWorkerModal();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido.';
      toast.error(
        /duplicate|unique/i.test(msg)
          ? 'Ya existe un trabajador con ese RUT en la base.'
          : `No se pudo crear el trabajador: ${msg}`,
        { id: toastId, duration: 6000 },
      );
    } finally {
      setGuardandoNuevo(false);
    }
  };

  // --- MANEJADORES DE EDICIÓN (PASO 3) ---
  const handleOpenEditModal = (t: Trabajador) => {
    const c = contratoSugerido(t);
    const existente = customData[t.rut];
    setEditingRut(t.rut);
    setEditingForm({
      genero: existente?.genero ?? (t.genero === 'M' || t.genero === 'F' ? t.genero : ''),
      nacionalidad: existente?.nacionalidad ?? t.nacionalidad ?? 'Chilena',
      estadoCivilId: existente?.estadoCivilId ?? estadoCivilIdDesdeLabel(t.estado_civil),
      lugarNac: existente?.lugarNac ?? t.lugar_nac ?? '',
      fechaNac: existente?.fechaNac ?? t.fecha_nac ?? '',
      domicilio: existente?.domicilio ?? t.domicilio ?? '',
      comuna: existente?.comuna ?? t.comuna ?? '',
      prevision: existente?.prevision ?? t.prevision ?? config.prevision,
      salud: existente?.salud ?? t.salud ?? config.salud,
      sueldoBase: existente?.sueldoBase ?? c?.sueldo_base ?? config.sueldoDefault ?? 0,
      contratoOrigenId: existente?.contratoOrigenId ?? c?.id ?? '',
      sigperTipo: existente?.sigperTipo ?? 'obrero',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingRut(null);
  };

  const handleSaveWorkerChanges = () => {
    if (editingRut === null) return;
    setCustomData((prev) => ({ ...prev, [editingRut]: editingForm }));
    handleCloseEditModal();
  };

  // --- OTROS MANEJADORES ---
  const handleConfigChange = <K extends keyof typeof config>(field: K, value: (typeof config)[K]) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleLugarTrabajoChange = (lugarTrabajo: string) => {
    setConfig((prev) => ({
      ...prev,
      lugarTrabajo,
      sigperUnidadLaboral: unidadLaboralSigperDesdeLugar(lugarTrabajo) ?? prev.sigperUnidadLaboral,
    }));
  };

  const handleToggleExportarSigper = (exportarSigper: boolean) => {
    setConfig((prev) => ({
      ...prev,
      exportarSigper,
      sigperUnidadLaboral:
        prev.sigperUnidadLaboral ?? unidadLaboralSigperDesdeLugar(prev.lugarTrabajo),
    }));
  };

  const handleSueldoChange = (rut: number, sueldoBase: number) => {
    setCustomData((prev) => ({ ...prev, [rut]: { ...prev[rut], sueldoBase } }));
  };

  const handleContratoOrigenChange = (rut: number, contratoOrigenId: string) => {
    setCustomData((prev) => ({ ...prev, [rut]: { ...prev[rut], contratoOrigenId } }));
  };

  const handleSigperTipoChange = (rut: number, sigperTipo: SigperTipoTrabajador) => {
    setCustomData((prev) => ({ ...prev, [rut]: { ...prev[rut], sigperTipo } }));
  };

  // --- CONSTRUCCIÓN DE DATOS PARA CARBONE ---
  const sueldoDe = (t: Trabajador) =>
    customData[t.rut]?.sueldoBase ?? contratoSugerido(t)?.sueldo_base ?? config.sueldoDefault ?? 0;

  const previsionDe = (t: Trabajador) => customData[t.rut]?.prevision ?? t.prevision ?? config.prevision;
  const saludDe = (t: Trabajador) => customData[t.rut]?.salud ?? t.salud ?? config.salud;
  const contratoOrigenDe = (t: Trabajador) =>
    customData[t.rut]?.contratoOrigenId ?? contratoSugerido(t)?.id ?? '';
  const sigperTipoDe = (t: Trabajador): SigperTipoTrabajador =>
    customData[t.rut]?.sigperTipo ?? 'obrero';

  const identidadValida = (t: Trabajador) =>
    !!t.nombres?.trim() && !!t.primer_apellido?.trim() && t.rut > 0 && !!t.dv?.trim();

  const programaSeleccionado = PROGRAMAS_CONTRATO.find((p) => p.id === config.programaId);
  const plantillaAplicada = plantillas.find((p) => p.id === plantillaSeleccionadaId);

  const construirDatosPara = (t: Trabajador): DatosContrato => {
    const ov = customData[t.rut];
    const genero = ov?.genero || (t.genero === 'M' || t.genero === 'F' ? t.genero : undefined);
    return construirDatosContrato(
      {
        nombres: t.nombres,
        primer_apellido: t.primer_apellido,
        segundo_apellido: t.segundo_apellido,
        rut: t.rut,
        dv: t.dv,
        genero,
      },
      {
        ciudad: config.ciudad,
        fechaEmision: config.fechaEmision,
        redactorIniciales: config.inicialesRedactor,
        programaId: config.programaId,
        nacionalidad: ov?.nacionalidad ?? t.nacionalidad ?? 'Chilena',
        estadoCivil: estadoCivilLabel(
          ov?.estadoCivilId ?? estadoCivilIdDesdeLabel(t.estado_civil),
          genero,
        ),
        lugarNac: ov?.lugarNac ?? t.lugar_nac ?? '',
        fechaNac: ov?.fechaNac ?? t.fecha_nac ?? '',
        domicilio: ov?.domicilio ?? t.domicilio ?? '',
        comuna: ov?.comuna ?? t.comuna ?? '',
        labores: config.labores,
        lugarTrabajo: config.lugarTrabajo,
        dependenciaDir: config.dependenciaDirecta,
        controlAsistencia: config.controlAsistencia,
        prevision: ov?.prevision ?? t.prevision ?? config.prevision,
        salud: ov?.salud ?? t.salud ?? config.salud,
        bonoMovilizacion: config.incluirBonos ? config.bonoMovilizacion : 0,
        bonoColacion: config.incluirBonos ? config.bonoColacion : 0,
        incluirBonos: config.incluirBonos,
        inicioContrato: config.fechaInicio,
        terminoContrato: config.fechaTermino,
        sueldo: sueldoDe(t),
      },
    );
  };

  const puedeGenerar =
    seleccionadosData.length > 0 &&
    !!config.fechaInicio &&
    !!config.fechaTermino &&
    seleccionadosData.every(
      (t) =>
        identidadValida(t) &&
        sueldoDe(t) > 0 &&
        (!config.esAnexo || !!contratoOrigenDe(t)),
    );

  /** Guarda en la base los trabajadores nuevos y un contrato por cada seleccionado. */
  const guardarSeleccionEnBase = async (): Promise<boolean> => {
    for (const t of seleccionadosData) {
      const ov = customData[t.rut];
      const genero = ov?.genero || (t.genero === 'M' || t.genero === 'F' ? t.genero : undefined);
      const estadoCivil = estadoCivilLabel(
        ov?.estadoCivilId ?? estadoCivilIdDesdeLabel(t.estado_civil),
        genero,
      );

      // Todos los seleccionados ya existen en la base (vienen de ella, o se
      // crearon al momento desde el modal de "Nuevo Trabajador"), así que aquí
      // solo se actualizan los datos personales que se hayan editado.
      if (ov) {
        await supabase
          .from('trabajadores')
          .update({
            genero: genero || null,
            nacionalidad: ov.nacionalidad,
            estado_civil: estadoCivil,
            lugar_nac: ov.lugarNac || null,
            fecha_nac: ov.fechaNac || null,
            domicilio: ov.domicilio || null,
            comuna: ov.comuna || null,
            prevision: ov.prevision,
            salud: ov.salud,
          })
          .eq('rut', t.rut);
      }

      const { error: errC } = await supabase.from('contratos').insert({
        trabajador_rut: t.rut,
        jornada: config.jornada || 44,
        sueldo_base: sueldoDe(t),
        fecha_inicio: config.fechaInicio,
        fecha_termino: config.fechaTermino || null,
        labores: config.labores || null,
        lugar_trabajo: config.lugarTrabajo || null,
        dependencia_dir: config.dependenciaDirecta || null,
        control_asistencia: config.controlAsistencia,
        programa: config.programaId || null,
        bono_movilizacion: config.incluirBonos ? config.bonoMovilizacion : 0,
        bono_colacion: config.incluirBonos ? config.bonoColacion : 0,
        tipo: config.esAnexo ? 'anexo' : 'contrato',
        contrato_origen_id: config.esAnexo ? contratoOrigenDe(t) || null : null,
      });
      if (errC) {
        const msg = /exclusion/i.test(errC.message)
          ? `El período se superpone con otro contrato ya registrado para ${t.nombres}.`
          : errC.message;
        toast.error(`No se pudo guardar el contrato de ${t.nombres}: ${msg}`);
        return false;
      }
    }

    await registrarAuditoria(
      ACCIONES.CARGA_MASIVA,
      `Generación masiva de ${seleccionadosData.length} contrato(s), programa ${config.programaId}, ${config.fechaInicio} → ${config.fechaTermino}`,
    );
    await cargarTrabajadores();
    return true;
  };

  const descargarBlob = (blob: Blob, nombreArchivo: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (formato: 'pdf' | 'docx') => {
    if (!puedeGenerar) {
      toast.error('Completa la fecha de inicio, término y el sueldo de cada trabajador.');
      return;
    }

    setIsSubmitting(true);
    setGenerando(formato);
    const toastId = toast.loading(`Generando ${seleccionadosData.length} contratos...`);
    try {
      if (guardarEnBase) {
        const ok = await guardarSeleccionEnBase();
        if (!ok) {
          toast.dismiss(toastId);
          return;
        }
      }

      const documentos = seleccionadosData.map((t) => construirDatosPara(t));

      const res = await fetch('/api/contratos/generar-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, documentos }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      descargarBlob(blob, `contratos_masivo_${documentos.length}.${formato}`);
      toast.success(
        guardarEnBase
          ? 'Contratos generados y guardados en la base.'
          : `${documentos.length} contratos generados.`,
        { id: toastId },
      );
    } catch (error) {
      console.error('Error generando contratos:', error);
      toast.error(error instanceof Error ? error.message : 'Ocurrió un error al generar los documentos.', {
        id: toastId,
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
      setGenerando(null);
    }
  };

  // SIGPER espera fechas reales de Excel (no texto): si se escriben como string
  // "dd-mm-yyyy", Excel las deja como texto plano y ni Excel ni SIGPER las
  // reconocen como fecha hasta que alguien las "toca" a mano. Por eso se
  // calculan como serial de fecha de Excel (días desde 1899-12-30, igual que
  // ya hace parseFechaTexto en lib/contrato.ts para leer) y luego se les
  // aplica el formato de despliegue "dd-mm-yyyy" directamente sobre la celda.
  const fechaExcelSerial = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  };

  /** Primer día del mes de una fecha ISO — el "inicio de pago" del bono es siempre
   *  el 1 del mes en que empieza el contrato, no la fecha exacta de contratación. */
  const primerDiaDelMesSigper = (iso: string) => {
    const [y, m] = iso.split('-');
    return fechaExcelSerial(`${y}-${m}-01`);
  };

  /** Día siguiente a una fecha ISO — la "Fecha Inicio Prox. Pago" del bienio es
   *  siempre el día después de que termina el contrato. */
  const diaSiguienteSigper = (iso: string) => fechaExcelSerial(iso) + 1;

  /** Marca como fecha (dd-mm-yyyy) las celdas de las columnas dadas, filas 2..N+1 (bajo el encabezado). */
  const aplicarFormatoFechaSigper = (ws: XLSX.WorkSheet, columnas: string[], totalFilas: number) => {
    for (const col of columnas) {
      for (let fila = 2; fila <= totalFilas + 1; fila++) {
        const celda = ws[`${col}${fila}`];
        if (celda) celda.z = 'dd-mm-yyyy';
      }
    }
  };

  const exportarSigper = () => {
    if (!config.sigperProgramaId) {
      toast.error('Selecciona el Programa SIGPER.');
      return;
    }
    if (!config.sigperUnidadLaboral) {
      toast.error('Indica la Unidad laboral SIGPER.');
      return;
    }
    if (!config.fechaInicio || !config.fechaTermino) {
      toast.error('Completa la fecha de inicio y término.');
      return;
    }
    if (seleccionadosData.some((t) => sueldoDe(t) <= 0)) {
      toast.error('Indica el sueldo de cada trabajador.');
      return;
    }

    setGenerandoSigper(true);
    try {
      const proyecto = SIGPER_PROGRAMAS.find((p) => p.id === config.sigperProgramaId)!.proyecto;

      const filas = seleccionadosData.map((t) => {
        const tipo = SIGPER_TIPO_TRABAJADOR[sigperTipoDe(t)];
        return [
          t.rut,
          tipo.escalafon,
          SIGPER_CONSTANTES.escalafonDipres,
          tipo.cargoLegal,
          config.jornada,
          config.sigperUnidadLaboral,
          SIGPER_CONSTANTES.seccion,
          proyecto,
          SIGPER_CONSTANTES.fuenteFinanciamiento,
          SIGPER_CONSTANTES.programaPresupuestario,
          SIGPER_CONSTANTES.programa,
          SIGPER_CONSTANTES.subPrograma,
          SIGPER_CONSTANTES.tarea,
          SIGPER_CONSTANTES.actividad,
          fechaExcelSerial(config.fechaInicio),
          fechaExcelSerial(config.fechaTermino),
          sueldoDe(t),
        ];
      });

      const wsDatos = XLSX.utils.aoa_to_sheet([SIGPER_ENCABEZADOS_DATOS_CARGA, ...filas]);
      wsDatos['!cols'] = SIGPER_ENCABEZADOS_DATOS_CARGA.map(() => ({ wch: 16 }));
      aplicarFormatoFechaSigper(wsDatos, ['O', 'P'], filas.length);
      const wsEstructura = XLSX.utils.aoa_to_sheet(SIGPER_ESTRUCTURA_CARGA);
      wsEstructura['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos carga');
      XLSX.utils.book_append_sheet(wb, wsEstructura, 'Estructura carga');
      XLSX.writeFile(wb, `sigper_carga_${config.sigperProgramaId}_${filas.length}.xlsx`);

      toast.success(`Archivo SIGPER generado (${filas.length} trabajadores).`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo generar el archivo SIGPER.',
      );
    } finally {
      setGenerandoSigper(false);
    }
  };

  const exportarBonosSigper = () => {
    if (!config.incluirBonos || (config.bonoMovilizacion <= 0 && config.bonoColacion <= 0)) {
      toast.error('No hay bonos configurados en el Paso 2.');
      return;
    }
    if (!config.fechaInicio || !config.fechaTermino) {
      toast.error('Completa la fecha de inicio y término.');
      return;
    }

    setGenerandoBonosSigper(true);
    try {
      const inicio = primerDiaDelMesSigper(config.fechaInicio);
      const termino = fechaExcelSerial(config.fechaTermino);
      const proximoBienio = diaSiguienteSigper(config.fechaTermino);

      const filas: (string | number)[][] = [];
      for (const t of seleccionadosData) {
        if (config.bonoColacion > 0) {
          filas.push([
            t.rut,
            SIGPER_CODIGO_AGRUPACION.colacion,
            '',
            inicio,
            termino,
            config.bonoColacion,
            '',
            proximoBienio,
            'N',
            0,
          ]);
        }
        if (config.bonoMovilizacion > 0) {
          filas.push([
            t.rut,
            SIGPER_CODIGO_AGRUPACION.movilizacion,
            '',
            inicio,
            termino,
            config.bonoMovilizacion,
            '',
            proximoBienio,
            'N',
            0,
          ]);
        }
      }

      if (filas.length === 0) {
        toast.error('No hay bonos configurados en el Paso 2.');
        return;
      }

      const wsDatos = XLSX.utils.aoa_to_sheet([SIGPER_ENCABEZADOS_BONOS, ...filas]);
      wsDatos['!cols'] = SIGPER_ENCABEZADOS_BONOS.map(() => ({ wch: 16 }));
      aplicarFormatoFechaSigper(wsDatos, ['D', 'E', 'H'], filas.length);
      const wsEstructura = XLSX.utils.aoa_to_sheet(SIGPER_ESTRUCTURA_BONOS);
      wsEstructura['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsDatos, 'DATOS');
      XLSX.utils.book_append_sheet(wb, wsEstructura, 'ESTRUCTURA');
      XLSX.writeFile(wb, `sigper_bonos_${filas.length}.xls`, { bookType: 'biff8' });

      toast.success(`Voucher de bonos SIGPER generado (${filas.length} filas).`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo generar el voucher de bonos.',
      );
    } finally {
      setGenerandoBonosSigper(false);
    }
  };

  // --- TAB EXCEL ---
  const procesarArchivoExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const hoja =
        wb.SheetNames.find((n) => n.toUpperCase().includes('TRABAJADOR')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[hoja];
      const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
        raw: false,
      });

      const parsed: FilaExcel[] = [];
      for (const cruda of filasCrudas) {
        const r = datosContratoDesdeFilaExcel(cruda);
        if (r) parsed.push({ datos: r.datos, nombre: r.nombre, rut: r.rut, incluir: r.seleccion });
      }

      if (parsed.length === 0) {
        toast.error('No se encontraron filas con RUT válido en la planilla.');
        return;
      }
      setFilasExcel(parsed);
      setNombreArchivoExcel(file.name);
      toast.success(`${parsed.length} trabajador(es) leídos de la planilla.`);
    } catch (err) {
      toast.error(`No se pudo leer la planilla: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const toggleFilaExcel = (rut: number) =>
    setFilasExcel((prev) => prev.map((f) => (f.rut === rut ? { ...f, incluir: !f.incluir } : f)));
  const marcarTodasExcel = (v: boolean) =>
    setFilasExcel((prev) => prev.map((f) => ({ ...f, incluir: v })));

  const seleccionadasExcel = filasExcel.filter((f) => f.incluir);

  const descargarPlantillaExcel = () => {
    const headers = [
      'INICIALES', 'FECHA_EMIS', 'CABECERA', 'NOMBRE', 'APELLIDO P', 'APELLIDO M', 'GENERO',
      'RUT', 'DV', 'NACIONALIDAD', 'ESTADO CIVIL', 'LUGAR NAC', 'FECHA NAC', 'DOMICILIO', 'COMUNA',
      'INICIO_CONT', 'TERMINO_CONT', 'LABORES', 'PROGRAMA', 'LUGAR_TRAB', 'DEPENDENCIA_DIR',
      'SUELDO', 'PREVISION', 'SALUD', 'BONO_MOV', 'BONO_COL', 'SELECCION',
    ];
    const ejemplo = [
      'crh', '2026-07-06', 'PZD3', 'SALOMÉ', 'Reyes', 'Vejar', 'F', '15342828', 'K', 'Chilena',
      'Soltera', 'Universidad, Santiago', '1983-11-24', "O'Higgins SN", 'Putre', '2026-04-01',
      '2026-08-31', 'Anfitriona Turística',
      'Transferencia, capacitación y generación de empleos verdes en la Reserva Biosfera Lauca',
      'Putre', 'la gestora de Proyecto la Srta. Paula Díaz', '700000', 'AFP HABITAT', 'VIDATRES',
      '0', '0', 'SI',
    ];
    const wsT = XLSX.utils.aoa_to_sheet([headers, ejemplo]);
    wsT['!cols'] = headers.map(() => ({ wch: 18 }));

    const instrucciones = [
      ['Columna', 'Descripción', 'Valores / formato'],
      ['INICIALES', 'Iniciales del redactor', 'ej. crh'],
      ['FECHA_EMIS', 'Fecha de emisión', 'AAAA-MM-DD'],
      ['CABECERA', 'Programa / proyecto', 'PZD1, PZD3 o CONADI'],
      ['NOMBRE / APELLIDO P / APELLIDO M', 'Identidad del trabajador', ''],
      ['GENERO', 'Género', 'M o F'],
      ['RUT / DV', 'RUT sin puntos y dígito verificador', 'ej. 15342828 / K'],
      ['NACIONALIDAD, ESTADO CIVIL, LUGAR NAC, DOMICILIO, COMUNA', 'Datos personales', ''],
      ['FECHA NAC', 'Fecha de nacimiento', 'AAAA-MM-DD'],
      ['INICIO_CONT / TERMINO_CONT', 'Vigencia del contrato', 'AAAA-MM-DD'],
      ['LABORES', 'Labores del trabajador', 'ej. Jornal'],
      ['PROGRAMA', 'Nombre del programa (cláusula PRIMERO)', ''],
      ['LUGAR_TRAB', 'Comuna del lugar de trabajo', ''],
      ['DEPENDENCIA_DIR', 'Dependencia directa', 'ej. la coordinadora del proyecto ...'],
      ['SUELDO', 'Sueldo bruto mensual', 'solo números, ej. 700000'],
      ['PREVISION / SALUD', 'AFP y sistema de salud', 'ej. AFP HABITAT / FONASA'],
      ['BONO_MOV / BONO_COL', 'Bonos de movilización y colación', 'solo números; 0 en ambos omite la cláusula de bonos'],
      ['SELECCION', 'Incluir en la generación', 'SI o vacío = incluir; NO = omitir'],
    ];
    const wsI = XLSX.utils.aoa_to_sheet(instrucciones);
    wsI['!cols'] = [{ wch: 48 }, { wch: 42 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsT, 'TRABAJADORES');
    XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');
    XLSX.writeFile(wb, 'plantilla_contratos.xlsx');
  };

  const generarExcel = async (formato: 'pdf' | 'docx') => {
    if (seleccionadasExcel.length === 0) {
      toast.error('Selecciona al menos un trabajador.');
      return;
    }

    setGenerandoExcel(formato);
    const toastId = toast.loading(`Generando ${seleccionadasExcel.length} contratos...`);
    try {
      const res = await fetch('/api/contratos/generar-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, documentos: seleccionadasExcel.map((f) => f.datos) }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      descargarBlob(blob, `contratos_${seleccionadasExcel.length}.${formato}`);
      toast.success('Documento generado.', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar.', {
        id: toastId,
        duration: 6000,
      });
    } finally {
      setGenerandoExcel(null);
    }
  };

  return (
    <Container className="py-4 max-w-6xl relative">
      {/* --- ENCABEZADO --- */}
      <div className="mb-3">
        <Link
          href="/dashboard/contratos"
          className="text-decoration-none small text-secondary"
        >
          <i className="bi bi-arrow-left me-1"></i> Volver a Contratos
        </Link>
      </div>
      <div className="mb-4">
        <h2 className="fw-bolder text-dark mb-1">Contratos Masivos</h2>
        <p className="text-muted">
          Genera múltiples documentos ágilmente definiendo los datos transversales del contrato.
        </p>
      </div>

      {/* --- SELECTOR DE PESTAÑAS --- */}
      <div className="mb-4 d-inline-block bg-light p-1 rounded border">
        <Nav variant="pills" className="flex-row">
          <Nav.Item>
            <Nav.Link
              className={`fw-semibold px-4 ${activeTab === 'nativo' ? 'bg-white text-primary shadow-sm border' : 'text-secondary'}`}
              onClick={() => setActiveTab('nativo')}
              active={activeTab === 'nativo'}
            >
              <i className="bi bi-people-fill me-2"></i>Base de Datos
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              className={`fw-semibold px-4 ${activeTab === 'excel' ? 'bg-white text-success shadow-sm border' : 'text-secondary'}`}
              onClick={() => setActiveTab('excel')}
              active={activeTab === 'excel'}
            >
              <i className="bi bi-file-earmark-excel-fill me-2"></i>Importar Excel
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </div>

      {/* --- CONTENIDO TAB: NATIVO --- */}
      {activeTab === 'nativo' && (
        <Card className="shadow-sm border-0 rounded-4">
          <Card.Body className="p-4 p-md-5">
            {/* Stepper Visual */}
            <div
              className="d-flex align-items-center justify-content-between mb-5 pb-3 border-bottom mx-auto"
              style={{ maxWidth: '800px' }}
            >
              {[
                { num: 1, label: 'Seleccionar Trabajadores' },
                { num: 2, label: 'Detalles del Contrato' },
                { num: 3, label: 'Validar y Generar' },
              ].map((step, idx) => {
                const isActive = currentStep === step.num;
                const isCompleted = currentStep > step.num;

                return (
                  <React.Fragment key={step.num}>
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center fw-bold border border-2
                          ${
                            isActive
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : isCompleted
                                ? 'border-primary bg-primary-subtle text-primary'
                                : 'border-light bg-light text-secondary'
                          }`}
                        style={{ width: '40px', height: '40px', flexShrink: 0 }}
                      >
                        {isCompleted ? <i className="bi bi-check-lg fs-5"></i> : step.num}
                      </div>
                      <span
                        className={`d-none d-md-block fw-semibold ${isActive ? 'text-dark' : isCompleted ? 'text-secondary' : 'text-muted'}`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div
                        className={`flex-grow-1 mx-3 rounded ${isCompleted ? 'bg-primary' : 'bg-light'}`}
                        style={{ height: '4px' }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* PASO 1: Selección */}
            {currentStep === 1 && (
              <div className="fade-in">
                <Row className="mb-4 align-items-center justify-content-between">
                  <Col md={5} lg={4}>
                    <InputGroup>
                      <InputGroup.Text className="bg-white text-muted">
                        <i className="bi bi-search"></i>
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Buscar por nombre o RUT..."
                        value={searchTerm}
                        onChange={(e) => buscar(e.target.value)}
                        className="border-start-0 ps-0"
                      />
                    </InputGroup>
                  </Col>

                  {/* Botones de acción Paso 1 */}
                  <Col xs="auto" className="mt-3 mt-md-0 d-flex gap-2 align-items-center">
                    <Button
                      variant="primary"
                      onClick={() => setShowNewWorkerModal(true)}
                      className="fw-semibold shadow-sm d-flex align-items-center"
                    >
                      <i className="bi bi-person-plus-fill me-2 fs-5"></i> Nuevo Trabajador
                    </Button>

                    {selectedRuts.size > 0 && (
                      <Badge
                        bg="primary-subtle"
                        text="primary"
                        className="px-3 py-2 fs-6 border border-primary-subtle ms-2 d-flex align-items-center"
                      >
                        <i className="bi bi-check2-square me-2"></i>
                        {selectedRuts.size} seleccionados
                      </Badge>
                    )}
                  </Col>
                </Row>

                {/* Resumen de paginación + tamaño de página */}
                <div className="d-flex justify-content-between align-items-center mb-2 small text-muted flex-wrap gap-2">
                  <div>
                    Mostrando{' '}
                    <strong>{totalRegistros === 0 ? 0 : indicePrimerRegistro + 1}</strong> al{' '}
                    <strong>{Math.min(indiceUltimoRegistro, totalRegistros)}</strong> de{' '}
                    <strong>{totalRegistros}</strong> trabajadores.
                    {totalRegistros > trabajadoresPagina.length && (
                      <>
                        {' · '}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 align-baseline text-decoration-none small"
                          onClick={seleccionarTodosFiltrados}
                        >
                          Seleccionar los {totalRegistros}
                        </Button>
                      </>
                    )}
                    {selectedRuts.size > 0 && (
                      <>
                        {' · '}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 align-baseline text-decoration-none small text-secondary"
                          onClick={() => setSelectedRuts(new Set())}
                        >
                          Limpiar selección
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span>Mostrar:</span>
                    <Form.Select
                      size="sm"
                      className="shadow-sm"
                      style={{ width: '80px' }}
                      value={registrosPorPagina}
                      onChange={(e) => {
                        setRegistrosPorPagina(parseInt(e.target.value));
                        setPaginaActual(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </Form.Select>
                  </div>
                </div>

                <div className="border rounded overflow-hidden shadow-sm">
                  <Table responsive hover className="mb-0 align-middle">
                    <thead
                      className="bg-light text-secondary text-uppercase"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <tr>
                        <th className="text-center" style={{ width: '50px' }}>
                          <Form.Check
                            onChange={selectAll}
                            checked={paginaCompletaSeleccionada}
                            title="Seleccionar los trabajadores de esta página"
                          />
                        </th>
                        <th>RUT</th>
                        <th>Nombre Completo</th>
                        <th>Género</th>
                        <th>Contratos</th>
                      </tr>
                    </thead>
                    <tbody className="border-top-0">
                      {loadingTrabajadores ? (
                        <tr>
                          <td colSpan={5} className="text-center p-5 text-muted">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Cargando trabajadores...
                          </td>
                        </tr>
                      ) : trabajadoresFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center p-5 text-muted">
                            No se encontraron trabajadores con ese criterio.
                          </td>
                        </tr>
                      ) : (
                        trabajadoresPagina.map((t) => (
                          <tr key={t.rut}>
                            <td className="text-center">
                              <Form.Check
                                checked={selectedRuts.has(t.rut)}
                                onChange={() => toggleSelection(t.rut)}
                              />
                            </td>
                            <td className="font-monospace text-muted small">
                              {formatearRutFiniquito(t.rut, t.dv)}
                            </td>
                            <td className="fw-semibold text-dark text-uppercase">
                              {t.nombres} {t.primer_apellido} {t.segundo_apellido ?? ''}
                            </td>
                            <td className="text-secondary">
                              {t.genero === 'F' ? 'Femenino' : t.genero === 'M' ? 'Masculino' : '—'}
                            </td>
                            <td>
                              <Badge bg="light" text="dark" className="border fw-normal">
                                {t.contratos?.length ?? 0}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                <div className="mt-3">
                  <Pagination
                    paginaActual={paginaSegura}
                    totalPaginas={totalPaginas}
                    onPaginaChange={(numero) => setPaginaActual(numero)}
                  />
                </div>
              </div>
            )}

            {/* PASO 2: Configuración del Contrato */}
            {currentStep === 2 && (
              <div className="fade-in py-2 mx-auto" style={{ maxWidth: '850px' }}>
                <Card className="bg-light border-0 shadow-sm">
                  <Card.Body className="p-4 p-md-5">
                    <h5 className="fw-bold mb-4 text-primary">
                      <i className="bi bi-card-text me-2"></i>Detalle del Contrato
                    </h5>

                    <div className="bg-white border border-primary-subtle rounded p-3 mb-4">
                      <Form.Label className="fw-semibold text-secondary small mb-1">
                        <i className="bi bi-file-earmark-ruled me-1"></i>Cargar desde plantilla
                      </Form.Label>
                      <Form.Select
                        value={plantillaSeleccionadaId}
                        onChange={(e) => aplicarPlantilla(e.target.value)}
                      >
                        <option value="">— Rellenar manualmente —</option>
                        {plantillas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </Form.Select>
                      {plantillas.length === 0 && (
                        <Form.Text className="text-muted">
                          Aún no tienes plantillas guardadas.{' '}
                          <Link href="/dashboard/contratos/plantillas">Crea una aquí</Link>.
                        </Form.Text>
                      )}
                    </div>

                    <div className="bg-white border rounded p-3 mb-4">
                      <Form.Check
                        type="switch"
                        id="es-anexo-masivo"
                        checked={config.esAnexo}
                        onChange={(e) => handleConfigChange('esAnexo', e.target.checked)}
                        label="Estos son Anexos de Ampliación de contratos existentes (no contratos nuevos)"
                      />
                      {config.esAnexo && (
                        <div className="text-muted small mt-1">
                          En el Paso 3 elegirás, para cada trabajador, cuál de sus contratos se
                          está ampliando.
                        </div>
                      )}
                    </div>

                    <div className="bg-white border rounded p-3 mb-4">
                      <Form.Check
                        type="switch"
                        id="exportar-sigper-masivo"
                        checked={config.exportarSigper}
                        onChange={(e) => handleToggleExportarSigper(e.target.checked)}
                        label="Exportar a SIGPER (carga masiva de personal)"
                      />
                      {config.exportarSigper && (
                        <Row className="g-3 mt-1">
                          <Col md={6}>
                            <Form.Label className="fw-semibold text-secondary small mb-1">
                              Programa SIGPER
                            </Form.Label>
                            <Form.Select
                              value={config.sigperProgramaId}
                              onChange={(e) => handleConfigChange('sigperProgramaId', e.target.value)}
                            >
                              {SIGPER_PROGRAMAS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.etiqueta}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={6}>
                            <Form.Label className="fw-semibold text-secondary small mb-1">
                              Unidad laboral SIGPER
                            </Form.Label>
                            <Form.Control
                              type="number"
                              value={config.sigperUnidadLaboral ?? ''}
                              onChange={(e) =>
                                handleConfigChange(
                                  'sigperUnidadLaboral',
                                  e.target.value ? Number(e.target.value) : null,
                                )
                              }
                              placeholder="Ej: 11504"
                            />
                            <Form.Text className="text-muted">
                              Se sugiere automáticamente desde el &quot;Lugar de trabajo&quot;
                              (Arica / Putre); ajústala si corresponde a otra oficina.
                            </Form.Text>
                          </Col>
                          <Col xs={12}>
                            <div className="text-muted small">
                              En el Paso 3 indicarás, para cada trabajador, si es Obrero o
                              Profesional (define su Cargo legal y Escalafón SIGPER).
                            </div>
                          </Col>
                        </Row>
                      )}
                    </div>

                    <Row className="g-3 mb-4">
                      <Col md={12}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Programa / Proyecto (cabecera)
                          </Form.Label>
                          <Form.Select
                            value={config.programaId}
                            onChange={(e) => handleConfigChange('programaId', e.target.value)}
                          >
                            {PROGRAMAS_CONTRATO.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.etiqueta}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row className="g-3 mb-4">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Labores
                          </Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Ej: Jornal"
                            value={config.labores}
                            onChange={(e) => handleConfigChange('labores', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Lugar de trabajo (comuna)
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={config.lugarTrabajo}
                            onChange={(e) => handleLugarTrabajoChange(e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row className="g-3 mb-4">
                      <Col md={12}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Dependencia directa
                          </Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Ej: la coordinadora del proyecto ..."
                            value={config.dependenciaDirecta}
                            onChange={(e) =>
                              handleConfigChange('dependenciaDirecta', e.target.value)
                            }
                          />
                        </Form.Group>
                      </Col>
                      <Col md={12}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Control de asistencia
                          </Form.Label>
                          <div className="d-flex flex-wrap gap-4">
                            {CONTROL_ASISTENCIA.map((opcion) => (
                              <Form.Check
                                key={opcion.id}
                                type="radio"
                                id={`control-asistencia-masivo-${opcion.id}`}
                                name="controlAsistenciaMasivo"
                                label={opcion.etiqueta}
                                checked={config.controlAsistencia === opcion.id}
                                onChange={() => handleConfigChange('controlAsistencia', opcion.id)}
                              />
                            ))}
                          </div>
                          <Form.Text className="text-muted">
                            En el contrato se redactará: «...a través de{' '}
                            {fraseControlAsistencia(config.controlAsistencia)}.»
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row className="g-3 mb-4">
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Jornada (h)
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={config.jornada}
                            onChange={(e) => handleConfigChange('jornada', Number(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Previsión (por defecto)
                          </Form.Label>
                          <Form.Select
                            value={config.prevision}
                            onChange={(e) => handleConfigChange('prevision', e.target.value)}
                          >
                            {AFP_OPCIONES.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Salud (por defecto)
                          </Form.Label>
                          <Form.Select
                            value={config.salud}
                            onChange={(e) => handleConfigChange('salud', e.target.value)}
                          >
                            {SALUD_OPCIONES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>

                    <div className="bg-white p-3 rounded border mb-4">
                      <Form.Check
                        type="checkbox"
                        id="check-bonos"
                        label="Incluir bonos de movilización y colación (cláusula NOVENO)"
                        className="fw-semibold text-dark mb-3"
                        checked={config.incluirBonos}
                        onChange={(e) => handleConfigChange('incluirBonos', e.target.checked)}
                      />

                      <Row className="g-3">
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="fw-semibold text-secondary small mb-1">
                              Bono movilización
                            </Form.Label>
                            <InputGroup>
                              <InputGroup.Text
                                className={
                                  !config.incluirBonos ? 'bg-light text-muted border-light' : ''
                                }
                              >
                                $
                              </InputGroup.Text>
                              <Form.Control
                                type="number"
                                disabled={!config.incluirBonos}
                                value={config.bonoMovilizacion}
                                onChange={(e) =>
                                  handleConfigChange('bonoMovilizacion', Number(e.target.value))
                                }
                                className={!config.incluirBonos ? 'bg-light border-light' : ''}
                              />
                            </InputGroup>
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="fw-semibold text-secondary small mb-1">
                              Bono colación
                            </Form.Label>
                            <InputGroup>
                              <InputGroup.Text
                                className={
                                  !config.incluirBonos ? 'bg-light text-muted border-light' : ''
                                }
                              >
                                $
                              </InputGroup.Text>
                              <Form.Control
                                type="number"
                                disabled={!config.incluirBonos}
                                value={config.bonoColacion}
                                onChange={(e) =>
                                  handleConfigChange('bonoColacion', Number(e.target.value))
                                }
                                className={!config.incluirBonos ? 'bg-light border-light' : ''}
                              />
                            </InputGroup>
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="fw-semibold text-secondary small mb-1">
                              Ciudad
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={config.ciudad}
                              onChange={(e) => handleConfigChange('ciudad', e.target.value)}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>

                    <Row className="g-3 mb-4">
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Fecha de inicio
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={config.fechaInicio}
                            onChange={(e) => handleConfigChange('fechaInicio', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Fecha de término
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={config.fechaTermino}
                            onChange={(e) => handleConfigChange('fechaTermino', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Sueldo base (referencial)
                          </Form.Label>
                          <InputGroup>
                            <InputGroup.Text>$</InputGroup.Text>
                            <Form.Control
                              type="number"
                              value={config.sueldoDefault || ''}
                              onChange={(e) =>
                                handleConfigChange('sueldoDefault', Number(e.target.value) || 0)
                              }
                            />
                          </InputGroup>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Fecha emisión
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={config.fechaEmision}
                            onChange={(e) => handleConfigChange('fechaEmision', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-semibold text-secondary small mb-1">
                            Iniciales redactor
                          </Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Ej: crh"
                            value={config.inicialesRedactor}
                            onChange={(e) =>
                              handleConfigChange('inicialesRedactor', e.target.value)
                            }
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </div>
            )}

            {/* PASO 3: Previsualización */}
            {currentStep === 3 && (
              <div className="fade-in">
                <Alert
                  variant="info"
                  className="d-flex align-items-center border-info-subtle shadow-sm"
                >
                  <i className="bi bi-info-circle-fill fs-4 me-3 text-info"></i>
                  <div>
                    Generarás <strong>{selectedRuts.size} contratos</strong> con los datos
                    transversales configurados. Si necesitas ajustar el <strong>sueldo base</strong>{' '}
                    de algún trabajador o <strong>editar sus datos personales</strong>, hazlo en la
                    tabla a continuación.
                  </div>
                </Alert>

                <div className="bg-white border rounded p-3 mt-3 d-flex flex-wrap gap-4">
                  <div>
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Programa</div>
                    <div className="fw-semibold text-dark">
                      {programaSeleccionado?.etiqueta ?? config.programaId}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Plantilla</div>
                    <div className="fw-semibold text-dark">
                      {plantillaAplicada ? (
                        <Badge bg="primary-subtle" text="primary" className="border fw-normal">
                          <i className="bi bi-file-earmark-ruled me-1"></i>
                          {plantillaAplicada.nombre}
                        </Badge>
                      ) : (
                        <span className="text-muted">Ninguna (datos rellenados manualmente)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Bonos</div>
                    <div className="fw-semibold text-dark">
                      {config.incluirBonos ? (
                        <>
                          Movilización ${config.bonoMovilizacion.toLocaleString('es-CL')} · Colación $
                          {config.bonoColacion.toLocaleString('es-CL')}
                        </>
                      ) : (
                        <span className="text-muted">No incluye bonos</span>
                      )}
                    </div>
                  </div>
                  {config.esAnexo && (
                    <div>
                      <div className="text-muted text-uppercase small fw-semibold mb-1">Tipo</div>
                      <Badge bg="info-subtle" text="info" className="border fw-normal">
                        <i className="bi bi-file-earmark-plus me-1"></i>Anexo de Ampliación
                      </Badge>
                    </div>
                  )}
                  {config.exportarSigper && (
                    <div>
                      <div className="text-muted text-uppercase small fw-semibold mb-1">SIGPER</div>
                      <Badge bg="primary-subtle" text="primary" className="border fw-normal">
                        <i className="bi bi-cloud-arrow-up me-1"></i>
                        {SIGPER_PROGRAMAS.find((p) => p.id === config.sigperProgramaId)?.etiqueta}
                        {' · Unidad '}
                        {config.sigperUnidadLaboral ?? '—'}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="border rounded overflow-hidden shadow-sm mt-4">
                  <Table responsive hover className="mb-0 align-middle">
                    <thead
                      className="bg-light text-secondary text-uppercase"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <tr>
                        <th>Trabajador</th>
                        <th>RUT</th>
                        <th>Datos personales</th>
                        <th>Previsión / Salud</th>
                        {config.esAnexo && <th style={{ minWidth: '220px' }}>Contrato a ampliar</th>}
                        {config.exportarSigper && <th style={{ minWidth: '160px' }}>Tipo SIGPER</th>}
                        <th style={{ minWidth: '200px' }}>
                          Sueldo Base{' '}
                          <span className="text-primary text-lowercase">(Editable individual)</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="border-top-0">
                      {seleccionadosData.map((t) => {
                        const completo = identidadValida(t);
                        return (
                          <tr key={t.rut}>
                            <td>
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="fw-semibold text-dark text-uppercase">
                                  {t.nombres} {t.primer_apellido} {t.segundo_apellido ?? ''}
                                </div>
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="text-primary rounded-circle ms-2"
                                  title="Editar datos personales"
                                  onClick={() => handleOpenEditModal(t)}
                                >
                                  <i className="bi bi-pencil-square"></i>
                                </Button>
                              </div>
                            </td>
                            <td className="font-monospace text-muted small">
                              {formatearRutFiniquito(t.rut, t.dv)}
                            </td>
                            <td>
                              {completo ? (
                                <Badge bg="success-subtle" text="success" className="border fw-normal">
                                  <i className="bi bi-check-circle me-1"></i>Completo
                                </Badge>
                              ) : (
                                <Badge bg="warning-subtle" text="warning" className="border fw-normal">
                                  <i className="bi bi-exclamation-triangle me-1"></i>Revisar
                                </Badge>
                              )}
                            </td>
                            <td className="text-secondary small">
                              {previsionDe(t) || '—'} / {saludDe(t) || '—'}
                            </td>
                            {config.esAnexo && (
                              <td>
                                {(t.contratos ?? []).length === 0 ? (
                                  <Badge bg="warning-subtle" text="warning" className="border fw-normal">
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    Sin contratos previos
                                  </Badge>
                                ) : (
                                  <Form.Select
                                    size="sm"
                                    value={contratoOrigenDe(t)}
                                    onChange={(e) => handleContratoOrigenChange(t.rut, e.target.value)}
                                  >
                                    {[...(t.contratos ?? [])]
                                      .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
                                      .map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {new Date(c.fecha_inicio).toLocaleDateString('es-CL')} →{' '}
                                          {c.fecha_termino
                                            ? new Date(c.fecha_termino).toLocaleDateString('es-CL')
                                            : 'Indefinido'}
                                        </option>
                                      ))}
                                  </Form.Select>
                                )}
                              </td>
                            )}
                            {config.exportarSigper && (
                              <td>
                                <Form.Select
                                  size="sm"
                                  value={sigperTipoDe(t)}
                                  onChange={(e) =>
                                    handleSigperTipoChange(
                                      t.rut,
                                      e.target.value as SigperTipoTrabajador,
                                    )
                                  }
                                >
                                  {Object.entries(SIGPER_TIPO_TRABAJADOR).map(([key, v]) => (
                                    <option key={key} value={key}>
                                      {v.etiqueta}
                                    </option>
                                  ))}
                                </Form.Select>
                              </td>
                            )}
                            <td>
                              <InputGroup size="sm">
                                <InputGroup.Text className="border-0 bg-light text-muted">
                                  $
                                </InputGroup.Text>
                                <Form.Control
                                  type="number"
                                  className="border-0 bg-light focus-ring focus-ring-primary"
                                  value={sueldoDe(t)}
                                  onChange={(e) =>
                                    handleSueldoChange(t.rut, Number(e.target.value) || 0)
                                  }
                                />
                              </InputGroup>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>

                <div className="bg-white border rounded p-3 mt-4">
                  <Form.Check
                    type="checkbox"
                    id="guardar-en-base-masivo"
                    checked={guardarEnBase}
                    onChange={(e) => setGuardarEnBase(e.target.checked)}
                    label="Registrar trabajadores nuevos y guardar estos contratos en la base al generar"
                  />
                </div>
              </div>
            )}

            {/* --- NAVEGACIÓN DEL WIZARD --- */}
            <div className="d-flex justify-content-between mt-5 pt-4 border-top">
              <Button
                variant="outline-secondary"
                className="fw-semibold px-4"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                disabled={currentStep === 1 || isSubmitting}
              >
                <i className="bi bi-chevron-left me-2"></i>Atrás
              </Button>

              {currentStep < 3 ? (
                <Button
                  variant="primary"
                  className="fw-semibold px-4 shadow-sm"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={currentStep === 1 && selectedRuts.size === 0}
                >
                  Continuar<i className="bi bi-chevron-right ms-2"></i>
                </Button>
              ) : (
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-primary"
                    className="fw-semibold px-4"
                    onClick={() => handleSubmit('docx')}
                    disabled={!puedeGenerar || isSubmitting}
                  >
                    {generando === 'docx' ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-file-earmark-word me-2"></i>Descargar Word
                      </>
                    )}
                  </Button>
                  <Button
                    variant="success"
                    className="fw-semibold px-4 shadow-sm"
                    onClick={() => handleSubmit('pdf')}
                    disabled={!puedeGenerar || isSubmitting}
                  >
                    {generando === 'pdf' ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-file-earmark-check-fill fs-6 me-2"></i>Generar PDF
                      </>
                    )}
                  </Button>
                  {config.exportarSigper && (
                    <Button
                      variant="outline-secondary"
                      className="fw-semibold px-4"
                      onClick={exportarSigper}
                      disabled={
                        !puedeGenerar ||
                        isSubmitting ||
                        generandoSigper ||
                        !config.sigperUnidadLaboral
                      }
                    >
                      {generandoSigper ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" className="me-2" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-arrow-up me-2"></i>Exportar a SIGPER
                        </>
                      )}
                    </Button>
                  )}
                  {config.exportarSigper && config.incluirBonos && (
                    <Button
                      variant="outline-secondary"
                      className="fw-semibold px-4"
                      onClick={exportarBonosSigper}
                      disabled={!puedeGenerar || isSubmitting || generandoBonosSigper}
                    >
                      {generandoBonosSigper ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" className="me-2" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cash-coin me-2"></i>Voucher Bonos SIGPER
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* --- CONTENIDO TAB: EXCEL --- */}
      {activeTab === 'excel' && (
        <>
          <Card className="shadow-sm border-0 rounded-4 mb-3">
            <Card.Body className="p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                <div>
                  <h5 className="fw-bold text-dark mb-1">
                    <i className="bi bi-file-earmark-spreadsheet text-success me-2"></i>
                    Planilla de información personal (.xlsx / .xlsm)
                  </h5>
                  <p className="text-muted small mb-0">
                    Sube la planilla con la hoja <strong>TRABAJADORES</strong> y genera un único
                    documento con un contrato por página.
                  </p>
                </div>
                <Button variant="outline-success" className="fw-semibold" onClick={descargarPlantillaExcel}>
                  <i className="bi bi-download me-2"></i>Descargar plantilla
                </Button>
              </div>

              <Form.Control
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) procesarArchivoExcel(f);
                }}
              />
              {nombreArchivoExcel && (
                <div className="text-muted small mt-2">
                  <i className="bi bi-file-earmark-excel me-1"></i>
                  {nombreArchivoExcel}
                </div>
              )}
            </Card.Body>
          </Card>

          {filasExcel.length > 0 && (
            <Card className="shadow-sm border-0 rounded-4">
              <Card.Header className="bg-dark text-white fw-bold small py-3 d-flex justify-content-between align-items-center rounded-top-4">
                <span>Trabajadores en la planilla</span>
                <div className="d-flex align-items-center gap-3">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-white-50 p-0 text-decoration-none small"
                    onClick={() => marcarTodasExcel(true)}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-white-50 p-0 text-decoration-none small"
                    onClick={() => marcarTodasExcel(false)}
                  >
                    Ninguno
                  </Button>
                  <Badge bg="info" text="dark">
                    {seleccionadasExcel.length}/{filasExcel.length}
                  </Badge>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead className="bg-light text-secondary text-uppercase" style={{ fontSize: '0.8rem' }}>
                      <tr>
                        <th className="text-center" style={{ width: 50 }}></th>
                        <th>Trabajador</th>
                        <th>RUT</th>
                        <th>Período</th>
                        <th className="text-end">Sueldo</th>
                        <th>Programa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasExcel.map((f) => {
                        const c = f.datos.contrato;
                        const sinFechas = !c.inicio || !c.termino;
                        return (
                          <tr key={f.rut} className={sinFechas ? 'table-warning' : ''}>
                            <td className="text-center">
                              <Form.Check checked={f.incluir} onChange={() => toggleFilaExcel(f.rut)} />
                            </td>
                            <td className="fw-semibold text-dark text-uppercase">{f.nombre}</td>
                            <td className="font-monospace text-muted small">
                              {f.datos.trabajador.rut_miles}-{f.datos.trabajador.dv}
                            </td>
                            <td>
                              {c.inicio || '—'} → {c.termino || '—'}
                              {sinFechas && (
                                <i
                                  className="bi bi-exclamation-triangle text-warning ms-1"
                                  title="Revisa el formato de fecha en la planilla"
                                ></i>
                              )}
                            </td>
                            <td className="text-end font-monospace">${c.sueldo_texto}</td>
                            <td>
                              <Badge bg="light" text="dark" className="border fw-normal">
                                {f.datos.programa.id}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
              <Card.Footer className="d-flex gap-2 justify-content-end bg-white border-top rounded-bottom-4 p-3">
                <Button
                  variant="outline-primary"
                  className="fw-semibold px-4"
                  disabled={seleccionadasExcel.length === 0 || generandoExcel !== null}
                  onClick={() => generarExcel('docx')}
                >
                  <i className="bi bi-file-earmark-word me-2"></i>
                  {generandoExcel === 'docx' ? 'Generando...' : 'Descargar Word'}
                </Button>
                <Button
                  variant="success"
                  className="fw-semibold px-4 shadow-sm"
                  disabled={seleccionadasExcel.length === 0 || generandoExcel !== null}
                  onClick={() => generarExcel('pdf')}
                >
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  {generandoExcel === 'pdf' ? 'Generando...' : 'Generar PDF'}
                </Button>
              </Card.Footer>
            </Card>
          )}
        </>
      )}

      {/* --- MODAL: AGREGAR NUEVO TRABAJADOR BÁSICO --- */}
      <Modal
        show={showNewWorkerModal}
        onHide={handleCloseNewWorkerModal}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-primary text-white border-bottom-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-person-plus-fill me-2"></i>Nuevo Trabajador
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Alert variant="info" className="py-2 small">
            El trabajador se crea en la base de datos y queda seleccionado de inmediato. Sus datos
            personales y el sueldo se completan en el Paso 3.
          </Alert>
          <Form>
            <Row className="g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    RUT (sin DV) <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej: 12345678"
                    value={newWorker.rut}
                    onChange={(e) => setNewWorker({ ...newWorker, rut: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">DV</Form.Label>
                  <Form.Control
                    type="text"
                    value={dvNuevo}
                    readOnly
                    disabled
                    className="bg-light text-center fw-bold font-monospace"
                    placeholder="—"
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '0.72rem' }}>
                    Se calcula solo.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Nombres <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={newWorker.nombres}
                    onChange={(e) => setNewWorker({ ...newWorker, nombres: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Apellido paterno <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={newWorker.primerApellido}
                    onChange={(e) => setNewWorker({ ...newWorker, primerApellido: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Apellido materno
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={newWorker.segundoApellido}
                    onChange={(e) => setNewWorker({ ...newWorker, segundoApellido: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">Género</Form.Label>
                  <Form.Select
                    value={newWorker.genero}
                    onChange={(e) => setNewWorker({ ...newWorker, genero: e.target.value })}
                  >
                    <option value="">— sin especificar —</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-0">
          <Button
            variant="outline-secondary"
            onClick={handleCloseNewWorkerModal}
            className="fw-semibold"
            disabled={guardandoNuevo}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveNewWorker}
            className="fw-semibold shadow-sm"
            disabled={guardandoNuevo}
          >
            {guardandoNuevo ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              'Crear y Seleccionar'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* --- MODAL: EDITAR DATOS PERSONALES (PASO 3) --- */}
      <Modal
        show={showEditModal}
        onHide={handleCloseEditModal}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-info text-white border-bottom-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-pencil-square me-2"></i>Editar Datos Personales
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Form>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Género
                  </Form.Label>
                  <Form.Select
                    value={editingForm.genero}
                    onChange={(e) => setEditingForm({ ...editingForm, genero: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Nacionalidad
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={editingForm.nacionalidad}
                    onChange={(e) =>
                      setEditingForm({ ...editingForm, nacionalidad: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Estado Civil
                  </Form.Label>
                  <Form.Select
                    value={editingForm.estadoCivilId}
                    onChange={(e) =>
                      setEditingForm({ ...editingForm, estadoCivilId: e.target.value })
                    }
                  >
                    {ESTADOS_CIVILES.map((ec) => (
                      <option key={ec.id} value={ec.id}>
                        {estadoCivilLabel(ec.id, editingForm.genero || undefined)}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Lugar de Nacimiento
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={editingForm.lugarNac}
                    onChange={(e) => setEditingForm({ ...editingForm, lugarNac: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Fecha de Nacimiento
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={editingForm.fechaNac}
                    onChange={(e) => setEditingForm({ ...editingForm, fechaNac: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Sueldo Base
                  </Form.Label>
                  <InputGroup>
                    <InputGroup.Text>$</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={editingForm.sueldoBase || ''}
                      onChange={(e) =>
                        setEditingForm({ ...editingForm, sueldoBase: Number(e.target.value) || 0 })
                      }
                    />
                  </InputGroup>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Domicilio
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={editingForm.domicilio}
                    onChange={(e) => setEditingForm({ ...editingForm, domicilio: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Comuna
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={editingForm.comuna}
                    onChange={(e) => setEditingForm({ ...editingForm, comuna: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">
                    Previsión (AFP)
                  </Form.Label>
                  <Form.Select
                    value={editingForm.prevision}
                    onChange={(e) => setEditingForm({ ...editingForm, prevision: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {AFP_OPCIONES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small text-secondary mb-1">Salud</Form.Label>
                  <Form.Select
                    value={editingForm.salud}
                    onChange={(e) => setEditingForm({ ...editingForm, salud: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {SALUD_OPCIONES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-0">
          <Button
            variant="outline-secondary"
            onClick={handleCloseEditModal}
            className="fw-semibold"
          >
            Cancelar
          </Button>
          <Button
            variant="info"
            onClick={handleSaveWorkerChanges}
            className="fw-semibold text-white shadow-sm"
          >
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
