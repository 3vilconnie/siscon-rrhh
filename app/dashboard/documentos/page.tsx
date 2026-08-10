'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Card, Row, Col, Form, Button, Spinner, Badge, ListGroup, Table } from 'react-bootstrap';
import { Trabajador, Contrato } from '@/types';
import {
  PLANTILLAS,
  CAMPOS_DISPONIBLES,
  NOTIFICACION_DEFAULTS,
  FIRMANTE_DEFAULT,
  CAUSALES,
  CAUSAL_DEFAULT_ID,
  construirDatosDocumento,
  formatearRut,
  type PlantillaDoc,
  type DatosNotificacionInput,
} from '@/lib/plantillas';
import { useDebounce } from '@/lib/hooks/useDebounce';

export default function ModuloGeneracionDocumentos() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);

  const [plantillaId, setPlantillaId] = useState<string>(PLANTILLAS[0]?.id ?? '');
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda, 300);
  const [trabajadorSel, setTrabajadorSel] = useState<Trabajador | null>(null);
  const [contratoSelId, setContratoSelId] = useState<string>('');
  const [ciudad, setCiudad] = useState('Arica');
  const [generando, setGenerando] = useState<'pdf' | 'docx' | null>(null);

  // Datos propios de la Notificación de Fin de Contrato.
  const [notif, setNotif] = useState<DatosNotificacionInput>({
    numero: '',
    ...NOTIFICACION_DEFAULTS,
  });
  const setNotifCampo = (campo: keyof DatosNotificacionInput, valor: string) =>
    setNotif((prev) => ({ ...prev, [campo]: valor }));

  // Causal seleccionada del catálogo (fija artículo + texto de la causal).
  const [causalId, setCausalId] = useState(CAUSAL_DEFAULT_ID);
  const seleccionarCausal = (id: string) => {
    setCausalId(id);
    const c = CAUSALES.find((x) => x.id === id);
    if (c) setNotif((prev) => ({ ...prev, articulo: c.articulo, causal: c.causal }));
  };

  // Firmante (editable; por defecto el director actual).
  const [firmante, setFirmante] = useState({ ...FIRMANTE_DEFAULT });
  const setFirmanteCampo = (campo: keyof typeof FIRMANTE_DEFAULT, valor: string) =>
    setFirmante((prev) => ({ ...prev, [campo]: valor }));

  const plantilla: PlantillaDoc | undefined = useMemo(
    () => PLANTILLAS.find((p) => p.id === plantillaId),
    [plantillaId],
  );

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

  const seleccionarTrabajador = (t: Trabajador) => {
    setTrabajadorSel(t);
    setBusqueda('');
    // Preselecciona el contrato vigente (o el más reciente).
    const contratos = t.contratos ?? [];
    const vigente = contratos.find(
      (c) => !c.fecha_termino || new Date(c.fecha_termino) >= new Date(),
    );
    const elegido =
      vigente ?? [...contratos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0];
    setContratoSelId(elegido?.id ?? '');
  };

  const contratoSel: Contrato | null = useMemo(() => {
    if (!trabajadorSel) return null;
    return trabajadorSel.contratos?.find((c) => c.id === contratoSelId) ?? null;
  }, [trabajadorSel, contratoSelId]);

  const datosPreview = useMemo(() => {
    if (!trabajadorSel) return null;
    return construirDatosDocumento(trabajadorSel, contratoSel, {
      ciudad,
      notificacion: plantilla?.requiereDatosNotificacion ? notif : undefined,
      firmante: plantilla?.requiereFirmante ? firmante : undefined,
    });
  }, [trabajadorSel, contratoSel, ciudad, plantilla, notif, firmante]);

  const puedeGenerar =
    !!plantilla && !!trabajadorSel && (!plantilla.requiereContrato || !!contratoSel);

  const generar = async (formato: 'pdf' | 'docx') => {
    if (!plantilla || !trabajadorSel || !datosPreview) return;
    if (plantilla.requiereContrato && !contratoSel) {
      toast.error('Esta plantilla requiere seleccionar un contrato.');
      return;
    }

    setGenerando(formato);
    const toastId = toast.loading(`Generando ${formato.toUpperCase()}...`);
    try {
      const res = await fetch('/api/documentos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantillaId: plantilla.id, formato, datos: datosPreview }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plantilla.id}_${trabajadorSel.rut}.${formato}`;
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

  return (
    <div className="container-fluid" style={{ maxWidth: '1100px' }}>
      <div className="mb-4 d-flex justify-content-between align-items-start gap-3">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-file-earmark-word text-primary me-2"></i>
            Generación de Documentos
          </h3>
          <p className="text-muted small m-0">
            Combina una plantilla Word con los datos del trabajador (estilo combinación de
            correspondencia) y descárgala en PDF o Word.
          </p>
        </div>
        <div className="d-flex gap-2 flex-shrink-0">
          <Link href="/dashboard/finiquito" className="btn btn-outline-success">
            <i className="bi bi-cash-coin me-1"></i> Cálculo finiquito
          </Link>
          <Link href="/dashboard/documentos/masivo" className="btn btn-outline-primary">
            <i className="bi bi-people-fill me-1"></i> Notificación masiva
          </Link>
        </div>
      </div>

      <Row className="g-4">
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
        <Col lg={7}>
          {/* Paso 1: Plantilla */}
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                <Badge bg="primary" className="me-2">
                  1
                </Badge>
                Plantilla
              </h6>
              <Form.Select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
                {PLANTILLAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Form.Select>
              {plantilla && <p className="text-muted small mt-2 m-0">{plantilla.descripcion}</p>}
            </Card.Body>
          </Card>

          {/* Paso 2: Trabajador */}
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                <Badge bg="primary" className="me-2">
                  2
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
                      {formatearRut(trabajadorSel.rut, trabajadorSel.dv)}
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
                            {formatearRut(t.rut, t.dv)}
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

          {/* Paso 3: Contrato */}
          {plantilla?.requiereContrato && trabajadorSel && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                  <Badge bg="primary" className="me-2">
                    3
                  </Badge>
                  Contrato
                </h6>
                {(trabajadorSel.contratos ?? []).length === 0 ? (
                  <div className="text-muted small">
                    Este trabajador no tiene contratos registrados.
                  </div>
                ) : (
                  <Form.Select
                    value={contratoSelId}
                    onChange={(e) => setContratoSelId(e.target.value)}
                  >
                    {[...(trabajadorSel.contratos ?? [])]
                      .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
                      .map((c) => {
                        const vigente = !c.fecha_termino || new Date(c.fecha_termino) >= new Date();
                        return (
                          <option key={c.id} value={c.id}>
                            {new Date(c.fecha_inicio).toLocaleDateString('es-CL')} →{' '}
                            {c.fecha_termino
                              ? new Date(c.fecha_termino).toLocaleDateString('es-CL')
                              : 'Indefinido'}
                            {vigente ? ' (Vigente)' : ''}
                          </option>
                        );
                      })}
                  </Form.Select>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Paso 4: Datos de la notificación (solo para esa plantilla) */}
          {plantilla?.requiereDatosNotificacion && trabajadorSel && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                  <Badge bg="primary" className="me-2">
                    4
                  </Badge>
                  Datos de la notificación
                </h6>

                {contratoSel && !contratoSel.fecha_termino && (
                  <div className="alert alert-warning py-2 small mb-3">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    El contrato seleccionado es indefinido. Indica manualmente la fecha de término
                    abajo.
                  </div>
                )}

                <Row className="g-3">
                  <Col xs={6} md={4}>
                    <Form.Label className="small fw-bold text-secondary">Notificación Nº</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="1234"
                      value={notif.numero}
                      onChange={(e) => setNotifCampo('numero', e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Label className="small fw-bold text-secondary">
                      Fecha notificación
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={notif.fecha_notificacion}
                      onChange={(e) => setNotifCampo('fecha_notificacion', e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Label className="small fw-bold text-secondary">
                      Fecha término (FIN_CONT)
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={notif.fin_contrato || contratoSel?.fecha_termino || ''}
                      onChange={(e) => setNotifCampo('fin_contrato', e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={3}>
                    <Form.Label className="small fw-bold text-secondary">Iniciales redactor</Form.Label>
                    <Form.Control
                      type="text"
                      value={notif.redactor_iniciales}
                      onChange={(e) => setNotifCampo('redactor_iniciales', e.target.value)}
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="small fw-bold text-secondary">
                      Causal de término (artículo del Código del Trabajo)
                    </Form.Label>
                    <Form.Select value={causalId} onChange={(e) => seleccionarCausal(e.target.value)}>
                      {CAUSALES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </Form.Select>
                    <div className="bg-light rounded p-2 mt-2 small">
                      <span className="text-muted">Artículo:</span>{' '}
                      <strong>{notif.articulo}</strong>
                      <span className="text-muted d-block mt-1">Texto en el documento:</span>
                      <span className="fst-italic">&ldquo;{notif.causal}&rdquo;</span>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* Paso 5: Firmante (editable) */}
          {plantilla?.requiereFirmante && trabajadorSel && (
            <Card className="shadow-sm border-0 mb-3">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-uppercase text-secondary small m-0">
                    <Badge bg="primary" className="me-2">
                      5
                    </Badge>
                    Firmante
                  </h6>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-decoration-none p-0 small"
                    onClick={() => setFirmante({ ...FIRMANTE_DEFAULT })}
                  >
                    <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar predeterminado
                  </Button>
                </div>
                <Row className="g-3">
                  <Col xs={12} md={6}>
                    <Form.Label className="small fw-bold text-secondary">Nombre</Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.nombre}
                      onChange={(e) => setFirmanteCampo('nombre', e.target.value)}
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
                  <Col xs={5} md={2}>
                    <Form.Label className="small fw-bold text-secondary">RUT</Form.Label>
                    <Form.Control
                      type="text"
                      value={firmante.rut}
                      onChange={(e) => setFirmanteCampo('rut', e.target.value)}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* Ciudad + acciones */}
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium text-secondary small">
                  Ciudad de emisión
                </Form.Label>
                <Form.Control
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  style={{ maxWidth: '220px' }}
                />
              </Form.Group>

              <div className="d-flex gap-2 justify-content-end border-top pt-3">
                <Button
                  variant="outline-primary"
                  disabled={!puedeGenerar || generando !== null}
                  onClick={() => generar('docx')}
                >
                  <i className="bi bi-file-earmark-word me-1"></i>
                  {generando === 'docx' ? 'Generando...' : 'Descargar Word'}
                </Button>
                <Button
                  variant="danger"
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

        {/* COLUMNA DERECHA: PREVISUALIZACIÓN DE DATOS + REFERENCIA */}
        <Col lg={5}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Header className="bg-dark text-white fw-bold small py-2">
              <i className="bi bi-eye me-1"></i> Datos que se combinarán
            </Card.Header>
            <Card.Body className="p-0">
              {datosPreview ? (
                <Table size="sm" className="mb-0 small">
                  <tbody>
                    <tr>
                      <td className="text-muted ps-3">Nombre</td>
                      <td className="fw-semibold">{datosPreview.trabajador.nombre_completo}</td>
                    </tr>
                    <tr>
                      <td className="text-muted ps-3">RUT</td>
                      <td className="fw-semibold font-monospace">
                        {datosPreview.trabajador.rut_formateado}
                      </td>
                    </tr>
                    {datosPreview.contrato ? (
                      <>
                        <tr>
                          <td className="text-muted ps-3">Inicio contrato</td>
                          <td className="fw-semibold">
                            {new Date(datosPreview.contrato.fecha_inicio).toLocaleDateString(
                              'es-CL',
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted ps-3">Término</td>
                          <td className="fw-semibold">
                            {datosPreview.contrato.fecha_termino_texto}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted ps-3">Sueldo base</td>
                          <td className="fw-semibold">
                            ${datosPreview.contrato.sueldo_base.toLocaleString('es-CL')}
                          </td>
                        </tr>
                      </>
                    ) : (
                      plantilla?.requiereContrato && (
                        <tr>
                          <td colSpan={2} className="text-warning ps-3 py-2">
                            <i className="bi bi-exclamation-triangle me-1"></i> Selecciona un
                            contrato.
                          </td>
                        </tr>
                      )
                    )}
                    <tr>
                      <td className="text-muted ps-3">Ciudad / fecha</td>
                      <td className="fw-semibold">
                        {datosPreview.documento.ciudad},{' '}
                        {new Date(datosPreview.documento.fecha_emision).toLocaleDateString('es-CL')}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              ) : (
                <div className="text-muted small text-center py-4">
                  Selecciona un trabajador para previsualizar.
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Header className="bg-light fw-bold small py-2 text-secondary">
              <i className="bi bi-braces me-1"></i> Marcadores para tu plantilla Word
            </Card.Header>
            <Card.Body className="p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <p className="text-muted" style={{ fontSize: '0.72rem' }}>
                Escribe estos marcadores en tu documento Word. Carbone los reemplazará al generar.
              </p>
              {CAMPOS_DISPONIBLES.map((c) => (
                <div key={c.marcador} className="mb-2">
                  <code className="d-block text-primary" style={{ fontSize: '0.72rem' }}>
                    {c.marcador}
                  </code>
                  <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {c.descripcion}
                  </span>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
