'use client';
// app/dashboard/admin/lotes/page.tsx
// Historial de lotes generados (contratos, anexos y finiquitos masivos).
// Es información de auditoría, así que vive bajo /dashboard/admin, que
// proxy.ts ya protege por rol, y se lee vía /api/admin/lotes con service role.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Table,
  Button,
  Badge,
  Form,
  Row,
  Col,
  Alert,
  Spinner,
  Modal,
  Collapse,
} from 'react-bootstrap';
import { formatearRutFiniquito, formatearMiles } from '@/lib/finiquito';
import type { Lote, LoteItem, TipoLote } from '@/types';

const ETIQUETA_TIPO: Record<TipoLote, { texto: string; color: string; icono: string }> = {
  contrato: { texto: 'Contratos', color: 'primary', icono: 'bi-file-earmark-text' },
  anexo: { texto: 'Anexos', color: 'info', icono: 'bi-file-earmark-plus' },
  finiquito: { texto: 'Finiquitos', color: 'success', icono: 'bi-cash-coin' },
  horas_extra: { texto: 'Horas extra', color: 'warning', icono: 'bi-clock-fill' },
};

export default function HistorialLotesPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);

  const [aAnular, setAAnular] = useState<Lote | null>(null);
  const [motivo, setMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (tipo) params.set('tipo', tipo);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);

      const res = await fetch(`/api/admin/lotes?${params.toString()}`);
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setLotes(cuerpo.lotes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, desde, hasta]);

  const anular = async () => {
    if (!aAnular) return;
    setAnulando(true);
    setError('');
    try {
      const res = await fetch('/api/admin/lotes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: aAnular.id, motivo }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setAviso('Lote anulado. Queda en el historial como constancia.');
      setAAnular(null);
      setMotivo('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular el lote.');
    } finally {
      setAnulando(false);
    }
  };

  /** Total en dinero de los lotes de finiquito listados (los anulados no suman). */
  const totalFiniquitos = useMemo(
    () =>
      lotes
        .filter((l) => l.tipo === 'finiquito' && l.estado === 'generado')
        .reduce(
          (acc, l) => acc + (l.items ?? []).reduce((a, i) => a + Number(i.monto ?? 0), 0),
          0,
        ),
    [lotes],
  );

  const fechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="container-fluid" style={{ maxWidth: '1150px' }}>
      <div className="mb-3">
        <Link href="/dashboard/admin" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a la Consola
        </Link>
      </div>

      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-archive text-primary me-2"></i>
          Historial de Lotes
        </h3>
        <p className="text-muted small m-0">
          Cada generación masiva de contratos, anexos o finiquitos queda registrada con los valores
          que efectivamente se usaron. Los montos son un reflejo de lo emitido en su momento: no se
          recalculan si después cambia una fórmula.
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="py-2 small">
          {error}
        </Alert>
      )}
      {aviso && (
        <Alert variant="success" className="py-2 small" dismissible onClose={() => setAviso('')}>
          {aviso}
        </Alert>
      )}

      <Card className="shadow-sm border-0 mb-3">
        <Card.Body className="p-3">
          <Row className="g-3 align-items-end">
            <Col xs={12} md={3}>
              <Form.Label className="small fw-bold text-secondary">Tipo</Form.Label>
              <Form.Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="contrato">Contratos</option>
                <option value="anexo">Anexos de ampliación</option>
                <option value="finiquito">Finiquitos</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3}>
              <Form.Label className="small fw-bold text-secondary">Desde</Form.Label>
              <Form.Control type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Col>
            <Col xs={6} md={3}>
              <Form.Label className="small fw-bold text-secondary">Hasta</Form.Label>
              <Form.Control type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Col>
            <Col xs={12} md={3} className="text-md-end">
              <Button
                variant="outline-secondary"
                className="fw-semibold"
                onClick={() => {
                  setTipo('');
                  setDesde('');
                  setHasta('');
                }}
              >
                Limpiar filtros
              </Button>
            </Col>
          </Row>
          {totalFiniquitos > 0 && (
            <div className="text-muted small mt-3">
              <i className="bi bi-cash-coin me-1"></i>
              Total en finiquitos vigentes del listado:{' '}
              <strong className="text-dark">${formatearMiles(totalFiniquitos)}</strong>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead
                className="bg-light text-secondary text-uppercase"
                style={{ fontSize: '0.78rem' }}
              >
                <tr>
                  <th className="px-3">Fecha</th>
                  <th>Tipo</th>
                  <th className="text-center">Trabajadores</th>
                  <th className="text-end">Monto</th>
                  <th>Generado por</th>
                  <th className="text-end px-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : lotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted">
                      No hay lotes registrados con esos criterios.
                    </td>
                  </tr>
                ) : (
                  lotes.map((l) => {
                    const et = ETIQUETA_TIPO[l.tipo];
                    const items = l.items ?? [];
                    const monto = items.reduce((a, i) => a + Number(i.monto ?? 0), 0);
                    const anulado = l.estado === 'anulado';
                    return [
                      <tr key={l.id} className={anulado ? 'opacity-50' : ''}>
                        <td className="px-3 small font-monospace">{fechaHora(l.generado_en)}</td>
                        <td>
                          <Badge bg={et.color} className="fw-normal">
                            <i className={`bi ${et.icono} me-1`}></i>
                            {et.texto}
                          </Badge>
                          {anulado && (
                            <Badge bg="danger" className="ms-1 fw-normal">
                              Anulado
                            </Badge>
                          )}
                          {l.formato && (
                            <span className="text-muted small ms-2 text-uppercase">
                              {l.formato}
                            </span>
                          )}
                        </td>
                        <td className="text-center fw-semibold">{l.cantidad}</td>
                        <td className="text-end font-monospace">
                          {monto > 0 ? `$${formatearMiles(monto)}` : '—'}
                        </td>
                        <td className="small text-muted text-truncate" style={{ maxWidth: 190 }}>
                          {l.generado_por ?? '—'}
                        </td>
                        <td className="text-end px-3">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-2"
                            onClick={() => setExpandido(expandido === l.id ? null : l.id)}
                          >
                            <i
                              className={`bi ${expandido === l.id ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                            ></i>{' '}
                            Detalle
                          </Button>
                          {!anulado && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => setAAnular(l)}
                              title="Marcar como anulado (no se borra del historial)"
                            >
                              Anular
                            </Button>
                          )}
                        </td>
                      </tr>,
                      <tr key={`${l.id}-detalle`}>
                        <td colSpan={6} className="p-0 border-0">
                          <Collapse in={expandido === l.id}>
                            <div>
                              <div className="bg-light p-3 border-top">
                                {anulado && (
                                  <div className="small text-danger mb-2">
                                    <i className="bi bi-x-octagon me-1"></i>
                                    Anulado por {l.anulado_por} el{' '}
                                    {l.anulado_en ? fechaHora(l.anulado_en) : '—'}
                                    {l.motivo ? ` · ${l.motivo}` : ''}
                                  </div>
                                )}
                                <div className="small fw-bold text-secondary mb-2">
                                  Trabajadores del lote
                                </div>
                                <Table size="sm" className="mb-3 bg-white align-middle">
                                  <thead
                                    className="text-secondary text-uppercase"
                                    style={{ fontSize: '0.7rem' }}
                                  >
                                    <tr>
                                      <th>RUT</th>
                                      <th>Nombre</th>
                                      <th>Período</th>
                                      <th className="text-end">
                                        {l.tipo === 'finiquito' ? 'Total pagado' : 'Sueldo base'}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((i: LoteItem, idx: number) => (
                                      <tr key={i.id ?? idx}>
                                        <td className="font-monospace small">
                                          {i.trabajador_rut}
                                        </td>
                                        <td className="small">{i.nombre_completo}</td>
                                        <td className="small text-muted">
                                          {i.fecha_inicio ?? '—'} → {i.fecha_termino ?? '—'}
                                        </td>
                                        <td className="text-end font-monospace small">
                                          {i.monto ? `$${formatearMiles(Number(i.monto))}` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                                <details>
                                  <summary
                                    className="small text-secondary"
                                    style={{ cursor: 'pointer' }}
                                  >
                                    Parámetros usados en la generación
                                  </summary>
                                  <pre
                                    className="bg-white border rounded p-2 mt-2 mb-0 small"
                                    style={{ fontSize: '0.72rem', maxHeight: 220, overflow: 'auto' }}
                                  >
                                    {JSON.stringify(l.parametros, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </div>
                          </Collapse>
                        </td>
                      </tr>,
                    ];
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* --- MODAL: ANULAR --- */}
      <Modal show={!!aAnular} onHide={() => setAAnular(null)} centered>
        <Modal.Header closeButton className="border-bottom-0">
          <Modal.Title className="fw-bold fs-5 text-danger">
            <i className="bi bi-x-octagon me-2"></i>Anular lote
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small mb-3">
            El lote se marcará como anulado pero <strong>no se borra</strong>: el historial debe
            conservarse. Los documentos ya emitidos y los contratos guardados en la base no se
            modifican.
          </p>
          <Form.Group>
            <Form.Label className="small fw-bold text-secondary">Motivo (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: fechas equivocadas, se regeneró como lote nuevo"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-top-0">
          <Button
            variant="outline-secondary"
            onClick={() => setAAnular(null)}
            className="fw-semibold"
            disabled={anulando}
          >
            Cancelar
          </Button>
          <Button variant="danger" onClick={anular} className="fw-semibold" disabled={anulando}>
            {anulando ? 'Anulando...' : 'Anular lote'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
