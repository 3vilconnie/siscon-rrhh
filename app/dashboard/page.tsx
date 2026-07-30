// app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Card, Table, Badge, Button, Spinner, Row, Col } from 'react-bootstrap';
import AlertasPanel from '@/components/AlertasPanel';
import { Trabajador } from '@/types';
import AiChatSidebar from "@/components/AiChatSidebar";

export default function TrabajadoresPage() {
  // CORRECCIÓN: Cambiado de Exc_Trabajador[] a Trabajador[]
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function obtenerTrabajadores() {
      const { data, error } = await supabase
        .from('trabajadores')
        .select(`
          rut, dv, nombres, primer_apellido, segundo_apellido,
          contratos(count)
        `)
        .returns<Trabajador[]>();

      if (!error && data) {
        setTrabajadores(data);
      }
      setLoading(false);
    }
    obtenerTrabajadores();
  }, []);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="text-dark fw-bold m-0">Nómina de Trabajadores</h2>
          <p className="text-muted small m-0">Visualización general del personal y estado contractual acumulado.</p>
        </div>
        {trabajadores.length > 0 && (
          <Button as={Link as any} href="/dashboard/formulario" variant="primary" size="sm" className="fw-bold shadow-sm">
            <i className="bi bi-person-plus me-2"></i>Nuevo Trabajador
          </Button>
        )}
      </div>

      <AlertasPanel />

      {/* MANEJO DE ESTADOS DE CARGA Y CONTENIDO */}
      {loading ? (
        <Card className="shadow-sm border-0 bg-white p-5 text-center text-muted">
          <Spinner animation="border" className="text-primary mb-3 mx-auto" role="status" />
          <p className="m-0 fw-medium">Sincronizando nómina institucional con Supabase...</p>
        </Card>
      ) : trabajadores.length === 0 ? (
        // UX OPTIMIZADA: EMPTY STATE INSPIRADOR CON ACCIONES DIRECTAS
        <Card className="shadow-sm border-0 bg-white p-5 text-center my-3 animate__animated animate__fadeIn">
          <div className="card-body mx-auto" style={{ maxWidth: '550px' }}>
            <div className="bg-light text-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-4 shadow-sm" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-database-fill-add display-6"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">Bienvenido a siscon RRHH</h4>
            <p className="text-secondary small mb-4">
              La base de datos de control contractual se encuentra vacía en este momento. Para comenzar a auditar alertas de continuidad y horas compensatorias, selecciona una de las siguientes opciones de alimentación:
            </p>
            
            <Row className="g-3">
              <Col sm={6}>
                <div className="p-3 border rounded bg-light h-100 d-flex flex-column justify-content-between">
                  <div>
                    <h6 className="fw-bold text-dark mb-1 small"><i className="bi bi-cloud-arrow-up-fill text-success me-1"></i> Carga Masiva</h6>
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>Importa los reportes unificados de planillas exportadas desde SIGPER.</p>
                  </div>
                  <Button as={Link as any} href="/dashboard/carga-masiva" size="sm" variant="success" className="w-100 fw-bold mt-2">
                    Subir Excel
                  </Button>
                </div>
              </Col>

              <Col sm={6}>
                <div className="p-3 border rounded bg-light h-100 d-flex flex-column justify-content-between">
                  <div>
                    <h6 className="fw-bold text-dark mb-1 small"><i className="bi bi-person-plus-fill text-primary me-1"></i> Registro Manual</h6>
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>Inscribe de forma individual la ficha de identidad y anexo de un nuevo funcionario.</p>
                  </div>
                  <Button as={Link as any} href="/dashboard/formulario" size="sm" variant="primary" className="w-100 fw-bold mt-2">
                    Crear Ficha
                  </Button>
                </div>
              </Col>
            </Row>
          </div>
        </Card>
      ) : (
        // TABLA ESTÁNDAR CUANDO SÍ HAY DATOS
        <Card className="shadow-sm border-0 bg-white">
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-dark">
                  <tr>
                    <th className="ps-4 py-3" style={{ backgroundColor: '#212529' }}>RUT</th>
                    <th className="py-3" style={{ backgroundColor: '#212529' }}>Nombre Completo</th>
                    <th className="text-center py-3" style={{ backgroundColor: '#212529' }}>N° Contratos</th>
                    <th className="text-end pe-4 py-3" style={{ backgroundColor: '#212529' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadores.map((t) => {
                    const totalContratos = t.contratos?.[0]?.count || 0;
                    return (
                      <tr key={t.rut}>
                        <td className="ps-4 fw-semibold text-secondary">{t.rut}-{t.dv}</td>
                        <td className="text-uppercase text-dark">
                          {t.primer_apellido} {t.segundo_apellido || ''} {t.nombres}
                        </td>
                        <td className="text-center">
                          <Badge bg={totalContratos > 1 ? 'info' : 'light'} text="dark" className={totalContratos > 1 ? '' : 'border'}>
                            {totalContratos} {totalContratos === 1 ? 'contrato' : 'contratos'}
                          </Badge>
                        </td>
                        <td className="text-end pe-4">
                          {/* CORRECCIÓN: Separación del espacio en la clase py-1 fw-bold */}
                          <Button as={Link as any} href={`/dashboard/trabajadores/${t.rut}`} size="sm" variant="outline-primary" className="py-1 fw-bold">
                            <i className="bi bi-eye-fill me-1"></i> Ver Detalle
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

    </div>
  );
}