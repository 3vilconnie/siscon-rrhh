'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import { construirDatosHoras } from '@/lib/horasCompensatorias';
import toast from 'react-hot-toast';
import {
  Card,
  Row,
  Col,
  Form,
  Table,
  Badge,
  Button,
  Spinner,
  Alert,
  InputGroup,
  Modal,
} from 'react-bootstrap';
import { Trabajador, ResumenHorasFuncionario } from '@/types';
import BuscadorTrabajadores from '@/components/BuscadorTrabajadores';
import Pagination from '@/components/Pagination';

interface DetalleConsumo {
  id: string;
  fecha: string;
  horas_solicitadas: number;
  creado_at?: string;
}

const TOPE_ANUAL = 44;

export default function HorasCompensatoriasPage() {
  // Estados de Filtro y Datos (Tabla Principal)
  const [anoSeleccionado, setAnoSeleccionado] = useState(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [resumenes, setResumenes] = useState<ResumenHorasFuncionario[]>([]);
  const [loadingTabla, setLoadingTabla] = useState(true);

  // Estados para Búsqueda y Paginación
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 10;

  // Estados de Formulario de Ingreso
  const [rutInput, setRutInput] = useState('');
  const [dvInput, setDvInput] = useState('');
  const [nombresInput, setNombresInput] = useState('');
  const [primerApellidoInput, setPrimerApellidoInput] = useState('');
  const [segundoApellidoInput, setSegundoApellidoInput] = useState('');
  const [fechaInput, setFechaInput] = useState('');
  const [horasInput, setHorasInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [trabajadorEncontrado, setTrabajadorEncontrado] = useState(false);

  // --- NUEVOS ESTADOS PARA EL MODAL DE DETALLE ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [funcionarioSeleccionado, setFuncionarioSeleccionado] =
    useState<ResumenHorasFuncionario | null>(null);
  const [detallesHistorial, setDetallesHistorial] = useState<DetalleConsumo[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [generandoDoc, setGenerandoDoc] = useState<'pdf' | 'docx' | null>(null);

  // Declarada antes de los efectos porque el efecto de búsqueda la usa.
  // useCallback([]) mantiene una referencia estable (solo llama setters).
  const limpiarCamposTrabajador = useCallback(() => {
    setDvInput('');
    setNombresInput('');
    setPrimerApellidoInput('');
    setSegundoApellidoInput('');
    setTrabajadorEncontrado(false);
  }, []);

  // Cargar resumen consolidado
  const cargarResumenHoras = useCallback(async () => {
    try {
      const { data: trabajadores, error: errT } = await supabase
        .from('trabajadores')
        .select('rut, dv, nombres, primer_apellido, segundo_apellido');

      if (errT) throw errT;

      const fechaInicioAno = `${anoSeleccionado}-01-01`;
      const fechaFinAno = `${anoSeleccionado}-12-31`;

      const { data: consumos, error: errC } = await supabase
        .from('registros_horas_compensatorias')
        .select('trabajador_rut, fecha, horas_solicitadas')
        .gte('fecha', fechaInicioAno)
        .lte('fecha', fechaFinAno);

      if (errC) throw errC;

      const listaConsolidada: ResumenHorasFuncionario[] = (trabajadores as Trabajador[]).map(
        (t) => {
          const consumosTrabajador = consumos?.filter((c) => c.trabajador_rut === t.rut) || [];
          const totalAno = consumosTrabajador.reduce(
            (sum, item) => sum + Number(item.horas_solicitadas),
            0,
          );
          const totalMes = consumosTrabajador
            .filter((c) => new Date(c.fecha).getUTCMonth() + 1 === mesSeleccionado)
            .reduce((sum, item) => sum + Number(item.horas_solicitadas), 0);

          return {
            rut: t.rut,
            dv: t.dv,
            nombreCompleto: `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`
              .trim()
              .toUpperCase(),
            horasConsumidasAnuales: totalAno,
            horasDisponiblesAnuales: Math.max(0, TOPE_ANUAL - totalAno),
            horasConsumidasMesSeleccionado: totalMes,
          };
        },
      );

      setResumenes(listaConsolidada);
    } catch (error) {
      console.error(error);
      toast.error('Error al calcular el resumen de horas.');
    } finally {
      setLoadingTabla(false);
    }
  }, [anoSeleccionado, mesSeleccionado]);

  useEffect(() => {
    cargarResumenHoras();
  }, [cargarResumenHoras]);

  // Buscar trabajador automáticamente al escribir el RUT
  useEffect(() => {
    const buscarTrabajador = async () => {
      const rutClean = parseInt(rutInput.replace(/[^0-9]/g, ''));

      if (!rutClean || isNaN(rutClean)) {
        limpiarCamposTrabajador();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('trabajadores')
          .select('dv, nombres, primer_apellido, segundo_apellido')
          .eq('rut', rutClean)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setDvInput(data.dv || '');
          setNombresInput(data.nombres || '');
          setPrimerApellidoInput(data.primer_apellido || '');
          setSegundoApellidoInput(data.segundo_apellido || '');
          setTrabajadorEncontrado(true);
        } else {
          limpiarCamposTrabajador();
        }
      } catch (err) {
        console.error('Error al buscar trabajador:', err);
      }
    };

    const delayDebounce = setTimeout(() => {
      buscarTrabajador();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [rutInput, limpiarCamposTrabajador]);

  const reiniciarFormularioCompleto = () => {
    setRutInput('');
    limpiarCamposTrabajador();
    setFechaInput('');
    setHorasInput('');
  };

  // Guardar registro de descuento
  const handleRegistrarHoras = async (e: React.FormEvent) => {
    e.preventDefault();
    const rutClean = parseInt(rutInput.replace(/[^0-9]/g, ''));
    const horasNum = parseFloat(horasInput);

    if (!rutClean || !fechaInput || isNaN(horasNum) || horasNum <= 0) {
      toast.error('Por favor, completa todos los campos correctamente.');
      return;
    }

    if (!trabajadorEncontrado) {
      toast.error('No se puede registrar. El funcionario no existe en el sistema.');
      return;
    }

    setGuardando(true);
    const toastId = toast.loading('Procesando descuento de horas...');

    try {
      const anoFechaRegistro = new Date(fechaInput).getFullYear();
      const { data: acumulado, error: errAcum } = await supabase
        .from('registros_horas_compensatorias')
        .select('horas_solicitadas')
        .eq('trabajador_rut', rutClean)
        .gte('fecha', `${anoFechaRegistro}-01-01`)
        .lte('fecha', `${anoFechaRegistro}-12-31`);

      if (errAcum) throw errAcum;

      const horasConsumidas = acumulado.reduce(
        (sum, item) => sum + Number(item.horas_solicitadas),
        0,
      );

      if (horasConsumidas + horasNum > TOPE_ANUAL) {
        const disponible = TOPE_ANUAL - horasConsumidas;
        toast.error(
          `Cupo insuficiente: Solo quedan ${disponible} hrs disponibles para el año ${anoFechaRegistro}.`,
          { id: toastId, duration: 5000 },
        );
        setGuardando(false);
        return;
      }

      const { error: errInsert } = await supabase.from('registros_horas_compensatorias').insert({
        trabajador_rut: rutClean,
        fecha: fechaInput,
        horas_solicitadas: horasNum,
      });

      if (errInsert) {
        if (errInsert.message.includes('la fecha seleccionada ya tiene un registro')) {
          toast.error('La fecha seleccionada ya tiene un registro', { id: toastId });
        } else {
          toast.error(`Error al registrar: ${errInsert.message}`, { id: toastId });
        }
        return;
      }
      await registrarAuditoria(
        ACCIONES.REGISTRAR_HORAS,
        `RUT ${rutClean}: ${horasNum} h el ${fechaInput}`,
      );
      toast.success('Horas compensatorias descontadas exitosamente.', { id: toastId });

      reiniciarFormularioCompleto();
      setLoadingTabla(true);
      await cargarResumenHoras();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      toast.error(`Error de base de datos: ${message}`, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  // --- NUEVA FUNCIÓN: CARGAR HISTORIAL EN EL MODAL ---
  const handleVerDetalle = async (funcionario: ResumenHorasFuncionario) => {
    setFuncionarioSeleccionado(funcionario);
    setModalAbierto(true);
    setLoadingDetalle(true);
    try {
      // Buscamos todas las solicitudes del año en curso del funcionario seleccionado
      const { data, error } = await supabase
        .from('registros_horas_compensatorias')
        .select('id, fecha, horas_solicitadas')
        .eq('trabajador_rut', funcionario.rut)
        .gte('fecha', `${anoSeleccionado}-01-01`)
        .lte('fecha', `${anoSeleccionado}-12-31`)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setDetallesHistorial(data || []);
    } catch (err) {
      toast.error(`No se pudo cargar el desglose detallado ${err}.`);
    } finally {
      setLoadingDetalle(false);
    }
  };

  // --- GENERAR DOCUMENTO (PDF / Word) DEL DETALLE DE PERMISOS ---
  const generarDetalle = async (formato: 'pdf' | 'docx') => {
    if (!funcionarioSeleccionado) return;
    if (detallesHistorial.length === 0)
      return toast.error('No hay permisos registrados para detallar.');

    const datos = construirDatosHoras({
      nombreCompleto: funcionarioSeleccionado.nombreCompleto,
      rut: funcionarioSeleccionado.rut,
      dv: funcionarioSeleccionado.dv,
      ano: anoSeleccionado,
      tope: TOPE_ANUAL,
      consumidas: funcionarioSeleccionado.horasConsumidasAnuales,
      disponibles: funcionarioSeleccionado.horasDisponiblesAnuales,
      detalles: detallesHistorial.map((d) => ({
        fecha: d.fecha,
        horas_solicitadas: d.horas_solicitadas,
      })),
    });

    setGenerandoDoc(formato);
    const toastId = toast.loading(`Generando ${formato.toUpperCase()}...`);
    try {
      const res = await fetch('/api/horas/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, datos }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `horas_compensatorias_${funcionarioSeleccionado.rut}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Documento ${formato.toUpperCase()} generado.`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el documento.', {
        id: toastId,
        duration: 6000,
      });
    } finally {
      setGenerandoDoc(null);
    }
  };

  // Filtrado de Búsqueda
  const resumenesFiltrados = resumenes.filter((r) => {
    const termino = busqueda.toLowerCase().trim();
    if (!termino) return true;
    const rutCompleto = `${r.rut}-${r.dv}`.toLowerCase();
    const nombreCompleto = r.nombreCompleto.toLowerCase();
    return rutCompleto.includes(termino) || nombreCompleto.includes(termino);
  });

  // Paginación
  const totalRegistros = resumenesFiltrados.length;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  const indiceUltimoRegistro = paginaActual * registrosPorPagina;
  const indicePrimerRegistro = indiceUltimoRegistro - registrosPorPagina;
  const registrosPaginaActual = resumenesFiltrados.slice(
    indicePrimerRegistro,
    indiceUltimoRegistro,
  );

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h2 className="fw-bold text-dark m-0">📊 Control de Horas Compensatorias</h2>
        <p className="text-muted small">
          Gestión de rebajas con tope de {TOPE_ANUAL} horas anuales por funcionario institucional.
        </p>
      </div>

      <Row className="g-4">
        {/* FORMULARIO DE INGRESO */}
        <Col xs={12} xl={4}>
          <Card className="shadow-sm border-0 bg-white p-4">
            <h5 className="fw-bold text-secondary border-bottom pb-2 mb-3">
              <i className="bi bi-clock-fill me-2 text-danger"></i>Registrar Uso de Horas
            </h5>
            <Form onSubmit={handleRegistrarHoras} className="d-flex flex-column gap-3">
              <Row className="g-2">
                <Col xs={8}>
                  <Form.Label className="small fw-bold text-secondary">RUT Funcionario</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej: 19543210"
                    value={rutInput}
                    onChange={(e) => setRutInput(e.target.value)}
                    disabled={guardando}
                    required
                    tabIndex={1}
                  />
                </Col>
                <Col xs={4}>
                  <Form.Label className="small fw-bold text-secondary">DV</Form.Label>
                  <Form.Control
                    type="text"
                    className="text-center bg-light text-muted fw-bold"
                    value={dvInput}
                    readOnly
                  />
                </Col>
              </Row>

              <div>
                <Form.Label className="small fw-bold text-secondary">Nombres</Form.Label>
                <Form.Control
                  type="text"
                  className="bg-light text-muted text-uppercase"
                  value={nombresInput}
                  readOnly
                />
              </div>

              <Row className="g-2">
                <Col xs={6}>
                  <Form.Label className="small fw-bold text-secondary">Apellido Paterno</Form.Label>
                  <Form.Control
                    type="text"
                    className="bg-light text-muted text-uppercase"
                    value={primerApellidoInput}
                    readOnly
                  />
                </Col>
                <Col xs={6}>
                  <Form.Label className="small fw-bold text-secondary">Apellido Materno</Form.Label>
                  <Form.Control
                    type="text"
                    className="bg-light text-muted text-uppercase"
                    value={segundoApellidoInput}
                    readOnly
                  />
                </Col>
              </Row>

              {rutInput && !trabajadorEncontrado && (
                <Alert
                  variant="warning"
                  className="py-2 small m-0 border-0 shadow-sm font-monospace text-center"
                >
                  ⚠️ RUT no registrado en el sistema.
                </Alert>
              )}

              <div>
                <Form.Label className="small fw-bold text-secondary">Fecha del Permiso</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaInput}
                  onChange={(e) => setFechaInput(e.target.value)}
                  disabled={guardando || !trabajadorEncontrado}
                  required
                  tabIndex={2}
                />
              </div>
              <div>
                <Form.Label className="small fw-bold text-secondary">Horas Solicitadas</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    step="0.25"
                    placeholder="Ej: 4.5"
                    value={horasInput}
                    onChange={(e) => setHorasInput(e.target.value)}
                    disabled={guardando || !trabajadorEncontrado}
                    required
                    tabIndex={3}
                  />
                  <InputGroup.Text className="bg-light text-muted">Hrs.</InputGroup.Text>
                </InputGroup>
              </div>
              <Button
                type="submit"
                variant="danger"
                className="fw-bold mt-2"
                disabled={guardando || !trabajadorEncontrado}
                tabIndex={4}
              >
                {guardando ? 'Procesando...' : 'Descontar Horas'}
              </Button>
            </Form>
          </Card>
        </Col>

        {/* REPORTE CON BUSCADOR, BOTÓN DE DETALLE Y PAGINACIÓN */}
        <Col xs={12} xl={8}>
          <BuscadorTrabajadores
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            totalFiltrados={totalRegistros}
            totalTotal={resumenes.length}
          />

          <Card className="shadow-sm border-0 bg-white p-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center border-bottom pb-3 mb-3 gap-2">
              <h5 className="fw-bold text-secondary m-0">
                <i className="bi bi-calendar-check me-2 text-primary"></i>Resumen de Saldos del
                Personal
              </h5>

              <div className="d-flex gap-2">
                <Form.Select
                  size="sm"
                  value={mesSeleccionado}
                  onChange={(e) => {
                    setLoadingTabla(true);
                    setMesSeleccionado(Number(e.target.value));
                  }}
                >
                  <option value={1}>Enero</option>
                  <option value={2}>Febrero</option>
                  <option value={3}>Marzo</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Mayo</option>
                  <option value={6}>Junio</option>
                  <option value={7}>Julio</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Septiembre</option>
                  <option value={10}>Octubre</option>
                  <option value={11}>Noviembre</option>
                  <option value={12}>Diciembre</option>
                </Form.Select>

                <Form.Select
                  size="sm"
                  value={anoSeleccionado}
                  onChange={(e) => {
                    setLoadingTabla(true);
                    setAnoSeleccionado(Number(e.target.value));
                  }}
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </Form.Select>
              </div>
            </div>

            <div className="table-responsive">
              <Table hover className="align-middle m-0 small">
                <thead className="table-dark text-uppercase text-center">
                  <tr>
                    <th className="text-start ps-3">Funcionario</th>
                    <th>Consumo Mes</th>
                    <th>Total Año ({anoSeleccionado})</th>
                    <th>Saldo Disponible</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTabla ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        <Spinner animation="border" size="sm" className="me-2 text-primary" />
                        Consolidando registros históricos...
                      </td>
                    </tr>
                  ) : registrosPaginaActual.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-muted">
                        No se encontraron funcionarios que coincidan con los criterios.
                      </td>
                    </tr>
                  ) : (
                    registrosPaginaActual.map((r) => (
                      <tr key={r.rut} className="text-center">
                        <td className="text-start ps-3">
                          <div className="fw-bold text-dark">{r.nombreCompleto}</div>
                          <span className="text-muted font-monospace" style={{ fontSize: '11px' }}>
                            RUT: {r.rut}-{r.dv}
                          </span>
                        </td>
                        <td className="fw-semibold text-primary">
                          {r.horasConsumidasMesSeleccionado} hrs
                        </td>
                        <td className="fw-semibold text-danger">
                          {r.horasConsumidasAnuales} / {TOPE_ANUAL} hrs
                        </td>
                        <td>
                          <Badge
                            bg={
                              r.horasDisponiblesAnuales <= 5
                                ? 'danger'
                                : r.horasDisponiblesAnuales <= 15
                                  ? 'warning'
                                  : 'success'
                            }
                            text={
                              r.horasDisponiblesAnuales > 5 && r.horasDisponiblesAnuales <= 15
                                ? 'dark'
                                : undefined
                            }
                            className="px-2 py-1"
                          >
                            {r.horasDisponiblesAnuales} hrs libres
                          </Badge>
                        </td>
                        {/* BOTÓN NUEVO: VER DETALLE */}
                        <td>
                          <Button
                            type="button"
                            variant="outline-primary"
                            size="sm"
                            className="fw-bold d-inline-flex align-items-center gap-1"
                            onClick={() => handleVerDetalle(r)}
                          >
                            <i className="bi bi-eye-fill"></i> Ver Detalle
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card>

          <div className="mt-4">
            <Pagination
              paginaActual={paginaActual}
              totalPaginas={totalPaginas}
              onPaginaChange={(numero) => setPaginaActual(numero)}
            />
          </div>
        </Col>
      </Row>

      {/* --- MODAL DE DETALLE (react-bootstrap) --- */}
      <Modal
        show={modalAbierto}
        onHide={() => setModalAbierto(false)}
        centered
        contentClassName="border-0 shadow-lg"
      >
        <Modal.Header closeButton closeVariant="white" className="bg-dark text-white border-0">
          <Modal.Title className="fw-bold h5">
            <i className="bi bi-journal-text me-2 text-primary"></i>
            Desglose de Uso Histórico
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {funcionarioSeleccionado && (
            <div className="mb-3 bg-light p-3 rounded shadow-sm">
              <div className="fw-bold text-dark text-uppercase">
                {funcionarioSeleccionado.nombreCompleto}
              </div>
              <div className="text-muted small font-monospace">
                RUT: {funcionarioSeleccionado.rut}-{funcionarioSeleccionado.dv}
              </div>
              <Row className="mt-2 text-center border-top pt-2">
                <Col xs={6} className="border-end">
                  <small className="text-muted d-block">Consumido en {anoSeleccionado}</small>
                  <span className="fw-bold text-danger">
                    {funcionarioSeleccionado.horasConsumidasAnuales} hrs
                  </span>
                </Col>
                <Col xs={6}>
                  <small className="text-muted d-block">Saldo Libre</small>
                  <span className="fw-bold text-success">
                    {funcionarioSeleccionado.horasDisponiblesAnuales} hrs
                  </span>
                </Col>
              </Row>
            </div>
          )}

          <h6 className="fw-bold text-secondary mb-2 border-bottom pb-1">
            Fechas y Cupos Solicitados ({anoSeleccionado})
          </h6>

          <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <Table striped size="sm" className="align-middle m-0 text-center">
              <thead className="table-secondary sticky-top">
                <tr>
                  <th>N°</th>
                  <th>Fecha de Permiso</th>
                  <th>Horas Rebajadas</th>
                </tr>
              </thead>
              <tbody>
                {loadingDetalle ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-muted">
                      <Spinner animation="border" size="sm" className="text-primary me-2" />
                      Buscando registros...
                    </td>
                  </tr>
                ) : detallesHistorial.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-muted small">
                      No registra rebajas de horas compensatorias en este período.
                    </td>
                  </tr>
                ) : (
                  detallesHistorial.map((d, index) => (
                    <tr key={d.id}>
                      <td className="text-muted font-monospace">{index + 1}</td>
                      <td className="fw-medium">
                        {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="fw-bold text-danger">{d.horas_solicitadas} hrs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 bg-light py-2 d-flex justify-content-between">
          <div className="d-flex gap-2">
            <Button
              type="button"
              variant="outline-success"
              size="sm"
              disabled={loadingDetalle || detallesHistorial.length === 0 || generandoDoc !== null}
              onClick={() => generarDetalle('docx')}
            >
              <i className="bi bi-file-earmark-word me-1"></i>
              {generandoDoc === 'docx' ? 'Generando...' : 'Word'}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={loadingDetalle || detallesHistorial.length === 0 || generandoDoc !== null}
              onClick={() => generarDetalle('pdf')}
            >
              <i className="bi bi-file-earmark-pdf me-1"></i>
              {generandoDoc === 'pdf' ? 'Generando...' : 'Descargar PDF'}
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="fw-bold"
            onClick={() => setModalAbierto(false)}
          >
            Cerrar Ventana
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
