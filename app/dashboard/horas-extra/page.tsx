'use client';
// app/dashboard/horas-extra/page.tsx
// Anexos de Contrato por horas extraordinarias.
//
// Reemplaza el flujo que se hacía con combinación de correspondencia de Word
// sobre la planilla "DATA -Plantilla horas extras.xlsm":
//   - la columna SELECCIÓN pasa a ser la selección en pantalla,
//   - FECHA_HORAS y HORAS se capturan aquí,
//   - el resto de los datos sale de la tabla `trabajadores`.

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  Spinner,
  ButtonGroup,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import { registrarAuditoria } from '@/lib/auditoria';
import { registrarLote } from '@/lib/lotesRepo';
import { formatearRutFiniquito } from '@/lib/finiquito';
import {
  construirDatosHorasExtra,
  camposFaltantes,
  mesEnPalabras,
  emisionPorDefecto,
  mesAnterior,
  type DatosHorasExtra,
} from '@/lib/horasExtra';
import type { Trabajador } from '@/types';

/** Trabajador con el programa de su contrato más reciente, para poder filtrar. */
interface TrabajadorConPrograma extends Trabajador {
  programa: string | null;
}

const SIN_PROGRAMA = '__sin__';

export default function HorasExtraPage() {
  const [trabajadores, setTrabajadores] = useState<TrabajadorConPrograma[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  // --- Parámetros del documento ---
  const [mes, setMes] = useState(mesAnterior());
  const [fechaEmision, setFechaEmision] = useState(emisionPorDefecto(mesAnterior()));
  const [emisionTocada, setEmisionTocada] = useState(false);
  const [iniciales, setIniciales] = useState('crh');
  const [ciudad, setCiudad] = useState('Arica');
  const [formato, setFormato] = useState<'pdf' | 'docx'>('pdf');

  // --- Selección ---
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [horasPorRut, setHorasPorRut] = useState<Record<number, string>>({});
  const [horasPorDefecto, setHorasPorDefecto] = useState('');

  // --- Filtros ---
  const [busqueda, setBusqueda] = useState('');
  const [programa, setPrograma] = useState('');
  /** Muestra solo los trabajadores marcados, para revisar la selección antes de generar. */
  const [soloSeleccionados, setSoloSeleccionados] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 15;

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      try {
        const { data, error: err } = await supabase
          .from('trabajadores')
          .select('*, contratos(programa, fecha_inicio)')
          .order('primer_apellido');
        if (err) throw err;

        const lista: TrabajadorConPrograma[] = (data ?? []).map((t) => {
          const contratos = (t.contratos ?? []) as {
            programa: string | null;
            fecha_inicio: string;
          }[];
          // El programa lo define el contrato más reciente del trabajador.
          const reciente = [...contratos].sort((a, b) =>
            (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''),
          )[0];
          return { ...(t as Trabajador), programa: reciente?.programa ?? null };
        });
        setTrabajadores(lista);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los trabajadores.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  /** La fecha de emisión sigue al mes mientras el usuario no la edite a mano. */
  const cambiarMes = (nuevo: string) => {
    setMes(nuevo);
    if (!emisionTocada) setFechaEmision(emisionPorDefecto(nuevo));
  };

  const programasDisponibles = useMemo(() => {
    const set = new Set<string>();
    trabajadores.forEach((t) => {
      if (t.programa) set.add(t.programa);
    });
    return [...set].sort();
  }, [trabajadores]);

  /** El filtro solo tiene sentido si queda alguien marcado: si se vacía la
   *  selección, la lista vuelve sola a mostrarse completa en vez de quedar vacía. */
  const verSoloSeleccionados = soloSeleccionados && seleccionados.size > 0;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return trabajadores.filter((t) => {
      if (verSoloSeleccionados && !seleccionados.has(t.rut)) return false;
      if (programa === SIN_PROGRAMA && t.programa) return false;
      if (programa && programa !== SIN_PROGRAMA && t.programa !== programa) return false;
      if (!q) return true;
      const nombre = `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido ?? ''}`.toLowerCase();
      return nombre.includes(q) || String(t.rut).includes(q.replace(/[.\-]/g, ''));
    });
  }, [trabajadores, busqueda, programa, verSoloSeleccionados, seleccionados]);

  // La selección vive por RUT, así que sobrevive a cambios de página y filtro.
  const totalPaginas = Math.ceil(filtrados.length / registrosPorPagina) || 1;
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const pagina = filtrados.slice(
    (paginaSegura - 1) * registrosPorPagina,
    paginaSegura * registrosPorPagina,
  );

  const paginaCompleta = pagina.length > 0 && pagina.every((t) => seleccionados.has(t.rut));

  const alternar = (rut: number) => {
    const s = new Set(seleccionados);
    if (s.has(rut)) s.delete(rut);
    else s.add(rut);
    setSeleccionados(s);
  };

  const alternarPagina = () => {
    const s = new Set(seleccionados);
    pagina.forEach((t) => (paginaCompleta ? s.delete(t.rut) : s.add(t.rut)));
    setSeleccionados(s);
  };

  const seleccionarFiltrados = () => {
    setSeleccionados(new Set(filtrados.map((t) => t.rut)));
  };

  const horasDe = (rut: number): string => horasPorRut[rut] ?? horasPorDefecto;

  /** Aplica las horas escritas arriba a todos los seleccionados de una vez. */
  const aplicarHorasATodos = () => {
    if (!horasPorDefecto.trim()) return;
    const nuevo = { ...horasPorRut };
    seleccionados.forEach((rut) => (nuevo[rut] = horasPorDefecto));
    setHorasPorRut(nuevo);
    toast.success(`Horas aplicadas a ${seleccionados.size} trabajador(es).`);
  };

  const elegidos = useMemo(
    () => trabajadores.filter((t) => seleccionados.has(t.rut)),
    [trabajadores, seleccionados],
  );

  /** Seleccionados a los que les faltan datos personales para el documento. */
  const conDatosIncompletos = useMemo(
    () =>
      elegidos.map((t) => ({ t, faltan: camposFaltantes(t) })).filter((x) => x.faltan.length > 0),
    [elegidos],
  );

  /** Seleccionados sin un número de horas válido. */
  const sinHoras = useMemo(
    () => elegidos.filter((t) => !(Number(horasDe(t.rut)) > 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elegidos, horasPorRut, horasPorDefecto],
  );

  const generar = async () => {
    if (elegidos.length === 0) {
      toast.error('Selecciona al menos un trabajador.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      toast.error('Indica el mes de las horas pactadas.');
      return;
    }
    if (sinHoras.length > 0) {
      toast.error(`Falta indicar las horas de ${sinHoras.length} trabajador(es).`);
      return;
    }

    setGenerando(true);
    setError('');
    try {
      const documentos: DatosHorasExtra[] = elegidos.map((t) =>
        construirDatosHorasExtra(t, {
          mes,
          horas: Number(horasDe(t.rut)),
          fechaEmision,
          ciudad,
          redactorIniciales: iniciales,
        }),
      );

      const res = await fetch('/api/horas-extra/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, documentos }),
      });

      if (!res.ok) {
        const cuerpo = await res.json();
        throw new Error(cuerpo.error ?? 'No se pudo generar el documento.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        elegidos.length === 1
          ? `anexo_horas_extra_${elegidos[0].rut}.${formato}`
          : `anexos_horas_extra_${mes}.${formato}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${elegidos.length} anexo(s) generado(s).`);

      // Registro del lote: no bloquea si falla (ver lib/lotesRepo.ts).
      await registrarLote({
        tipo: 'horas_extra',
        formato,
        parametros: { mes, fechaEmision, ciudad, iniciales },
        items: elegidos.map((t) => ({
          trabajador_rut: t.rut,
          nombre_completo: `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido ?? ''}`.trim(),
          detalle: { horas: Number(horasDe(t.rut)), mes },
        })),
      });

      await registrarAuditoria(
        'GENERAR_HORAS_EXTRA',
        `${elegidos.length} anexo(s) de horas extraordinarias de ${mesEnPalabras(mes)}.`,
      );
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo generar el documento.';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Container fluid style={{ maxWidth: '1200px' }}>
      <div className="mb-3">
        <Link href="/dashboard" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver al panel
        </Link>
      </div>

      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-clock-history text-primary me-2"></i>
          Anexos de Horas Extraordinarias
        </h3>
        <p className="text-muted small m-0">
          Genera el anexo de contrato que pacta las horas extraordinarias de un mes. Elige el mes,
          marca a los trabajadores e indica las horas de cada uno.
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PASO 1 — Datos del documento                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white border-bottom py-3">
          <span className="fw-bold text-dark">
            <Badge bg="primary" className="me-2">
              1
            </Badge>
            Datos del documento
          </span>
        </Card.Header>
        <Card.Body className="p-4">
          <Row className="g-3">
            <Col xs={12} md={3}>
              <Form.Label className="small fw-bold text-secondary">Mes de las horas</Form.Label>
              <Form.Control type="month" value={mes} onChange={(e) => cambiarMes(e.target.value)} />
              <Form.Text className="text-muted">
                {mesEnPalabras(mes) ? `Saldrá como "${mesEnPalabras(mes)}"` : 'Mes inválido'}
              </Form.Text>
            </Col>
            <Col xs={12} md={3}>
              <Form.Label className="small fw-bold text-secondary">Fecha de emisión</Form.Label>
              <Form.Control
                type="date"
                value={fechaEmision}
                onChange={(e) => {
                  setFechaEmision(e.target.value);
                  setEmisionTocada(true);
                }}
              />
              <Form.Text className="text-muted">Por defecto, el 1° del mes siguiente.</Form.Text>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small fw-bold text-secondary">Ciudad</Form.Label>
              <Form.Control value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small fw-bold text-secondary">Iniciales</Form.Label>
              <Form.Control
                value={iniciales}
                onChange={(e) => setIniciales(e.target.value)}
                maxLength={6}
              />
              <Form.Text className="text-muted">CDC/JAN/{iniciales.toLowerCase()}</Form.Text>
            </Col>
            <Col xs={12} md={2}>
              <Form.Label className="small fw-bold text-secondary">Formato</Form.Label>
              <Form.Select
                value={formato}
                onChange={(e) => setFormato(e.target.value as 'pdf' | 'docx')}
              >
                <option value="pdf">PDF</option>
                <option value="docx">Word (.docx)</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* PASO 2 — Trabajadores y horas                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="fw-bold text-dark">
            <Badge bg="primary" className="me-2">
              2
            </Badge>
            Trabajadores y horas
          </span>
          <Badge bg={seleccionados.size > 0 ? 'success' : 'secondary'} className="fw-normal">
            {seleccionados.size} seleccionado(s)
          </Badge>
        </Card.Header>
        <Card.Body className="p-4">
          <Row className="g-3 mb-3">
            <Col xs={12} md={4}>
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <i className="bi bi-search text-secondary"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Buscar por nombre o RUT..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPaginaActual(1);
                  }}
                />
              </InputGroup>
            </Col>
            <Col xs={12} md={3}>
              <Form.Select
                value={programa}
                onChange={(e) => {
                  setPrograma(e.target.value);
                  setPaginaActual(1);
                }}
              >
                <option value="">Todos los programas</option>
                {programasDisponibles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value={SIN_PROGRAMA}>Sin programa asignado</option>
              </Form.Select>
            </Col>
            <Col xs={12} md={5}>
              <InputGroup>
                <InputGroup.Text className="bg-white small">Horas para todos</InputGroup.Text>
                <Form.Control
                  type="number"
                  min={1}
                  placeholder="Ej: 32"
                  value={horasPorDefecto}
                  onChange={(e) => setHorasPorDefecto(e.target.value)}
                />
                <Button
                  variant="outline-primary"
                  onClick={aplicarHorasATodos}
                  disabled={seleccionados.size === 0 || !horasPorDefecto.trim()}
                >
                  Aplicar
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                Se usa como valor por defecto; puedes ajustar cada fila.
              </Form.Text>
            </Col>
          </Row>

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {/* Alterna entre el listado completo y solo lo marcado, para revisar
                  la selección sin perderla de vista entre 327 trabajadores. */}
              <ButtonGroup size="sm">
                <Button
                  variant={verSoloSeleccionados ? 'outline-primary' : 'primary'}
                  onClick={() => {
                    setSoloSeleccionados(false);
                    setPaginaActual(1);
                  }}
                >
                  Todos
                </Button>
                <Button
                  variant={verSoloSeleccionados ? 'primary' : 'outline-primary'}
                  onClick={() => {
                    setSoloSeleccionados(true);
                    setPaginaActual(1);
                  }}
                  disabled={seleccionados.size === 0}
                >
                  <i className="bi bi-check2-square me-1"></i>
                  Solo seleccionados ({seleccionados.size})
                </Button>
              </ButtonGroup>
              <span className="text-muted small">
                {filtrados.length} trabajador(es) en la lista
              </span>
            </div>
            <div className="d-flex gap-2">
              {!verSoloSeleccionados && (
                <Button size="sm" variant="outline-secondary" onClick={seleccionarFiltrados}>
                  Seleccionar los {filtrados.length} filtrados
                </Button>
              )}
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setSeleccionados(new Set())}
                disabled={seleccionados.size === 0}
              >
                Limpiar selección
              </Button>
            </div>
          </div>

          <div className="table-responsive border rounded">
            <Table hover className="align-middle mb-0">
              <thead
                className="bg-light text-secondary text-uppercase"
                style={{ fontSize: '0.75rem' }}
              >
                <tr>
                  <th className="px-3" style={{ width: 44 }}>
                    <Form.Check
                      checked={paginaCompleta}
                      onChange={alternarPagina}
                      aria-label="Seleccionar página"
                    />
                  </th>
                  <th>Trabajador</th>
                  <th>RUT</th>
                  <th>Programa</th>
                  <th style={{ width: 130 }}>Horas</th>
                  <th style={{ width: 90 }}>Datos</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando trabajadores...
                    </td>
                  </tr>
                ) : pagina.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted">
                      No hay trabajadores con esos criterios.
                    </td>
                  </tr>
                ) : (
                  pagina.map((t) => {
                    const marcado = seleccionados.has(t.rut);
                    const faltan = camposFaltantes(t);
                    return (
                      <tr key={t.rut} className={marcado ? 'table-primary bg-opacity-10' : ''}>
                        <td className="px-3">
                          <Form.Check checked={marcado} onChange={() => alternar(t.rut)} />
                        </td>
                        <td className="small">
                          {t.nombres} {t.primer_apellido} {t.segundo_apellido ?? ''}
                        </td>
                        <td className="small font-monospace text-muted">
                          {formatearRutFiniquito(t.rut, t.dv)}
                        </td>
                        <td>
                          {t.programa ? (
                            <Badge bg="info" className="fw-normal">
                              {t.programa}
                            </Badge>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={1}
                            placeholder={horasPorDefecto || '—'}
                            value={horasPorRut[t.rut] ?? ''}
                            onChange={(e) =>
                              setHorasPorRut({ ...horasPorRut, [t.rut]: e.target.value })
                            }
                            disabled={!marcado}
                          />
                        </td>
                        <td>
                          {faltan.length === 0 ? (
                            <span className="text-success small">
                              <i className="bi bi-check-circle-fill"></i> Completo
                            </span>
                          ) : (
                            <OverlayTrigger
                              overlay={
                                <Tooltip>
                                  Falta: {faltan.join(', ')}. El documento saldrá con esos espacios
                                  en blanco.
                                </Tooltip>
                              }
                            >
                              <span className="text-warning small" style={{ cursor: 'help' }}>
                                <i className="bi bi-exclamation-triangle-fill"></i> Faltan{' '}
                                {faltan.length}
                              </span>
                            </OverlayTrigger>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-3">
            <Pagination
              paginaActual={paginaSegura}
              totalPaginas={totalPaginas}
              onPaginaChange={setPaginaActual}
            />
          </div>
        </Card.Body>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* PASO 3 — Generar                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card className="shadow-sm border-0 mb-5">
        <Card.Header className="bg-white border-bottom py-3">
          <span className="fw-bold text-dark">
            <Badge bg="primary" className="me-2">
              3
            </Badge>
            Generar
          </span>
        </Card.Header>
        <Card.Body className="p-4">
          {conDatosIncompletos.length > 0 && (
            <Alert variant="warning" className="small">
              <strong>
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                {conDatosIncompletos.length} trabajador(es) con datos personales incompletos
              </strong>
              <div className="mt-2">
                El anexo se genera igual, pero esos campos saldrán en blanco. Puedes completarlos en
                la ficha de cada trabajador, o cargarlos de una vez desde una planilla en{' '}
                <Link href="/dashboard/admin/importar">Importar datos personales</Link>.
              </div>
              <ul className="mb-0 mt-2">
                {conDatosIncompletos.slice(0, 5).map(({ t, faltan }) => (
                  <li key={t.rut}>
                    {t.nombres} {t.primer_apellido} — falta {faltan.join(', ').toLowerCase()}
                  </li>
                ))}
                {conDatosIncompletos.length > 5 && (
                  <li className="text-muted">y {conDatosIncompletos.length - 5} más...</li>
                )}
              </ul>
            </Alert>
          )}

          {sinHoras.length > 0 && (
            <Alert variant="danger" className="small mb-3">
              <i className="bi bi-x-circle-fill me-1"></i>
              Falta indicar las horas de {sinHoras.length} trabajador(es) seleccionado(s).
            </Alert>
          )}

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div className="text-muted small">
              {seleccionados.size > 0 ? (
                <>
                  Se generarán <strong className="text-dark">{seleccionados.size}</strong> anexo(s)
                  de <strong className="text-dark">{mesEnPalabras(mes) || '—'}</strong>, en un solo
                  archivo {formato.toUpperCase()} con una página por trabajador.
                </>
              ) : (
                'Selecciona al menos un trabajador.'
              )}
            </div>
            <Button
              variant="primary"
              size="lg"
              className="fw-semibold"
              onClick={generar}
              disabled={generando || seleccionados.size === 0 || sinHoras.length > 0}
            >
              {generando ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Generando...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-arrow-down me-2"></i>
                  Generar anexos
                </>
              )}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
