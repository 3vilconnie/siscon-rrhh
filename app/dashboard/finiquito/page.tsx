'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Card, Row, Col, Form, Button, Spinner, Badge, ListGroup, Table } from 'react-bootstrap';
import { Trabajador, Contrato } from '@/types';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  PROGRAMAS_FINIQUITO,
  CAUSALES_FINIQUITO,
  CAUSAL_FINIQUITO_DEFAULT_ID,
  CAMPOS_FINIQUITO,
  FIRMANTE_FINIQUITO_DEFAULT,
  calcularFiniquito,
  estimarDiasInhabiles,
  construirDatosFiniquito,
  formatearRutFiniquito,
  formatearMiles,
  type FirmanteFiniquito,
} from '@/lib/finiquito';
import { descargarExcelCalculo } from '@/lib/finiquitoCalculoXlsx';

export default function ModuloFiniquito() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda, 300);
  const [trabajadorSel, setTrabajadorSel] = useState<Trabajador | null>(null);
  const [contratoSelId, setContratoSelId] = useState<string>('');

  // Campos del cálculo (editables).
  const [fechaTermino, setFechaTermino] = useState('');
  const [sueldoImponible, setSueldoImponible] = useState<number>(0);
  const [diasInhabiles, setDiasInhabiles] = useState<number>(0);

  // Datos del documento.
  const [programaId, setProgramaId] = useState(PROGRAMAS_FINIQUITO[0].id);
  const [causalId, setCausalId] = useState(CAUSAL_FINIQUITO_DEFAULT_ID);
  const [articulo, setArticulo] = useState(
    CAUSALES_FINIQUITO.find((c) => c.id === CAUSAL_FINIQUITO_DEFAULT_ID)!.articulo,
  );
  const [terminos, setTerminos] = useState(
    CAUSALES_FINIQUITO.find((c) => c.id === CAUSAL_FINIQUITO_DEFAULT_ID)!.terminos,
  );
  const [firmante, setFirmante] = useState<FirmanteFiniquito>({ ...FIRMANTE_FINIQUITO_DEFAULT });
  const [ciudad, setCiudad] = useState('Arica');
  const [redactorIniciales, setRedactorIniciales] = useState('crh');

  const [generando, setGenerando] = useState<'pdf' | 'docx' | null>(null);

  const setFirmanteCampo = (campo: keyof FirmanteFiniquito, valor: string) =>
    setFirmante((prev) => ({ ...prev, [campo]: valor }));

  const seleccionarCausal = (id: string) => {
    setCausalId(id);
    const c = CAUSALES_FINIQUITO.find((x) => x.id === id);
    if (c) {
      setArticulo(c.articulo);
      setTerminos(c.terminos);
    }
  };

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trabajadores')
        .select(
          'rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, jornada, sueldo_base, fecha_inicio, fecha_termino)',
        )
        .order('primer_apellido');

      if (error) {
        toast.error('Error al cargar la base de datos de trabajadores.');
        console.error(error);
      }
      setTrabajadores((data as Trabajador[]) ?? []);
      setLoading(false);
    };
    cargar();
  }, []);

  const resultados = useMemo(() => {
    const q = busquedaDebounced.trim().toLowerCase();
    if (!q) return [];
    return trabajadores
      .filter((t) => {
        const nombre =
          `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido ?? ''}`.toLowerCase();
        return nombre.includes(q) || t.rut.toString().includes(q.replace(/\./g, ''));
      })
      .slice(0, 8);
  }, [busquedaDebounced, trabajadores]);

  const contratoSel: Contrato | null = useMemo(() => {
    if (!trabajadorSel) return null;
    return trabajadorSel.contratos?.find((c) => c.id === contratoSelId) ?? null;
  }, [trabajadorSel, contratoSelId]);

  // Al elegir un contrato, se siembran los campos del cálculo.
  const aplicarContrato = (contrato: Contrato | null) => {
    const term = contrato?.fecha_termino ?? '';
    const sueldo = contrato?.sueldo_base ?? 0;
    setFechaTermino(term);
    setSueldoImponible(sueldo);
    if (contrato && term) {
      const { diasHabiles } = calcularFiniquito({
        fechaInicio: contrato.fecha_inicio,
        fechaTermino: term,
        sueldoImponible: sueldo,
        diasInhabiles: 0,
      });
      setDiasInhabiles(estimarDiasInhabiles(term, diasHabiles));
    } else {
      setDiasInhabiles(0);
    }
  };

  const seleccionarTrabajador = (t: Trabajador) => {
    setTrabajadorSel(t);
    setBusqueda('');
    const contratos = t.contratos ?? [];
    // Preselecciona el contrato más reciente con fecha de término (el que finiquita).
    const conTermino = contratos.filter((c) => c.fecha_termino);
    const elegido =
      [...conTermino].sort((a, b) =>
        (b.fecha_termino ?? '').localeCompare(a.fecha_termino ?? ''),
      )[0] ?? [...contratos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0];
    setContratoSelId(elegido?.id ?? '');
    aplicarContrato(elegido ?? null);
  };

  const cambiarContrato = (id: string) => {
    setContratoSelId(id);
    const c = trabajadorSel?.contratos?.find((x) => x.id === id) ?? null;
    aplicarContrato(c);
  };

  // Estimación sugerida de días inhábiles según la fecha de término actual.
  const estimacionInhabiles = useMemo(() => {
    if (!contratoSel || !fechaTermino) return null;
    const { diasHabiles } = calcularFiniquito({
      fechaInicio: contratoSel.fecha_inicio,
      fechaTermino,
      sueldoImponible,
      diasInhabiles: 0,
    });
    return estimarDiasInhabiles(fechaTermino, diasHabiles);
  }, [contratoSel, fechaTermino, sueldoImponible]);

  // Datos y resultado del cálculo (en vivo).
  const calculo = useMemo(() => {
    if (!trabajadorSel || !contratoSel || !fechaTermino) return null;
    const programa = PROGRAMAS_FINIQUITO.find((p) => p.id === programaId);
    const causal = { id: causalId, articulo, terminos, etiqueta: '' };
    const contratoAjustado: Contrato = {
      ...contratoSel,
      fecha_termino: fechaTermino,
      sueldo_base: sueldoImponible,
    };
    return construirDatosFiniquito(trabajadorSel, contratoAjustado, {
      ciudad,
      redactorIniciales,
      causal,
      programa,
      firmante,
      diasInhabiles,
    });
  }, [
    trabajadorSel,
    contratoSel,
    fechaTermino,
    sueldoImponible,
    diasInhabiles,
    programaId,
    causalId,
    articulo,
    terminos,
    ciudad,
    redactorIniciales,
    firmante,
  ]);

  const puedeGenerar = !!calculo && sueldoImponible > 0 && !!fechaTermino;

  const generar = async (formato: 'pdf' | 'docx') => {
    if (!calculo || !trabajadorSel) return;
    if (!fechaTermino) {
      toast.error('Indica la fecha de término del contrato.');
      return;
    }
    if (sueldoImponible <= 0) {
      toast.error('Indica el sueldo imponible.');
      return;
    }

    setGenerando(formato);
    const toastId = toast.loading(`Generando finiquito ${formato.toUpperCase()}...`);
    try {
      const res = await fetch('/api/finiquito/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, datos: calculo.datos }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finiquito_${trabajadorSel.rut}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(`Finiquito ${formato.toUpperCase()} generado.`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el finiquito.', {
        id: toastId,
        duration: 6000,
      });
    } finally {
      setGenerando(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 text-secondary">
        <Spinner animation="border" size="sm" role="status" /> Cargando trabajadores...
      </div>
    );
  }

  const r = calculo?.resultado;

  return (
    <div className="container-fluid" style={{ maxWidth: '1100px' }}>
      <div className="mb-4 d-flex justify-content-between align-items-start gap-3">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb small mb-1">
              <li className="breadcrumb-item">
                <Link href="/dashboard/documentos" className="text-decoration-none">
                  Notificación
                </Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Cálculo finiquito
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Finiquito
              </li>
            </ol>
          </nav>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-cash-coin text-success me-2"></i>
            Cálculo y Emisión de Finiquito
          </h3>
          <p className="text-muted small m-0">
            Calcula el feriado proporcional del trabajador (según su contrato) y emite el documento
            de finiquito en PDF o Word.
          </p>
        </div>
        <div className="d-flex gap-2 flex-shrink-0">
          <Link href="/dashboard/finiquito/masivo" className="btn btn-outline-success">
            <i className="bi bi-people-fill me-1"></i> Finiquito masivo
          </Link>
          <Link href="/dashboard/documentos" className="btn btn-outline-secondary">
            <i className="bi bi-file-earmark-word me-1"></i> Documentos
          </Link>
        </div>
      </div>

      <Row className="g-4">
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
        <Col lg={7}>
          {/* Paso 1: Trabajador */}
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                <Badge bg="success" className="me-2">
                  1
                </Badge>
                Trabajador
              </h6>

              {trabajadorSel ? (
                <div className="d-flex justify-content-between align-items-center bg-light rounded p-3">
                  <div>
                    <div className="fw-bold text-dark text-uppercase">
                      {trabajadorSel.nombres} {trabajadorSel.primer_apellido}{' '}
                      {trabajadorSel.segundo_apellido ?? ''}
                    </div>
                    <div className="text-muted small font-monospace">
                      {formatearRutFiniquito(trabajadorSel.rut, trabajadorSel.dv)}
                    </div>
                  </div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      setTrabajadorSel(null);
                      setContratoSelId('');
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por RUT, nombre o apellidos..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    autoFocus
                  />
                  {resultados.length > 0 && (
                    <ListGroup className="mt-2 shadow-sm">
                      {resultados.map((t) => (
                        <ListGroup.Item
                          key={t.rut}
                          action
                          onClick={() => seleccionarTrabajador(t)}
                          className="d-flex justify-content-between align-items-center"
                        >
                          <span className="text-uppercase">
                            {t.nombres} {t.primer_apellido} {t.segundo_apellido ?? ''}
                          </span>
                          <span className="text-muted small font-monospace">
                            {formatearRutFiniquito(t.rut, t.dv)}
                          </span>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                  {busquedaDebounced.trim() && resultados.length === 0 && (
                    <Form.Text className="text-muted">Sin coincidencias.</Form.Text>
                  )}
                </>
              )}
            </Card.Body>
          </Card>

          {/* Paso 2: Contrato y datos del cálculo */}
          {trabajadorSel && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                  <Badge bg="success" className="me-2">
                    2
                  </Badge>
                  Contrato y bases del cálculo
                </h6>

                {(trabajadorSel.contratos ?? []).length === 0 ? (
                  <div className="text-muted small">
                    Este trabajador no tiene contratos registrados.
                  </div>
                ) : (
                  <Row className="g-3">
                    <Col xs={12}>
                      <Form.Label className="small fw-bold text-secondary">Contrato</Form.Label>
                      <Form.Select
                        value={contratoSelId}
                        onChange={(e) => cambiarContrato(e.target.value)}
                      >
                        {[...(trabajadorSel.contratos ?? [])]
                          .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {new Date(c.fecha_inicio).toLocaleDateString('es-CL')} →{' '}
                              {c.fecha_termino
                                ? new Date(c.fecha_termino).toLocaleDateString('es-CL')
                                : 'Indefinido'}
                              {c.sueldo_base ? ` · $${c.sueldo_base.toLocaleString('es-CL')}` : ''}
                            </option>
                          ))}
                      </Form.Select>
                    </Col>

                    <Col xs={6} md={4}>
                      <Form.Label className="small fw-bold text-secondary">Fecha inicio</Form.Label>
                      <Form.Control type="date" value={contratoSel?.fecha_inicio ?? ''} disabled />
                    </Col>
                    <Col xs={6} md={4}>
                      <Form.Label className="small fw-bold text-secondary">
                        Fecha término
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={fechaTermino}
                        onChange={(e) => setFechaTermino(e.target.value)}
                      />
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Label className="small fw-bold text-secondary">
                        Sueldo imponible
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        value={sueldoImponible || ''}
                        onChange={(e) => setSueldoImponible(Number(e.target.value) || 0)}
                      />
                    </Col>

                    {contratoSel && !contratoSel.fecha_termino && (
                      <Col xs={12}>
                        <div className="alert alert-warning py-2 small mb-0">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          El contrato es indefinido: indica manualmente la fecha de término para el
                          finiquito.
                        </div>
                      </Col>
                    )}
                  </Row>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Paso 3: Feriado proporcional (cálculo editable) */}
          {calculo && r && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                  <Badge bg="success" className="me-2">
                    3
                  </Badge>
                  Feriado proporcional
                </h6>

                <Table size="sm" borderless className="small mb-3">
                  <tbody>
                    <tr>
                      <td className="text-muted">Valor sueldo por día (sueldo / 30)</td>
                      <td className="text-end fw-semibold font-monospace">
                        ${formatearMiles(r.valorDia)}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">
                        Antigüedad ({r.meses} meses y {r.dias} días)
                      </td>
                      <td className="text-end fw-semibold font-monospace">
                        {r.diasHabiles.toLocaleString('es-CL', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        días hábiles
                      </td>
                    </tr>
                  </tbody>
                </Table>

                <Row className="g-3 align-items-end">
                  <Col xs={12} md={6}>
                    <Form.Label className="small fw-bold text-secondary">
                      Días inhábiles del feriado
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step={1}
                      value={diasInhabiles}
                      onChange={(e) => setDiasInhabiles(Number(e.target.value) || 0)}
                    />
                    <Form.Text className="text-muted">
                      Sábados, domingos y festivos del período proyectado.
                      {estimacionInhabiles !== null && estimacionInhabiles !== diasInhabiles && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 ms-1 align-baseline text-decoration-none"
                          onClick={() => setDiasInhabiles(estimacionInhabiles)}
                        >
                          usar estimación ({estimacionInhabiles})
                        </Button>
                      )}
                    </Form.Text>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="text-muted small">Total días feriado (FP)</div>
                    <div className="fs-5 fw-bold text-success font-monospace">
                      {r.fp.toLocaleString('es-CL', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="text-muted small">Total a pagar</div>
                    <div className="fs-5 fw-bold text-success font-monospace">
                      ${formatearMiles(r.total)}
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* Paso 4: Datos del documento */}
          {calculo && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                  <Badge bg="success" className="me-2">
                    4
                  </Badge>
                  Datos del documento
                </h6>

                <Row className="g-3">
                  <Col xs={12}>
                    <Form.Label className="small fw-bold text-secondary">
                      Programa / Proyecto (cabecera)
                    </Form.Label>
                    <Form.Select value={programaId} onChange={(e) => setProgramaId(e.target.value)}>
                      {PROGRAMAS_FINIQUITO.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col xs={12}>
                    <Form.Label className="small fw-bold text-secondary">
                      Causal de término
                    </Form.Label>
                    <Form.Select
                      value={causalId}
                      onChange={(e) => seleccionarCausal(e.target.value)}
                    >
                      {CAUSALES_FINIQUITO.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Label className="small fw-bold text-secondary">Artículo</Form.Label>
                    <Form.Control
                      type="text"
                      value={articulo}
                      onChange={(e) => setArticulo(e.target.value)}
                    />
                  </Col>
                  <Col xs={12} md={8}>
                    <Form.Label className="small fw-bold text-secondary">
                      Términos (razón)
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={terminos}
                      onChange={(e) => setTerminos(e.target.value)}
                    />
                  </Col>

                  <Col xs={6} md={4}>
                    <Form.Label className="small fw-bold text-secondary">Ciudad</Form.Label>
                    <Form.Control
                      type="text"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Label className="small fw-bold text-secondary">
                      Iniciales redactor
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={redactorIniciales}
                      onChange={(e) => setRedactorIniciales(e.target.value)}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* Paso 5: Firmante */}
          {calculo && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-uppercase text-secondary small m-0">
                    <Badge bg="success" className="me-2">
                      5
                    </Badge>
                    Firmante
                  </h6>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-decoration-none p-0 small"
                    onClick={() => setFirmante({ ...FIRMANTE_FINIQUITO_DEFAULT })}
                  >
                    <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar predeterminado
                  </Button>
                </div>
                <Row className="g-3">
                  <Col xs={4} md={2}>
                    <Form.Label className="small fw-bold text-secondary">Trato</Form.Label>
                    <Form.Select
                      value={firmante.tratamiento}
                      onChange={(e) => setFirmanteCampo('tratamiento', e.target.value)}
                    >
                      <option>Don</option>
                      <option>Doña</option>
                    </Form.Select>
                  </Col>
                  <Col xs={8} md={10}>
                    <Form.Label className="small fw-bold text-secondary">
                      Nombre completo
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.nombre}
                      onChange={(e) => setFirmanteCampo('nombre', e.target.value)}
                    />
                  </Col>
                  <Col xs={12} md={5}>
                    <Form.Label className="small fw-bold text-secondary">
                      Nombre bajo la firma
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.nombre_corto}
                      onChange={(e) => setFirmanteCampo('nombre_corto', e.target.value)}
                    />
                  </Col>
                  <Col xs={7} md={4}>
                    <Form.Label className="small fw-bold text-secondary">Cargo</Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.cargo}
                      onChange={(e) => setFirmanteCampo('cargo', e.target.value)}
                    />
                  </Col>
                  <Col xs={5} md={3}>
                    <Form.Label className="small fw-bold text-secondary">RUT</Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.rut}
                      onChange={(e) => setFirmanteCampo('rut', e.target.value)}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Label className="small fw-bold text-secondary">Profesión</Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.profesion}
                      onChange={(e) => setFirmanteCampo('profesion', e.target.value)}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* Acciones */}
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <p className="text-muted small mb-3">
                <i className="bi bi-1-circle me-1"></i>Descarga el Excel del cálculo y luego genera
                el documento de finiquito.
              </p>
              <div className="d-flex gap-2 justify-content-end flex-wrap">
                <Button
                  variant="outline-secondary"
                  disabled={!puedeGenerar}
                  onClick={() => calculo && descargarExcelCalculo(calculo.datos)}
                  title="Excel con el detalle del cálculo (hoja Principal)"
                >
                  <i className="bi bi-file-earmark-excel me-1"></i>
                  Cálculo Excel
                </Button>
                <Button
                  variant="outline-success"
                  disabled={!puedeGenerar || generando !== null}
                  onClick={() => generar('docx')}
                >
                  <i className="bi bi-file-earmark-word me-1"></i>
                  {generando === 'docx' ? 'Generando...' : 'Descargar Word'}
                </Button>
                <Button
                  variant="success"
                  disabled={!puedeGenerar || generando !== null}
                  onClick={() => generar('pdf')}
                >
                  <i className="bi bi-file-earmark-pdf me-1"></i>
                  {generando === 'pdf' ? 'Generando...' : 'Generar PDF'}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* COLUMNA DERECHA: RESUMEN */}
        <Col lg={5}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Header className="bg-dark text-white fw-bold small py-2">
              <i className="bi bi-eye me-1"></i> Resumen del finiquito
            </Card.Header>
            <Card.Body className="p-0">
              {calculo && r ? (
                <Table size="sm" className="mb-0 small">
                  <tbody>
                    <tr>
                      <td className="text-muted ps-3">Trabajador</td>
                      <td className="fw-semibold">
                        {calculo.datos.trabajador.nombre_completo_upper}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted ps-3">RUT</td>
                      <td className="fw-semibold font-monospace">
                        {calculo.datos.trabajador.rut_formateado}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted ps-3">Período</td>
                      <td className="fw-semibold">
                        {new Date(calculo.datos.contrato.fecha_inicio).toLocaleDateString('es-CL')}{' '}
                        →{' '}
                        {new Date(calculo.datos.contrato.fecha_termino).toLocaleDateString('es-CL')}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted ps-3">Causal</td>
                      <td className="fw-semibold">
                        Art. {articulo} — {terminos}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted ps-3">Feriado proporcional</td>
                      <td className="fw-semibold">{calculo.datos.finiquito.fp_texto} días</td>
                    </tr>
                    <tr className="table-success">
                      <td className="ps-3 fw-bold">Total a pagar</td>
                      <td className="fw-bold">${calculo.datos.finiquito.total_texto}</td>
                    </tr>
                    <tr>
                      <td className="text-muted ps-3">Son</td>
                      <td className="fst-italic" style={{ fontSize: '0.72rem' }}>
                        {calculo.datos.finiquito.total_palabras}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              ) : (
                <div className="text-muted small text-center py-4">
                  Selecciona un trabajador y un contrato con fecha de término para calcular.
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0 mb-3">
            <Card.Header className="bg-light fw-bold small py-2 text-secondary">
              <i className="bi bi-braces me-1"></i> Marcadores para tu plantilla Word
            </Card.Header>
            <Card.Body className="p-3" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <p className="text-muted" style={{ fontSize: '0.72rem' }}>
                Escribe estos marcadores en <code>plantillas/finiquito.docx</code>. Carbone los
                reemplaza al generar (igual que la combinación de correspondencia).
              </p>
              {CAMPOS_FINIQUITO.map((c) => (
                <div key={c.marcador} className="mb-2">
                  <code className="d-block text-success" style={{ fontSize: '0.72rem' }}>
                    {c.marcador}
                  </code>
                  <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {c.descripcion}
                  </span>
                </div>
              ))}
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Body className="p-3 small text-muted">
              <div className="fw-bold text-secondary mb-1">
                <i className="bi bi-info-circle me-1"></i> Cómo se calcula
              </div>
              <p className="mb-1">
                El feriado proporcional usa el factor legal de 1,25 días hábiles por mes de servicio
                (15 días al año), sobre la antigüedad del contrato.
              </p>
              <p className="mb-0">
                Los <strong>días inhábiles</strong> (fines de semana y festivos del período) se
                estiman automáticamente y puedes ajustarlos, tal como se hacía en la planilla Excel.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
