'use client';
// app/dashboard/admin/importar/page.tsx
// Importa datos personales de trabajadores desde una planilla Excel.
//
// Modifica datos maestros, así que vive bajo /dashboard/admin (proxy.ts exige
// rol admin) y siempre muestra una SIMULACIÓN antes de escribir: primero se ve
// exactamente qué cambiaría, después se confirma.

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Card, Button, Form, Table, Badge, Alert, Spinner, Row, Col } from 'react-bootstrap';

interface CambioCampo {
  campo: string;
  antes: string;
  despues: string;
}

interface ResumenTrabajador {
  rut: number;
  nombre: string;
  cambios: CambioCampo[];
  programa?: string;
}

interface Simulacion {
  simulacion: true;
  hoja: string;
  hojas: string[];
  filasLeidas: number;
  trabajadoresEnPlanilla: number;
  noEncontrados: number[];
  errores: { fila: number; motivo: string }[];
  resumen: ResumenTrabajador[];
}

const ETIQUETAS: Record<string, string> = {
  dv: 'Dígito verificador',
  nombres: 'Nombres',
  primer_apellido: 'Apellido paterno',
  segundo_apellido: 'Apellido materno',
  genero: 'Género',
  nacionalidad: 'Nacionalidad',
  estado_civil: 'Estado civil',
  domicilio: 'Domicilio',
  comuna: 'Ciudad',
  fecha_nac: 'Fecha de nacimiento',
  lugar_nac: 'Lugar de nacimiento',
};

