'use client';
// app/dashboard/admin/plantillas/page.tsx
// Gestión de las plantillas Word del sistema: ver cuál está activa,
// descargarla para editarla, y reemplazarla validando y probando antes de
// activar. La ruta ya está protegida por proxy.ts (solo rol admin).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Table, Button, Badge, Form, Modal, Alert, Spinner } from 'react-bootstrap';

interface EstadoPlantilla {
  archivo: string;
  libFuente: string;
  personalizada: boolean;
  actualizadoEn: string | null;
  tieneHistorial: boolean;
}

interface ReporteValidacion {
  archivo: string;
  libFuente: string;
  totalEnDocx: number;
  noReconocidos: string[];
  noUtilizados: string[];
}

export default function GestionPlantillasPage() {
  const [plantillas, setPlantillas] = useState<EstadoPlantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [aviso, setAviso] = useState('');

  // Modal de reemplazo
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccionada, setSeleccionada] = useState<EstadoPlantilla | null>(null);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [reporte, setReporte] = useState<ReporteValidacion | null>(null);
  const [validando, setValidando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [activando, setActivando] = useState(false);
  const [aceptaRiesgo, setAceptaRiesgo] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  const cargarEstado = async () => {
    setCargando(true);
    setErrorGeneral('');
    try {
      const res = await fetch('/api/admin/plantillas');
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const { plantillas: lista } = await res.json();
      setPlantillas(lista);
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo cargar el listado.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  const abrirModal = (p: EstadoPlantilla) => {
    setSeleccionada(p);
    setArchivoNuevo(null);
    setReporte(null);
    setAceptaRiesgo(false);
    setErrorModal('');
    setModalAbierto(true);
  };

  /** Al elegir un archivo se valida de inmediato, para no dejar decidir a ciegas. */
  const handleArchivoElegido = async (file: File | null) => {
    setArchivoNuevo(file);
    setReporte(null);
    setAceptaRiesgo(false);
    setErrorModal('');
    if (!file || !seleccionada) return;

    setValidando(true);
    try {
      const fd = new FormData();
      fd.append('archivo', seleccionada.archivo);
      fd.append('file', file);
      const res = await fetch('/api/admin/plantillas/validar', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      setReporte(await res.json());
    } catch (error) {
      setErrorModal(error instanceof Error ? error.message : 'No se pudo validar el archivo.');
    } finally {
      setValidando(false);
    }
  };

  const descargarBlob = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleProbar = async (formato: 'docx' | 'pdf') => {
    if (!archivoNuevo || !seleccionada) return;
    setProbando(true);
    setErrorModal('');
    try {
      const fd = new FormData();
      fd.append('archivo', seleccionada.archivo);
      fd.append('file', archivoNuevo);
      fd.append('formato', formato);
      const res = await fetch('/api/admin/plantillas/probar', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      descargarBlob(
        await res.blob(),
        `PRUEBA_${seleccionada.archivo.replace(/\.docx$/, '')}.${formato}`,
      );
    } catch (error) {
      setErrorModal(error instanceof Error ? error.message : 'No se pudo generar la prueba.');
    } finally {
      setProbando(false);
    }
  };

  const handleActivar = async () => {
    if (!archivoNuevo || !seleccionada) return;
    setActivando(true);
    setErrorModal('');
    try {
      const fd = new FormData();
      fd.append('archivo', seleccionada.archivo);
      fd.append('file', archivoNuevo);
      const res = await fetch('/api/admin/plantillas', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      setModalAbierto(false);
      setAviso(`Plantilla "${seleccionada.archivo}" activada correctamente.`);
      await cargarEstado();
    } catch (error) {
      setErrorModal(error instanceof Error ? error.message : 'No se pudo activar la plantilla.');
    } finally {
      setActivando(false);
    }
  };

  const handleRevertir = async (p: EstadoPlantilla) => {
    setErrorGeneral('');
    try {
      const res = await fetch('/api/admin/plantillas/revertir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo: p.archivo }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setAviso(cuerpo.message);
      await cargarEstado();
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo revertir.');
    }
  };

  const hayAdvertencias = !!reporte && reporte.noReconocidos.length > 0;
  const puedeActivar = !!archivoNuevo && !validando && (!hayAdvertencias || aceptaRiesgo);

  return (
    <div className="container-fluid" style={{ maxWidth: '1100px' }}>
      <div className="mb-3">
        <Link href="/dashboard/admin" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a la Consola
        </Link>
      </div>

      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-file-earmark-code text-primary me-2"></i>
          Plantillas de Documentos
        </h3>
        <p className="text-muted small m-0">
          Reemplaza los formatos Word que usa el sistema sin editar archivos a mano. Antes de
          activar una plantilla se validan sus marcadores y puedes generar un documento de prueba
          con datos ficticios.
        </p>
      </div>

      {errorGeneral && (
        <Alert variant="danger" className="py-2 small">
          {errorGeneral}
        </Alert>
      )}
      {aviso && (
        <Alert variant="success" className="py-2 small" onClose={() => setAviso('')} dismissible>
          {aviso}
        </Alert>
      )}

      <Card className="shadow-sm border-0">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead
                className="bg-light text-secondary text-uppercase"
                style={{ fontSize: '0.8rem' }}
              >
                <tr>
                  <th className="px-3">Plantilla</th>
                  <th>Estado</th>
                  <th className="text-end px-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={3} className="text-center p-5 text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : (
                  plantillas.map((p) => (
                    <tr key={p.archivo}>
                      <td className="px-3">
                        <div className="fw-semibold text-dark">{p.archivo}</div>
                        <div className="text-muted small font-monospace">{p.libFuente}</div>
                      </td>
                      <td>
                        {p.personalizada ? (
                          <>
                            <Badge bg="primary-subtle" text="primary" className="border fw-normal">
                              <i className="bi bi-pencil-square me-1"></i>Personalizada
                            </Badge>
                            {p.actualizadoEn && (
                              <div className="text-muted small mt-1">
                                desde el{' '}
                                {new Date(p.actualizadoEn).toLocaleDateString('es-CL', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <Badge bg="light" text="dark" className="border fw-normal">
                            Versión del sistema
                          </Badge>
                        )}
                      </td>
                      <td className="text-end px-3">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="me-2"
                          href={`/api/admin/plantillas/descargar?archivo=${encodeURIComponent(p.archivo)}`}
                          title="Descargar la plantilla que se está usando"
                        >
                          <i className="bi bi-download"></i>
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          className="me-2 fw-semibold"
                          onClick={() => abrirModal(p)}
                        >
                          Reemplazar
                        </Button>
                        {p.personalizada && (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleRevertir(p)}
                            title={
                              p.tieneHistorial
                                ? 'Restaurar la versión anterior'
                                : 'Descartar la personalizada y volver a la del sistema'
                            }
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
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

      {/* --- MODAL: REEMPLAZAR PLANTILLA --- */}
      <Modal show={modalAbierto} onHide={() => setModalAbierto(false)} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="bg-primary text-white border-bottom-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-upload me-2"></i>Reemplazar {seleccionada?.archivo}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {errorModal && (
            <Alert variant="danger" className="py-2 small">
              {errorModal}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold text-secondary">
              Archivo .docx nuevo
            </Form.Label>
            <Form.Control
              type="file"
              accept=".docx"
              onChange={(e) => handleArchivoElegido((e.target as HTMLInputElement).files?.[0] ?? null)}
            />
            <Form.Text className="text-muted">
              Descarga la plantilla actual, edítala en Word y súbela aquí.
            </Form.Text>
          </Form.Group>

          {validando && (
            <div className="text-muted small">
              <Spinner animation="border" size="sm" className="me-2" />
              Validando marcadores...
            </div>
          )}

          {reporte && !validando && (
            <>
              {reporte.noReconocidos.length === 0 ? (
                <Alert variant="success" className="py-2 small">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  Plantilla válida: {reporte.totalEnDocx} marcador(es), todos reconocidos.
                </Alert>
              ) : (
                <Alert variant="warning" className="py-2 small">
                  <div className="fw-semibold mb-1">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {reporte.noReconocidos.length} marcador(es) no reconocido(s):
                  </div>
                  <ul className="mb-2 ps-4 font-monospace" style={{ fontSize: '0.78rem' }}>
                    {reporte.noReconocidos.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Puede ser un error de tipeo, o un campo válido que aún no está documentado en{' '}
                    <span className="font-monospace">{reporte.libFuente}</span>. Si es un typo, el
                    marcador saldrá impreso tal cual en el documento final.
                  </div>
                </Alert>
              )}

              <div className="bg-light border rounded p-3 mb-3">
                <div className="small fw-bold text-secondary mb-2">
                  Documento de prueba (datos ficticios)
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => handleProbar('docx')}
                    disabled={probando}
                  >
                    {probando ? 'Generando...' : 'Probar en Word'}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => handleProbar('pdf')}
                    disabled={probando}
                  >
                    {probando ? 'Generando...' : 'Probar en PDF'}
                  </Button>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                  Revisa márgenes, fechas y montos antes de activar.
                </div>
              </div>

              {hayAdvertencias && (
                <Form.Check
                  type="checkbox"
                  id="acepta-riesgo-plantilla"
                  checked={aceptaRiesgo}
                  onChange={(e) => setAceptaRiesgo(e.target.checked)}
                  label="Entiendo el riesgo y quiero activar esta plantilla de todas formas."
                  className="fw-semibold text-dark"
                />
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-0">
          <Button
            variant="outline-secondary"
            onClick={() => setModalAbierto(false)}
            className="fw-semibold"
            disabled={activando}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleActivar}
            className="fw-semibold shadow-sm"
            disabled={!puedeActivar || activando}
          >
            {activando ? 'Activando...' : 'Activar esta plantilla'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
