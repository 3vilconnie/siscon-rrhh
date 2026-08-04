'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Card, Row, Col, Form, Button, Spinner, Badge, ListGroup, Table } from 'react-bootstrap';
import { Trabajador, Contrato } from '@/types';
import {
  CAUSALES,
  CAUSAL_DEFAULT_ID,
  FIRMANTE_DEFAULT,
  construirDatosDocumento,
  formatearRut,
} from '@/lib/plantillas';
import { useDebounce } from '@/lib/hooks/useDebounce';

const PLANTILLA_ID = 'notificacion-fin-contrato';

interface Seleccionado {
  rut: number;
  trabajador: Trabajador;
  contratoId: string;
  finContrato: string; // ISO
}

/** Contrato "que vence" de un trabajador: el vigente o el de término más reciente. */
function contratoPorDefecto(t: Trabajador): Contrato | null {
  const contratos = t.contratos ?? [];
  if (contratos.length === 0) return null;
  const vigente = contratos.find(
    (c) => !c.fecha_termino || new Date(c.fecha_termino) >= new Date(),
  );
  return (
    vigente ??
    [...contratos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0] ??
    null
  );
}

export default function NotificacionMasivaPage() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);

  // Ajustes compartidos del lote
  const [causalId, setCausalId] = useState(CAUSAL_DEFAULT_ID);
  const [fechaNotif, setFechaNotif] = useState(new Date().toISOString().split('T')[0]);
  const [redactor, setRedactor] = useState('crh');
  const [ciudad, setCiudad] = useState('Arica');
  const [firmante, setFirmante] = useState({ ...FIRMANTE_DEFAULT });
  const setFirmanteCampo = (campo: keyof typeof FIRMANTE_DEFAULT, valor: string) =>
    setFirmante((prev) => ({ ...prev, [campo]: valor }));

  // Selección de trabajadores
  const [seleccionados, setSeleccionados] = useState<Seleccionado[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda, 300);
  const [mes, setMes] = useState(''); // "YYYY-MM"

  const [generando, setGenerando] = useState<'pdf' | 'docx' | null>(null);

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
        toast.error('Error al cargar los trabajadores.');
        console.error(error);
      }
      setTrabajadores((data as Trabajador[]) ?? []);
      setLoading(false);
    };
    cargar();
  }, []);

  const yaAgregado = (rut: number) => seleccionados.some((s) => s.rut === rut);

  const agregar = (t: Trabajador, contrato?: Contrato | null) => {
    if (yaAgregado(t.rut)) return;
    const c = contrato ?? contratoPorDefecto(t);
    setSeleccionados((prev) => [
      ...prev,
      { rut: t.rut, trabajador: t, contratoId: c?.id ?? '', finContrato: c?.fecha_termino ?? '' },
    ]);
  };

  const quitar = (rut: number) => setSeleccionados((prev) => prev.filter((s) => s.rut !== rut));

  const actualizarSel = (rut: number, cambios: Partial<Seleccionado>) =>
    setSeleccionados((prev) => prev.map((s) => (s.rut === rut ? { ...s, ...cambios } : s)));

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

  // Agregar todos los que tienen un contrato que vence en el mes elegido
  const agregarPorMes = () => {
    if (!mes) return toast.error('Elige un mes.');
    let añadidos = 0;
    trabajadores.forEach((t) => {
      if (yaAgregado(t.rut)) return;
      const contrato = (t.contratos ?? []).find((c) => c.fecha_termino?.startsWith(mes));
      if (contrato) {
        agregar(t, contrato);
        añadidos++;
      }
    });
    if (añadidos === 0) toast('No hay contratos que venzan en ese mes.', { icon: 'ℹ️' });
    else toast.success(`${añadidos} trabajador(es) agregado(s).`);
  };

  const causal = useMemo(() => CAUSALES.find((c) => c.id === causalId)!, [causalId]);

  const generar = async (formato: 'pdf' | 'docx') => {
    if (seleccionados.length === 0) return toast.error('Agrega al menos un trabajador.');
    const sinFin = seleccionados.filter((s) => !s.finContrato);
    if (sinFin.length > 0)
      return toast.error(`Falta la fecha de término en ${sinFin.length} trabajador(es).`);

    const documentos = seleccionados.map((s) => {
      const contrato = s.trabajador.contratos?.find((c) => c.id === s.contratoId) ?? null;
      return construirDatosDocumento(s.trabajador, contrato, {
        ciudad,
        firmante,
        notificacion: {
          numero: '',
          fecha_notificacion: fechaNotif,
          articulo: causal.articulo,
          causal: causal.causal,
          fin_contrato: s.finContrato,
          redactor_iniciales: redactor,
        },
      });
    });

    setGenerando(formato);
    const toastId = toast.loading(`Generando ${seleccionados.length} notificaciones...`);
    try {
      const res = await fetch('/api/documentos/generar-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantillaId: PLANTILLA_ID, formato, documentos }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notificaciones_${seleccionados.length}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Documento generado.', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar.', {
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
      <div className="mb-3">
        <Link href="/dashboard/documentos" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a Documentos
        </Link>
      </div>
      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-people-fill text-primary me-2"></i>
          Notificación de Fin de Contrato — Masiva
        </h3>
        <p className="text-muted small m-0">
          Genera un único documento con una notificación por página para todos los trabajadores
          seleccionados.
        </p>
      </div>

      <Row className="g-4">
        {/* IZQUIERDA: ajustes compartidos */}
        <Col lg={5}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                Datos comunes del lote
              </h6>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-secondary">Causal de término</Form.Label>
                <Form.Select value={causalId} onChange={(e) => setCausalId(e.target.value)}>
                  {CAUSALES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.etiqueta}
                    </option>
                  ))}
                </Form.Select>
                <div className="bg-light rounded p-2 mt-2 small">
                  <span className="text-muted">Artículo:</span> <strong>{causal.articulo}</strong>
                  <span className="fst-italic d-block mt-1">&ldquo;{causal.causal}&rdquo;</span>
                </div>
              </Form.Group>
              <Row className="g-3">
                <Col xs={6}>
                  <Form.Label className="small fw-bold text-secondary">
                    Fecha notificación
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={fechaNotif}
                    onChange={(e) => setFechaNotif(e.target.value)}
                  />
                </Col>
                <Col xs={3}>
                  <Form.Label className="small fw-bold text-secondary">Iniciales</Form.Label>
                  <Form.Control value={redactor} onChange={(e) => setRedactor(e.target.value)} />
                </Col>
                <Col xs={3}>
                  <Form.Label className="small fw-bold text-secondary">Ciudad</Form.Label>
                  <Form.Control value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-uppercase text-secondary small m-0">Firmante</h6>
                <Button
                  variant="link"
                  size="sm"
                  className="text-decoration-none p-0 small"
                  onClick={() => setFirmante({ ...FIRMANTE_DEFAULT })}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Predeterminado
                </Button>
              </div>
              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary">Nombre</Form.Label>
                <Form.Control
                  value={firmante.nombre}
                  onChange={(e) => setFirmanteCampo('nombre', e.target.value)}
                />
              </Form.Group>
              <Row className="g-2">
                <Col xs={8}>
                  <Form.Label className="small fw-bold text-secondary">Cargo</Form.Label>
                  <Form.Control
                    value={firmante.cargo}
                    onChange={(e) => setFirmanteCampo('cargo', e.target.value)}
                  />
                </Col>
                <Col xs={4}>
                  <Form.Label className="small fw-bold text-secondary">RUT</Form.Label>
                  <Form.Control
                    value={firmante.rut}
                    onChange={(e) => setFirmanteCampo('rut', e.target.value)}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* DERECHA: selección de trabajadores */}
        <Col lg={7}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                Agregar trabajadores
              </h6>

              {/* Por mes de término */}
              <div className="d-flex gap-2 align-items-end mb-3 pb-3 border-bottom">
                <div className="flex-grow-1">
                  <Form.Label className="small fw-bold text-secondary">
                    Todos los que vencen en el mes
                  </Form.Label>
                  <Form.Control type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
                </div>
                <Button variant="outline-primary" onClick={agregarPorMes}>
                  <i className="bi bi-calendar-plus me-1"></i>Agregar mes
                </Button>
              </div>

              {/* Búsqueda individual */}
              <Form.Label className="small fw-bold text-secondary">O buscar uno a uno</Form.Label>
              <Form.Control
                type="text"
                placeholder="Buscar por RUT, nombre o apellidos..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {resultados.length > 0 && (
                <ListGroup className="mt-2 shadow-sm">
                  {resultados.map((t) => (
                    <ListGroup.Item
                      key={t.rut}
                      action
                      disabled={yaAgregado(t.rut)}
                      onClick={() => {
                        agregar(t);
                        setBusqueda('');
                      }}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <span className="text-uppercase">
                        {t.nombres} {t.primer_apellido} {t.segundo_apellido ?? ''}
                      </span>
                      <span className="text-muted small font-monospace">
                        {yaAgregado(t.rut) ? 'Ya agregado' : formatearRut(t.rut, t.dv)}
                      </span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Header className="bg-dark text-white fw-bold small py-2 d-flex justify-content-between align-items-center">
              <span>Trabajadores seleccionados</span>
              <Badge bg="info" text="dark">
                {seleccionados.length}
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              {seleccionados.length === 0 ? (
                <div className="text-muted small text-center py-4">
                  Aún no agregas trabajadores.
                </div>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" className="align-middle mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-3">Trabajador</th>
                        <th>Contrato</th>
                        <th>Fecha término</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {seleccionados.map((s) => (
                        <tr key={s.rut}>
                          <td className="ps-3">
                            <div className="fw-semibold text-uppercase">
                              {s.trabajador.nombres} {s.trabajador.primer_apellido}
                            </div>
                            <div
                              className="text-muted font-monospace"
                              style={{ fontSize: '0.7rem' }}
                            >
                              {formatearRut(s.trabajador.rut, s.trabajador.dv)}
                            </div>
                          </td>
                          <td>
                            <Form.Select
                              size="sm"
                              value={s.contratoId}
                              onChange={(e) => {
                                const c = s.trabajador.contratos?.find(
                                  (x) => x.id === e.target.value,
                                );
                                actualizarSel(s.rut, {
                                  contratoId: e.target.value,
                                  finContrato: c?.fecha_termino ?? s.finContrato,
                                });
                              }}
                            >
                              {(s.trabajador.contratos ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {new Date(c.fecha_inicio).toLocaleDateString('es-CL')} →{' '}
                                  {c.fecha_termino
                                    ? new Date(c.fecha_termino).toLocaleDateString('es-CL')
                                    : 'Indefinido'}
                                </option>
                              ))}
                            </Form.Select>
                          </td>
                          <td>
                            <Form.Control
                              type="date"
                              size="sm"
                              value={s.finContrato}
                              onChange={(e) =>
                                actualizarSel(s.rut, { finContrato: e.target.value })
                              }
                              style={{ minWidth: '140px' }}
                            />
                          </td>
                          <td>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-danger p-0"
                              onClick={() => quitar(s.rut)}
                              title="Quitar"
                            >
                              <i className="bi bi-x-lg"></i>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
            <Card.Footer className="d-flex gap-2 justify-content-end bg-white border-top">
              <Button
                variant="outline-primary"
                disabled={seleccionados.length === 0 || generando !== null}
                onClick={() => generar('docx')}
              >
                <i className="bi bi-file-earmark-word me-1"></i>
                {generando === 'docx' ? 'Generando...' : 'Descargar Word'}
              </Button>
              <Button
                variant="danger"
                disabled={seleccionados.length === 0 || generando !== null}
                onClick={() => generar('pdf')}
              >
                <i className="bi bi-file-earmark-pdf me-1"></i>
                {generando === 'pdf' ? 'Generando...' : 'Generar PDF'}
              </Button>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