export default function ImportarPersonalesPage() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hoja, setHoja] = useState('');
  const [sobrescribir, setSobrescribir] = useState(false);
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (aplicar: boolean) => {
    if (!archivo) {
      toast.error('Adjunta la planilla.');
      return;
    }
    setTrabajando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('archivo', archivo);
      form.append('hoja', hoja);
      form.append('sobrescribir', String(sobrescribir));
      form.append('aplicar', String(aplicar));

      const res = await fetch('/api/admin/importar-personales', { method: 'POST', body: form });
      const cuerpo = await res.json();
      if (!res.ok) {
        if (Array.isArray(cuerpo.hojas)) setSimulacion(null);
        throw new Error(cuerpo.error ?? 'No se pudo procesar la planilla.');
      }

      if (aplicar) {
        toast.success(
          `${cuerpo.actualizados} trabajador(es) actualizado(s)` +
            (cuerpo.contratosMarcados
              ? `, ${cuerpo.contratosMarcados} contrato(s) marcados.`
              : '.'),
        );
        if (Array.isArray(cuerpo.fallos) && cuerpo.fallos.length > 0) {
          setError(
            `Se aplicó con ${cuerpo.fallos.length} problema(s): ` +
              cuerpo.fallos
                .slice(0, 3)
                .map((f: { rut: number; motivo: string }) => `${f.rut}: ${f.motivo}`)
                .join(' · '),
          );
        }
        setSimulacion(null);
        setArchivo(null);
      } else {
        setSimulacion(cuerpo as Simulacion);
        if ((cuerpo as Simulacion).resumen.length === 0) {
          toast('No hay nada que cambiar: la base ya tiene esos datos.', { icon: 'ℹ️' });
        }
      }
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo procesar la planilla.';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setTrabajando(false);
    }
  };

  const totalCambios = simulacion?.resumen.reduce((a, t) => a + t.cambios.length, 0) ?? 0;

  return (
    <div className="container-fluid" style={{ maxWidth: '1050px' }}>
      <div className="mb-3">
        <Link href="/dashboard/admin" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a la Consola
        </Link>
      </div>

      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-upload text-primary me-2"></i>
          Importar datos personales
        </h3>
        <p className="text-muted small m-0">
          Completa domicilio, ciudad, fecha de nacimiento, estado civil, nacionalidad y género de
          los trabajadores a partir de una planilla. Las columnas se reconocen por su nombre, así
          que sirve tanto la planilla de horas extra como cualquier otra con esos encabezados.
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card className="shadow-sm border-0 mb-4">
        <Card.Body className="p-4">
          <Row className="g-3 align-items-end">
            <Col xs={12} md={6}>
              <Form.Label className="small fw-bold text-secondary">
                Planilla (.xlsx / .xlsm)
              </Form.Label>
              <Form.Control
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
                  setArchivo(f);
                  setSimulacion(null);
                }}
              />
            </Col>
            <Col xs={12} md={3}>
              <Form.Label className="small fw-bold text-secondary">Hoja</Form.Label>
              <Form.Select value={hoja} onChange={(e) => setHoja(e.target.value)}>
                <option value="">Primera hoja</option>
                {(simulacion?.hojas ?? []).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={3}>
              <Button
                variant="primary"
                className="fw-semibold w-100"
                onClick={() => enviar(false)}
                disabled={trabajando || !archivo}
              >
                {trabajando ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Revisando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-eye me-1"></i> Previsualizar
                  </>
                )}
              </Button>
            </Col>
          </Row>

          <Form.Check
            className="mt-3 small"
            type="checkbox"
            id="sobrescribir"
            checked={sobrescribir}
            onChange={(e) => {
              setSobrescribir(e.target.checked);
              setSimulacion(null);
            }}
            label="Sobrescribir datos que ya existen en la base (por defecto solo se rellenan los campos vacíos)"
          />
        </Card.Body>
      </Card>

      {simulacion && (
        <Card className="shadow-sm border-0 mb-5">
          <Card.Header className="bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span className="fw-bold text-dark">
              <i className="bi bi-eye me-2 text-primary"></i>
              Vista previa — hoja &quot;{simulacion.hoja}&quot;
            </span>
            <Badge bg="secondary" className="fw-normal">
              {simulacion.filasLeidas} filas · {simulacion.trabajadoresEnPlanilla} trabajadores
            </Badge>
          </Card.Header>
          <Card.Body className="p-4">
            {simulacion.noEncontrados.length > 0 && (
              <Alert variant="warning" className="small">
                <strong>{simulacion.noEncontrados.length} RUT(s) no están en la base</strong> y se
                omitirán. Esta pantalla solo completa datos de trabajadores ya registrados; no crea
                fichas nuevas.
                <div className="font-monospace mt-1">
                  {simulacion.noEncontrados.slice(0, 12).join(', ')}
                  {simulacion.noEncontrados.length > 12 ? ' ...' : ''}
                </div>
              </Alert>
            )}

            {simulacion.errores.length > 0 && (
              <Alert variant="warning" className="small">
                <strong>{simulacion.errores.length} fila(s) con problemas:</strong>
                <ul className="mb-0 mt-1">
                  {simulacion.errores.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      Fila {e.fila}: {e.motivo}
                    </li>
                  ))}
                  {simulacion.errores.length > 5 && (
                    <li className="text-muted">y {simulacion.errores.length - 5} más...</li>
                  )}
                </ul>
              </Alert>
            )}

            {simulacion.resumen.length === 0 ? (
              <Alert variant="info" className="small mb-0">
                No hay nada que cambiar. Los trabajadores de la planilla ya tienen esos datos en la
                base.
                {!sobrescribir && ' Marca "sobrescribir" si quieres reemplazarlos igualmente.'}
              </Alert>
            ) : (
              <>
                <p className="small text-muted">
                  Se modificarán <strong className="text-dark">{simulacion.resumen.length}</strong>{' '}
                  trabajador(es), <strong className="text-dark">{totalCambios}</strong> campo(s) en
                  total.
                </p>
                <div className="table-responsive border rounded" style={{ maxHeight: 460 }}>
                  <Table size="sm" hover className="align-middle mb-0">
                    <thead
                      className="bg-light text-secondary text-uppercase"
                      style={{ fontSize: '0.7rem', position: 'sticky', top: 0 }}
                    >
                      <tr>
                        <th className="px-3">RUT</th>
                        <th>Trabajador</th>
                        <th>Cambios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulacion.resumen.map((t) => (
                        <tr key={t.rut}>
                          <td className="px-3 font-monospace small">{t.rut}</td>
                          <td className="small">{t.nombre}</td>
                          <td className="small">
                            {t.cambios.map((c) => (
                              <div key={c.campo}>
                                <span className="text-secondary">
                                  {ETIQUETAS[c.campo] ?? c.campo}:
                                </span>{' '}
                                {c.antes ? (
                                  <>
                                    <span className="text-danger text-decoration-line-through">
                                      {c.antes}
                                    </span>{' '}
                                    <i className="bi bi-arrow-right"></i>{' '}
                                  </>
                                ) : (
                                  <span className="text-muted">(vacío) </span>
                                )}
                                <span className="text-success fw-semibold">{c.despues}</span>
                              </div>
                            ))}
                            {t.programa && (
                              <div>
                                <span className="text-secondary">Programa del contrato:</span>{' '}
                                <span className="text-success fw-semibold">{t.programa}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button
                    variant="outline-secondary"
                    className="fw-semibold"
                    onClick={() => setSimulacion(null)}
                    disabled={trabajando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="success"
                    className="fw-semibold"
                    onClick={() => enviar(true)}
                    disabled={trabajando}
                  >
                    {trabajando ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-1"></i>
                        Aplicar {totalCambios} cambio(s)
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
