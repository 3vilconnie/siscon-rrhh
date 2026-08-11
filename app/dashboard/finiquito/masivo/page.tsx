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
  FIRMANTE_FINIQUITO_DEFAULT,
  calcularFiniquito,
  estimarDiasInhabiles,
  construirDatosFiniquito,
  formatearRutFiniquito,
  formatearMiles,
  type FirmanteFiniquito,
  type DatosFiniquito,
} from '@/lib/finiquito';
import { descargarZipCalculos } from '@/lib/finiquitoCalculoXlsx';

interface Seleccionado {
  rut: number;
  trabajador: Trabajador;
  contratoId: string;
  fechaInicio: string; // ISO (del contrato)
  fechaTermino: string; // ISO
  sueldoImponible: number;
  diasInhabiles: number;
}

/** Contrato "que finiquita": el más reciente con fecha de término, o el más reciente. */
function contratoPorDefecto(t: Trabajador): Contrato | null {
  const contratos = t.contratos ?? [];
  if (contratos.length === 0) return null;
  const conTermino = contratos.filter((c) => c.fecha_termino);
  return (
    [...conTermino].sort((a, b) =>
      (b.fecha_termino ?? '').localeCompare(a.fecha_termino ?? ''),
    )[0] ??
    [...contratos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0] ??
    null
  );
}

/** Crea una fila de selección sembrando cálculo desde un contrato. */
function filaDesdeContrato(t: Trabajador, c: Contrato | null): Seleccionado {
  const fechaInicio = c?.fecha_inicio ?? '';
  const fechaTermino = c?.fecha_termino ?? '';
  const sueldoImponible = c?.sueldo_base ?? 0;
  let diasInhabiles = 0;
  if (fechaInicio && fechaTermino) {
    const { diasHabiles } = calcularFiniquito({
      fechaInicio,
      fechaTermino,
      sueldoImponible,
      diasInhabiles: 0,
    });
    diasInhabiles = estimarDiasInhabiles(fechaTermino, diasHabiles);
  }
  return {
    rut: t.rut,
    trabajador: t,
    contratoId: c?.id ?? '',
    fechaInicio,
    fechaTermino,
    sueldoImponible,
    diasInhabiles,
  };
}

