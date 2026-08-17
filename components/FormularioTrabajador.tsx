'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import { calcularDV } from '@/lib/rut';
import { toast } from 'react-hot-toast';
import { Card, Form, Row, Col, InputGroup, Button, Spinner, Alert } from 'react-bootstrap';

export default function FormularioTrabajador() {
  // 1. Estados de Identidad
  const [rut, setRut] = useState('');
  const [dv, setDv] = useState('');
  const [nombres, setNombres] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');

  // 2. Estados de Estructura Contractual
  const [jornada, setJornada] = useState('44');
  const [sueldoBase, setSueldoBase] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');

  // Estados de control UX
  const [trabajadorId, setTrabajadorId] = useState<string | null>(null);
  const [buscandoRut, setBuscandoRut] = useState(false);
  const [existeTrabajador, setExisteTrabajador] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [mostrarContrato, setMostrarContrato] = useState(false);
  const [loading, setLoading] = useState(false);

  // UX: Monitor dinámico del RUT con debounce
  useEffect(() => {
    const cuerpoRut = rut.replace(/[^0-9]/g, '');

    if (cuerpoRut.length >= 7) {
      const dvCalculado = calcularDV(cuerpoRut);
      setDv(dvCalculado);

      setBuscandoRut(true);
      const timer = setTimeout(async () => {
        const { data, error } = await supabase
          .from('trabajadores')
          .select('rut, nombres, primer_apellido, segundo_apellido')
          .eq('rut', parseInt(cuerpoRut))
          .single();

        if (!error && data) {
          setNombres(data.nombres);
          setPrimerApellido(data.primer_apellido);
          setSegundoApellido(data.segundo_apellido || '');
          setExisteTrabajador(true);
          setBloqueado(true);
          toast.success('Funcionario verificado. Listo para anexar contrato.', { id: 'rut-check' });
        } else {
          if (bloqueado) {
            setNombres('');
            setPrimerApellido('');
            setSegundoApellido('');
          }
          setExisteTrabajador(false);
          setBloqueado(false);
          setMostrarContrato(false);
        }
        setBuscandoRut(false);
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setDv('');
      setBuscandoRut(false);
    }
  }, [rut]);

  const handleLimpiarFormulario = () => {
    setTrabajadorId(null);
    setRut('');
    setDv('');
    setNombres('');
    setPrimerApellido('');
    setSegundoApellido('');
    setJornada('44');
    setSueldoBase('');
    setFechaInicio('');
    setFechaTermino('');
    setExisteTrabajador(false);
    setBloqueado(false);
    setMostrarContrato(false);
    toast.dismiss();
  };

  // Guardar definitivo en base de datos
  const handleGuardarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    const cuerpoRut = parseInt(rut.replace(/[^0-9]/g, ''));

    if (!fechaInicio) {
      toast.error('La fecha de inicio es obligatoria.');
      return;
    }

    if (fechaTermino && new Date(fechaTermino) < new Date(fechaInicio)) {
      toast.error('La fecha de término no puede ser anterior a la de inicio.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Procesando registro contractual...');

    try {
      // 1. Consultar e impedir traslapes de contratos de este funcionario
      const { data: contratosExistentes, error: errBusqueda } = await supabase
        .from('contratos')
        .select('fecha_inicio, fecha_termino')
        .eq('trabajador_rut', cuerpoRut);

      if (!errBusqueda && contratosExistentes && contratosExistentes.length > 0) {
        const inicioNuevo = new Date(fechaInicio);
        const terminoNuevo = fechaTermino ? new Date(fechaTermino) : new Date('2099-12-31');

        const hayTraslape = contratosExistentes.some((contrato) => {
          const inicioExistente = new Date(contrato.fecha_inicio);
          const terminoExistente = contrato.fecha_termino
            ? new Date(contrato.fecha_termino)
            : new Date('2099-12-31');
          return inicioNuevo <= terminoExistente && terminoNuevo >= inicioExistente;
        });

        if (hayTraslape) {
          toast.error(
            'El período ingresado se superpone con las fechas de otro contrato ya registrado.',
            { id: toastId, duration: 5000 },
          );
          setLoading(false);
          return;
        }
      }

      // 2. Si el trabajador es completamente nuevo, registrar su identidad primero
      if (!existeTrabajador) {
        const { error: errTrabajador } = await supabase.from('trabajadores').insert({
          rut: cuerpoRut,
          dv: dv.toUpperCase(),
          nombres: nombres.toUpperCase().trim(),
          primer_apellido: primerApellido.toUpperCase().trim(),
          segundo_apellido: segundoApellido ? segundoApellido.toUpperCase().trim() : null,
        });
        if (errTrabajador) throw errTrabajador;

        await registrarAuditoria(
          ACCIONES.CREAR_TRABAJADOR,
          `RUT ${cuerpoRut}-${dv.toUpperCase()}: ${nombres.trim()} ${primerApellido.trim()} ${segundoApellido.trim()}`.trim(),
        );
      }

      // 3. Insertar los términos del Contrato
      const { error: errContrato } = await supabase.from('contratos').insert({
        trabajador_rut: cuerpoRut,
        jornada: parseInt(jornada),
        sueldo_base: parseFloat(sueldoBase),
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino || null,
      });

      if (errContrato) throw errContrato;

      await registrarAuditoria(
        ACCIONES.CREAR_CONTRATO,
        `RUT ${cuerpoRut}: ${fechaInicio} → ${fechaTermino || 'Indefinido'}, jornada ${jornada}h, sueldo $${sueldoBase}`,
      );

      toast.success('¡Ficha contractual guardada exitosamente!', { id: toastId });
      handleLimpiarFormulario();
    } catch (error: any) {
      toast.error(`Error al procesar: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-0 justify-content-center w-100" style={{ maxWidth: '850px' }}>
      <Card.Header className="bg-dark text-white fw-bold d-flex align-items-center">
        <i className="bi bi-person-lines-fill me-2 fs-5"></i> Formulario de Personal y Contratos
      </Card.Header>

      <Card.Body className="p-4 p-md-5">
        {/* SECCIÓN 1: IDENTIDAD */}
        <h6 className="text-secondary border-bottom pb-2 mb-4 fw-bold text-uppercase d-flex align-items-center">
          <span
            className="bg-primary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2"
            style={{ width: '24px', height: '24px', fontSize: '12px' }}
          >
            1
          </span>
          Datos de Identidad
        </h6>

        <Row className="g-3 mb-4">
          <Col xs={8} md={4}>
            <Form.Label className="small fw-bold text-secondary">RUT (Solo números)</Form.Label>
            <Form.Control
              type="text"
              className={bloqueado ? 'border-success bg-light fw-bold' : ''}
              placeholder="Ej: 19496016"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              disabled={bloqueado}
              required
            />
          </Col>
          <Col xs={4} md={2}>
            <Form.Label className="small fw-bold text-secondary">DV</Form.Label>
            <InputGroup>
              <InputGroup.Text
                className="bg-light fw-bold w-100 justify-content-center"
                style={{ height: '38px' }}
              >
                {buscandoRut ? (
                  <Spinner animation="border" size="sm" className="text-primary" role="status" />
                ) : (
                  dv || '-'
                )}
              </InputGroup.Text>
            </InputGroup>
          </Col>
          <Col md={6} className="d-flex align-items-end">
            {bloqueado && (
              <Button
                type="button"
                variant="outline-danger"
                className="fw-semibold px-3 w-100 w-md-auto"
                onClick={handleLimpiarFormulario}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i> Cambiar RUT o Funcionario
              </Button>
            )}
          </Col>

          {bloqueado && (
            <Col xs={12} className="my-2 animate__animated animate__fadeIn">
              <Alert
                variant="info"
                className="border-0 shadow-sm d-flex align-items-center m-0 py-2 px-3 small"
              >
                <i className="bi bi-shield-lock-fill text-info fs-5 me-2"></i>
                <div>
                  <strong>Funcionario Vinculado:</strong> Los datos de identidad están resguardados
                  en el archivo maestro. Presiona <u>Continuar con Contrato</u> para abrir la
                  sección contractual.
                </div>
              </Alert>
            </Col>
          )}

          {/* CAMPO: NOMBRES */}
          <Col md={6}>
            <Form.Label className="small fw-bold text-secondary">Nombres</Form.Label>
            <InputGroup>
              {bloqueado && (
                <InputGroup.Text className="bg-light text-muted border-end-0">
                  <i className="bi bi-lock-fill"></i>
                </InputGroup.Text>
              )}
              <Form.Control
                type="text"
                className={`text-uppercase ${bloqueado ? 'bg-light text-muted border-start-0' : ''}`}
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                readOnly={bloqueado}
                required
              />
            </InputGroup>
          </Col>

          {/* CAMPO: APELLIDO PATERNO */}
          <Col md={6}>
            <Form.Label className="small fw-bold text-secondary">Apellido Paterno</Form.Label>
            <InputGroup>
              {bloqueado && (
                <InputGroup.Text className="bg-light text-muted border-end-0">
                  <i className="bi bi-lock-fill"></i>
                </InputGroup.Text>
              )}
              <Form.Control
                type="text"
                className={`text-uppercase ${bloqueado ? 'bg-light text-muted border-start-0' : ''}`}
                value={primerApellido}
                onChange={(e) => setPrimerApellido(e.target.value)}
                readOnly={bloqueado}
                required
              />
            </InputGroup>
          </Col>

          {/* CAMPO: APELLIDO MATERNO */}
          <Col md={6}>
            <Form.Label className="small fw-bold text-secondary">Apellido Materno</Form.Label>
            <InputGroup>
              {bloqueado && (
                <InputGroup.Text className="bg-light text-muted border-end-0">
                  <i className="bi bi-lock-fill"></i>
                </InputGroup.Text>
              )}
              <Form.Control
                type="text"
                className={`text-uppercase ${bloqueado ? 'bg-light text-muted border-start-0' : ''}`}
                value={segundoApellido}
                onChange={(e) => setSegundoApellido(e.target.value)}
                readOnly={bloqueado}
              />
            </InputGroup>
          </Col>
        </Row>

        {/* CONTROL DE FLUJO DINÁMICO (UX) */}
        {!mostrarContrato && (
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <Button
              type="button"
              variant="outline-secondary"
              className="px-4 small"
              onClick={handleLimpiarFormulario}
            >
              Limpiar Todo
            </Button>
            <Button
              type="button"
              variant="primary"
              className="px-4 fw-bold"
              disabled={!rut || buscandoRut}
              onClick={() => {
                setMostrarContrato(true);
                toast.success('Estructura contractual desplegada.');
              }}
            >
              {existeTrabajador ? 'Continuar con Contrato →' : 'Configurar Contrato →'}
            </Button>
          </div>
        )}

        {/* SECCIÓN 2: ESTRUCTURA CONTRACTUAL */}
        {mostrarContrato && (
          <Form
            onSubmit={handleGuardarFormulario}
            className="animate__animated animate__fadeIn mt-5"
          >
            <h6 className="text-secondary border-bottom pb-2 mb-4 fw-bold text-uppercase d-flex align-items-center">
              <span
                className="bg-primary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2"
                style={{ width: '24px', height: '24px', fontSize: '12px' }}
              >
                2
              </span>
              Estructura Contractual
            </h6>

            <Row className="g-3 mb-4">
              <Col md={3}>
                <Form.Label className="small fw-semibold">Jornada Semanal</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    value={jornada}
                    onChange={(e) => setJornada(e.target.value)}
                    required
                  />
                  <InputGroup.Text className="bg-light text-muted">Hrs.</InputGroup.Text>
                </InputGroup>
              </Col>

              <Col md={4}>
                <Form.Label className="small fw-semibold">Sueldo Base Bruto</Form.Label>
                <InputGroup>
                  <InputGroup.Text className="bg-light text-muted">$</InputGroup.Text>
                  <Form.Control
                    type="number"
                    placeholder="650000"
                    value={sueldoBase}
                    onChange={(e) => setSueldoBase(e.target.value)}
                    required
                  />
                </InputGroup>
              </Col>

              <Col md={5} className="d-none d-md-block"></Col>

              <Col md={4}>
                <Form.Label className="small fw-semibold">Fecha de Inicio</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </Col>

              <Col md={4}>
                <Form.Label className="small fw-semibold">Fecha de Término</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaTermino}
                  onChange={(e) => setFechaTermino(e.target.value)}
                />
                <Form.Text style={{ fontSize: '0.75rem' }}>Dejar vacío si es indefinido.</Form.Text>
              </Col>
            </Row>

            <div className="d-flex flex-column flex-sm-row gap-3 pt-3 border-top">
              <Button
                type="submit"
                variant="success"
                className="px-4 py-2 fw-bold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" /> Registrando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-save-fill me-2"></i> Guardar Historial Contractual
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline-secondary"
                className="px-4 py-2 fw-semibold"
                onClick={() => setMostrarContrato(false)}
                disabled={loading}
              >
                ← Volver a Identidad
              </Button>
            </div>
          </Form>
        )}
      </Card.Body>
    </Card>
  );
}
