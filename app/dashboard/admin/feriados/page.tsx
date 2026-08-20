'use client';
// app/dashboard/admin/feriados/page.tsx
// Mantención de los feriados que el sistema NO puede calcular solo
// (elecciones, feriados creados por ley puntual) y corrección de los
// calculados. Alimenta el cálculo de días inhábiles del finiquito.
// La ruta ya está protegida por proxy.ts (solo rol admin).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Table, Button, Badge, Form, Modal, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import {
  listarFeriados,
  REGIONES_FERIADO,
  type FeriadoManual,
  type RegionFeriado,
} from '@/lib/feriados';

/**
 * Extrae el mensaje real de un error. Supabase devuelve objetos
 * PostgrestError que NO son instancias de Error, así que un
 * `e instanceof Error` los descarta y se pierde la causa.
 */
function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  return porDefecto;
}

export default function MantencionFeriadosPage() {
  const [manuales, setManuales] = useState<FeriadoManual[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [region, setRegion] = useState<RegionFeriado>('arica');

  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    fecha: '',
    nombre: '',
    region: '' as string,
    excluir: false,
  });

  const cargar = async () => {
    setCargando(true);
    setError('');
    const { data, error: err } = await supabase
      .from('feriados')
      .select('fecha, nombre, region, excluir')
      .order('fecha');
    if (err) setError(`No se pudieron cargar los feriados: ${err.message}`);
    setManuales(
      (data ?? []).map((f) => ({
        fecha: String(f.fecha).slice(0, 10),
        nombre: f.nombre,
        region: f.region,
        excluir: !!f.excluir,
      })),
    );
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  /** Feriados efectivos del año: calculados + manuales, menos los excluidos. */
  const efectivos = useMemo(
    () => listarFeriados(anio, region, manuales),
    [anio, region, manuales],
  );

  const excluidas = useMemo(
    () => new Set(manuales.filter((m) => m.excluir).map((m) => m.fecha)),
    [manuales],
  );

  const abrirModal = (fechaPrellenada = '', nombrePrellenado = '', excluir = false) => {
    setForm({ fecha: fechaPrellenada, nombre: nombrePrellenado, region: '', excluir });
    setError('');
    setModal(true);
  };

  const guardar = async () => {
    if (!form.fecha || !form.nombre.trim()) {
      setError('Indica la fecha y el nombre del feriado.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const { error: err } = await supabase.from('feriados').upsert({
        fecha: form.fecha,
        nombre: form.nombre.trim(),
        // '' = nacional. No se usa null: la llave primaria incluye region.
        region: form.region || '',
        excluir: form.excluir,
      });
      if (err) throw err;

      await registrarAuditoria(
        ACCIONES.MODIFICAR_CONFIGURACION,
        `Feriado ${form.excluir ? 'excluido' : 'agregado'}: ${form.fecha} — ${form.nombre.trim()}`,
      );
      setAviso(`Feriado ${form.excluir ? 'excluido' : 'agregado'} correctamente.`);
      setModal(false);
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (m: FeriadoManual) => {
    setError('');
    // region siempre es texto ('' = nacional), nunca null.
    const { error: err } = await supabase
      .from('feriados')
      .delete()
      .eq('fecha', m.fecha)
      .eq('region', m.region ?? '');
    if (err) {
      setError(`No se pudo eliminar: ${err.message}`);
      return;
    }
    await registrarAuditoria(
      ACCIONES.MODIFICAR_CONFIGURACION,
      `Regla de feriado eliminada: ${m.fecha} — ${m.nombre}`,
    );
    setAviso('Regla eliminada.');
    await cargar();
  };

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    const dia = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
    const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return `${d}-${m}-${y} (${nombres[dia]})`;
  };

  return (
    <div className="container-fluid" style={{ maxWidth: '1000px' }}>
      <div className="mb-3">
        <Link href="/dashboard/admin" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a la Consola
        </Link>
      </div>

      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-calendar-event text-primary me-2"></i>
          Feriados Legales
        </h3>
        <p className="text-muted small m-0">
          El sistema calcula solo los feriados deducibles (fechas fijas, los derivados de la Pascua
          y los desplazables de la Ley 19.668). Aquí se agregan los que no se pueden deducir —días
          de elección, feriados creados por ley puntual— y se corrigen los calculados. Estos días se
          descuentan como inhábiles al calcular el feriado proporcional del finiquito.
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
            <Col xs={6} md={3}>
              <Form.Label className="small fw-bold text-secondary">Año</Form.Label>
              <Form.Control
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value) || anio)}
              />
            </Col>
            <Col xs={6} md={4}>
              <Form.Label className="small fw-bold text-secondary">Región</Form.Label>
              <Form.Select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionFeriado)}
              >
                {REGIONES_FERIADO.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.etiqueta}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={5} className="text-md-end">
              <Button variant="primary" className="fw-semibold" onClick={() => abrirModal()}>
                <i className="bi bi-plus-lg me-2"></i>Agregar feriado
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-light fw-bold small py-2">
          Feriados efectivos de {anio} ({efectivos.length})
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0 small">
              <thead className="text-secondary text-uppercase" style={{ fontSize: '0.75rem' }}>
                <tr>
                  <th className="px-3">Fecha</th>
                  <th>Feriado</th>
                  <th>Origen</th>
                  <th className="text-end px-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={4} className="text-center p-4 text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : (
                  efectivos.map((f) => (
                    <tr key={`${f.fecha}-${f.nombre}`}>
                      <td className="px-3 font-monospace">{fmt(f.fecha)}</td>
                      <td className="fw-semibold text-dark">{f.nombre}</td>
                      <td>
                        {f.manual ? (
                          <Badge bg="primary-subtle" text="primary" className="border fw-normal">
                            Cargado a mano
                          </Badge>
                        ) : (
                          <Badge bg="light" text="dark" className="border fw-normal">
                            Calculado
                          </Badge>
                        )}
                      </td>
                      <td className="text-end px-3">
                        {!f.manual && (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => abrirModal(f.fecha, f.nombre, true)}
                            title="Excluir esta fecha (si el cálculo quedó mal)"
                          >
                            Excluir
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0">
        <Card.Header className="bg-secondary text-white fw-bold small py-2">
          Reglas cargadas a mano ({manuales.length})
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0 small">
              <tbody>
                {manuales.length === 0 ? (
                  <tr>
                    <td className="text-center p-4 text-muted">
                      Sin reglas propias: se están usando solo los feriados calculados.
                    </td>
                  </tr>
                ) : (
                  manuales.map((m) => (
                    <tr key={`${m.fecha}-${m.region ?? 'nac'}`}>
                      <td className="px-3 font-monospace">{fmt(m.fecha)}</td>
                      <td className="fw-semibold text-dark">{m.nombre}</td>
                      <td>
                        {m.excluir ? (
                          <Badge bg="warning" text="dark">
                            Excluye la fecha
                          </Badge>
                        ) : (
                          <Badge bg="success">Agrega feriado</Badge>
                        )}
                      </td>
                      <td>
                        <span className="text-muted">
                          {m.region
                            ? (REGIONES_FERIADO.find((r) => r.id === m.region)?.etiqueta ??
                              m.region)
                            : 'Nacional'}
                        </span>
                      </td>
                      <td className="text-end px-3">
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => eliminar(m)}
                          title="Eliminar esta regla"
                        >
                          <i className="bi bi-trash3"></i>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* --- MODAL: AGREGAR / EXCLUIR --- */}
      <Modal show={modal} onHide={() => setModal(false)} centered backdrop="static">
        <Modal.Header closeButton className="bg-primary text-white border-bottom-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-calendar-plus me-2"></i>
            {form.excluir ? 'Excluir fecha' : 'Agregar feriado'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {form.excluir && (
            <Alert variant="warning" className="py-2 small">
              La fecha dejará de contarse como feriado. Úsalo si el cálculo automático quedó mal;
              luego agrega la fecha correcta como un feriado nuevo.
            </Alert>
          )}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Fecha</Form.Label>
              <Form.Control
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Nombre</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ej: Elecciones presidenciales"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label className="small fw-bold text-secondary">Alcance</Form.Label>
              <Form.Select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                <option value="">Nacional (todas las regiones)</option>
                {REGIONES_FERIADO.filter((r) => r.id !== 'ninguna').map((r) => (
                  <option key={r.id} value={r.id}>
                    Solo {r.etiqueta}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-0">
          <Button
            variant="outline-secondary"
            onClick={() => setModal(false)}
            className="fw-semibold"
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={guardar}
            className="fw-semibold shadow-sm"
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Modal>

      <div className="text-muted small mt-3">
        <i className="bi bi-info-circle me-1"></i>
        Los feriados desplazables (29 de junio y 12 de octubre) se calculan según la Ley 19.668.
        Conviene contrastarlos una vez al año con el calendario oficial y, si alguno no calza,
        corregirlo aquí.
      </div>

      {/* Muestra cuántas fechas calculadas están excluidas, para no perderlas de vista. */}
      {excluidas.size > 0 && (
        <div className="text-muted small mt-1">
          Hay {excluidas.size} fecha(s) calculada(s) excluida(s) por reglas propias.
        </div>
      )}
    </div>
  );
}