export default function FiniquitoMasivoPage() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);

  // Ajustes compartidos del lote.
  const [programaId, setProgramaId] = useState(PROGRAMAS_FINIQUITO[0].id);
  const [causalId, setCausalId] = useState(CAUSAL_FINIQUITO_DEFAULT_ID);
  const [ciudad, setCiudad] = useState('Arica');
  const [redactor, setRedactor] = useState('crh');
  const [firmante, setFirmante] = useState<FirmanteFiniquito>({ ...FIRMANTE_FINIQUITO_DEFAULT });
  const setFirmanteCampo = (campo: keyof FirmanteFiniquito, valor: string) =>
    setFirmante((prev) => ({ ...prev, [campo]: valor }));

  // Selección de trabajadores.
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
    setSeleccionados((prev) => [...prev, filaDesdeContrato(t, c)]);
  };

  const quitar = (rut: number) => setSeleccionados((prev) => prev.filter((s) => s.rut !== rut));
  const limpiar = () => setSeleccionados([]);

  const actualizarSel = (rut: number, cambios: Partial<Seleccionado>) =>
    setSeleccionados((prev) => prev.map((s) => (s.rut === rut ? { ...s, ...cambios } : s)));

  // Cambiar el contrato de una fila re-siembra el cálculo.
  const cambiarContrato = (rut: number, contratoId: string) => {
    setSeleccionados((prev) =>
      prev.map((s) => {
        if (s.rut !== rut) return s;
        const c = s.trabajador.contratos?.find((x) => x.id === contratoId) ?? null;
        return filaDesdeContrato(s.trabajador, c);
      }),
    );
  };

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

  // Agregar todos los que tienen un contrato que vence en el mes elegido.
  const agregarPorMes = () => {
    if (!mes) return toast.error('Elige un mes.');
    let anadidos = 0;
    trabajadores.forEach((t) => {
      if (yaAgregado(t.rut)) return;
      const contrato = (t.contratos ?? []).find((c) => c.fecha_termino?.startsWith(mes));
      if (contrato) {
        agregar(t, contrato);
        anadidos++;
      }
    });
    if (anadidos === 0) toast('No hay contratos que venzan en ese mes.', { icon: 'ℹ️' });
    else toast.success(`${anadidos} trabajador(es) agregado(s).`);
  };

  const causal = useMemo(() => CAUSALES_FINIQUITO.find((c) => c.id === causalId)!, [causalId]);
  const programa = useMemo(
    () => PROGRAMAS_FINIQUITO.find((p) => p.id === programaId)!,
    [programaId],
  );

  // Cálculo por fila (FP y total) para mostrar en la tabla.
  const calculoPorRut = useMemo(() => {
    const mapa = new Map<number, { fp: number; total: number; valido: boolean }>();
    for (const s of seleccionados) {
      const valido = !!s.fechaInicio && !!s.fechaTermino && s.sueldoImponible > 0;
      const res = valido
        ? calcularFiniquito({
            fechaInicio: s.fechaInicio,
            fechaTermino: s.fechaTermino,
            sueldoImponible: s.sueldoImponible,
            diasInhabiles: s.diasInhabiles,
          })
        : null;
      mapa.set(s.rut, { fp: res?.fp ?? 0, total: res?.total ?? 0, valido });
    }
    return mapa;
  }, [seleccionados]);

  const totalLote = useMemo(
    () => seleccionados.reduce((acc, s) => acc + (calculoPorRut.get(s.rut)?.total ?? 0), 0),
    [seleccionados, calculoPorRut],
  );

  // Construye los datos de finiquito de todas las filas seleccionadas.
  const construirDocumentos = (): DatosFiniquito[] =>
    seleccionados.map((s) => {
      const contratoBase = s.trabajador.contratos?.find((c) => c.id === s.contratoId) ?? null;
      const contratoAjustado: Contrato = {
        id: s.contratoId,
        trabajador_rut: s.rut,
        fecha_inicio: s.fechaInicio,
        fecha_termino: s.fechaTermino,
        sueldo_base: s.sueldoImponible,
        jornada: contratoBase?.jornada,
      };
      return construirDatosFiniquito(s.trabajador, contratoAjustado, {
        ciudad,
        redactorIniciales: redactor,
        causal,
        programa,
        firmante,
        diasInhabiles: s.diasInhabiles,
      }).datos;
    });

  const faltantes = () => seleccionados.filter((s) => !calculoPorRut.get(s.rut)?.valido).length;

  // Descarga un ZIP con un Excel de cálculo por trabajador.
  const descargarCalculos = () => {
    if (seleccionados.length === 0) return toast.error('Agrega al menos un trabajador.');
    const faltan = faltantes();
    if (faltan > 0)
      return toast.error(`Falta fecha de término o sueldo en ${faltan} trabajador(es).`);
    descargarZipCalculos(construirDocumentos(), `calculos_finiquito_${seleccionados.length}.zip`);
    toast.success('Cálculos (Excel) descargados.');
  };

  const generar = async (formato: 'pdf' | 'docx') => {
    if (seleccionados.length === 0) return toast.error('Agrega al menos un trabajador.');
    if (faltantes() > 0)
      return toast.error(`Falta fecha de término o sueldo en ${faltantes()} trabajador(es).`);

    const documentos = construirDocumentos();

    setGenerando(formato);
    const toastId = toast.loading(`Generando ${seleccionados.length} finiquitos...`);
    try {
      const res = await fetch('/api/finiquito/generar-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, documentos }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finiquitos_${seleccionados.length}.${formato}`;
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
    <div className="container-fluid" style={{ maxWidth: '1250px' }}>
      <div className="mb-3">
        <Link href="/dashboard/finiquito" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a Finiquito
        </Link>
      </div>
      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-people-fill text-success me-2"></i>
          Finiquito — Masivo
        </h3>
        <p className="text-muted small m-0">
          Calcula el feriado proporcional de varios trabajadores y genera un único documento con un
          finiquito por página.
        </p>
      </div>

      <Row className="g-4">
        {/* IZQUIERDA: ajustes compartidos */}
        <Col lg={4}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                Datos comunes del lote
              </h6>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-secondary">
                  Programa / Proyecto
                </Form.Label>
                <Form.Select value={programaId} onChange={(e) => setProgramaId(e.target.value)}>
                  {PROGRAMAS_FINIQUITO.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-secondary">Causal de término</Form.Label>
                <Form.Select value={causalId} onChange={(e) => setCausalId(e.target.value)}>
                  {CAUSALES_FINIQUITO.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.etiqueta}
                    </option>
                  ))}
                </Form.Select>
                <div className="bg-light rounded p-2 mt-2 small">
                  <span className="text-muted">Artículo:</span> <strong>{causal.articulo}</strong>
                  <span className="fst-italic d-block mt-1">&ldquo;{causal.terminos}&rdquo;</span>
                </div>
              </Form.Group>
              <Row className="g-3">
                <Col xs={6}>
                  <Form.Label className="small fw-bold text-secondary">Ciudad</Form.Label>
                  <Form.Control value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                </Col>
                <Col xs={6}>
                  <Form.Label className="small fw-bold text-secondary">Iniciales</Form.Label>
                  <Form.Control value={redactor} onChange={(e) => setRedactor(e.target.value)} />
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
                  onClick={() => setFirmante({ ...FIRMANTE_FINIQUITO_DEFAULT })}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Predeterminado
                </Button>
              </div>
              <Row className="g-2">
                <Col xs={4}>
                  <Form.Label className="small fw-bold text-secondary">Trato</Form.Label>
                  <Form.Select
                    value={firmante.tratamiento}
                    onChange={(e) => setFirmanteCampo('tratamiento', e.target.value)}
                  >
                    <option>Don</option>
                    <option>Doña</option>
                  </Form.Select>
                </Col>
                <Col xs={8}>
                  <Form.Label className="small fw-bold text-secondary">Nombre completo</Form.Label>
                  <Form.Control
                    value={firmante.nombre}
                    onChange={(e) => setFirmanteCampo('nombre', e.target.value)}
                  />
                </Col>
                <Col xs={12}>
                  <Form.Label className="small fw-bold text-secondary">
                    Nombre bajo la firma
                  </Form.Label>
                  <Form.Control
                    value={firmante.nombre_corto}
                    onChange={(e) => setFirmanteCampo('nombre_corto', e.target.value)}
                  />
                </Col>
                <Col xs={7}>
                  <Form.Label className="small fw-bold text-secondary">Cargo</Form.Label>
                  <Form.Control
                    value={firmante.cargo}
                    onChange={(e) => setFirmanteCampo('cargo', e.target.value)}
                  />
                </Col>
                <Col xs={5}>
                  <Form.Label className="small fw-bold text-secondary">RUT</Form.Label>
                  <Form.Control
                    value={firmante.rut}
                    onChange={(e) => setFirmanteCampo('rut', e.target.value)}
                  />
                </Col>
                <Col xs={12}>
                  <Form.Label className="small fw-bold text-secondary">Profesión</Form.Label>
                  <Form.Control
                    value={firmante.profesion}
                    onChange={(e) => setFirmanteCampo('profesion', e.target.value)}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* DERECHA: selección de trabajadores */}
        <Col lg={8}>
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
                <Button variant="outline-success" onClick={agregarPorMes}>
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
                        {yaAgregado(t.rut) ? 'Ya agregado' : formatearRutFiniquito(t.rut, t.dv)}
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
              <div className="d-flex align-items-center gap-2">
                {seleccionados.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-white-50 p-0 text-decoration-none small"
                    onClick={limpiar}
                  >
                    Limpiar
                  </Button>
                )}
                <Badge bg="info" text="dark">
                  {seleccionados.length}
                </Badge>
              </div>
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
                        <th style={{ minWidth: 150 }}>Contrato</th>
                        <th style={{ minWidth: 140 }}>Término</th>
                        <th style={{ minWidth: 110 }}>Sueldo imp.</th>
                        <th style={{ minWidth: 90 }} title="Días inhábiles del feriado">
                          Inhábiles
                        </th>
                        <th className="text-end">FP</th>
                        <th className="text-end">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {seleccionados.map((s) => {
                        const calc = calculoPorRut.get(s.rut);
                        return (
                          <tr key={s.rut} className={calc?.valido ? '' : 'table-warning'}>
                            <td className="ps-3">
                              <div className="fw-semibold text-uppercase">
                                {s.trabajador.nombres} {s.trabajador.primer_apellido}
                              </div>
                              <div
                                className="text-muted font-monospace"
                                style={{ fontSize: '0.7rem' }}
                              >
                                {formatearRutFiniquito(s.trabajador.rut, s.trabajador.dv)}
                              </div>
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={s.contratoId}
                                onChange={(e) => cambiarContrato(s.rut, e.target.value)}
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
                                value={s.fechaTermino}
                                onChange={(e) =>
                                  actualizarSel(s.rut, { fechaTermino: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                min={0}
                                value={s.sueldoImponible || ''}
                                onChange={(e) =>
                                  actualizarSel(s.rut, {
                                    sueldoImponible: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                size="sm"
                                min={0}
                                value={s.diasInhabiles}
                                onChange={(e) =>
                                  actualizarSel(s.rut, {
                                    diasInhabiles: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </td>
                            <td className="text-end font-monospace">
                              {calc?.valido
                                ? calc.fp.toLocaleString('es-CL', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : '—'}
                            </td>
                            <td className="text-end font-monospace fw-semibold">
                              {calc?.valido ? `$${formatearMiles(calc.total)}` : '—'}
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
                        );
                      })}
                    </tbody>
                    {seleccionados.length > 0 && (
                      <tfoot className="table-light">
                        <tr>
                          <td colSpan={6} className="text-end fw-bold ps-3">
                            Total del lote
                          </td>
                          <td className="text-end fw-bold font-monospace text-success">
                            ${formatearMiles(totalLote)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </Table>
                </div>
              )}
            </Card.Body>
            <Card.Footer className="d-flex gap-2 justify-content-end bg-white border-top flex-wrap">
              <Button
                variant="outline-secondary"
                className="me-auto"
                disabled={seleccionados.length === 0 || generando !== null}
                onClick={descargarCalculos}
                title="ZIP con un Excel de cálculo por trabajador"
              >
                <i className="bi bi-file-earmark-excel me-1"></i>
                Cálculos Excel (ZIP)
              </Button>
              <Button
                variant="outline-success"
                disabled={seleccionados.length === 0 || generando !== null}
                onClick={() => generar('docx')}
              >
                <i className="bi bi-file-earmark-word me-1"></i>
                {generando === 'docx' ? 'Generando...' : 'Descargar Word'}
              </Button>
              <Button
                variant="success"
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
