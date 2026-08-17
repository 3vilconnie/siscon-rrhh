'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Card, Badge, Button, Spinner, Modal, Form, Row, Col } from 'react-bootstrap';
import { Trabajador, Contrato } from '@/types';
import { AFP_OPCIONES as PREVISIONES_AFP, SALUD_OPCIONES as SISTEMAS_SALUD } from '@/lib/contrato';
import React from 'react';

export default function DetalleTrabajadorPage() {
  const params = useParams();
  const router = useRouter();

  const [empleado, setEmpleado] = useState<Trabajador | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados Modal Edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [contratoAEditar, setContratoAEditar] = useState<Contrato | null>(null);

  const [editJornada, setEditJornada] = useState(44);
  const [editSueldo, setEditSueldo] = useState(0);
  const [editInicio, setEditInicio] = useState('');
  const [editTermino, setEditTermino] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Estados Modal Datos Personales
  const [modalPersonalAbierto, setModalPersonalAbierto] = useState(false);
  const [editNacionalidad, setEditNacionalidad] = useState('');
  const [editEstadoCivil, setEditEstadoCivil] = useState('');
  const [editLugarNac, setEditLugarNac] = useState('');
  const [editFechaNac, setEditFechaNac] = useState('');
  const [editDomicilio, setEditDomicilio] = useState('');
  const [editComuna, setEditComuna] = useState('');
  const [editPrevision, setEditPrevision] = useState('');
  const [editSalud, setEditSalud] = useState('');
  const [editGenero, setEditGenero] = useState('');
  const [guardandoPersonal, setGuardandoPersonal] = useState(false);

  const obtenerDetalle = async () => {
    if (!params.rut) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('trabajadores')
      .select(
        `rut, dv, nombres, primer_apellido, segundo_apellido, genero, nacionalidad, estado_civil, lugar_nac, fecha_nac, domicilio, comuna, prevision, salud, contratos(id, jornada, sueldo_base, fecha_inicio, fecha_termino, tipo, contrato_origen_id)`,
      )
      .eq('rut', parseInt(params.rut as string))
      .single();

    if (error || !data) {
      toast.error('Trabajador no encontrado en la base de datos.');
      router.push('/dashboard/trabajadores');
    } else {
      if (data.contratos) {
        data.contratos.sort(
          (a: any, b: any) =>
            new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime(),
        );
      }
      setEmpleado(data as Trabajador);
    }
    setLoading(false);
  };

  useEffect(() => {
    obtenerDetalle();
  }, [params.rut]);

  const abrirEdicion = (c: Contrato) => {
    setContratoAEditar(c);
    setEditJornada(c.jornada || 44);
    setEditSueldo(c.sueldo_base || 0);
    setEditInicio(c.fecha_inicio);
    setEditTermino(c.fecha_termino || '');
    setModalAbierto(true);
  };

  const abrirEdicionPersonal = () => {
    if (!empleado) return;
    setEditGenero(empleado.genero || '');
    setEditNacionalidad(empleado.nacionalidad || '');
    setEditEstadoCivil(empleado.estado_civil || '');
    setEditLugarNac(empleado.lugar_nac || '');
    setEditFechaNac(empleado.fecha_nac || '');
    setEditDomicilio(empleado.domicilio || '');
    setEditComuna(empleado.comuna || '');
    setEditPrevision(empleado.prevision || '');
    setEditSalud(empleado.salud || '');
    setModalPersonalAbierto(true);
  };

  const handleGuardarPersonal = async () => {
    if (!empleado) return;
    const toastId = toast.loading('Guardando datos personales...');
    setGuardandoPersonal(true);

    const { error } = await supabase
      .from('trabajadores')
      .update({
        genero: editGenero || null,
        nacionalidad: editNacionalidad || null,
        estado_civil: editEstadoCivil || null,
        lugar_nac: editLugarNac || null,
        fecha_nac: editFechaNac || null,
        domicilio: editDomicilio || null,
        comuna: editComuna || null,
        prevision: editPrevision || null,
        salud: editSalud || null,
      })
      .eq('rut', empleado.rut);

    setGuardandoPersonal(false);

    if (error) {
      toast.error('Error al actualizar datos: ' + error.message, { id: toastId });
    } else {
      await registrarAuditoria(
        'EDITAR_TRABAJADOR',
        `Datos personales actualizados (RUT ${empleado.rut})`,
      );
      toast.success('Datos actualizados exitosamente', { id: toastId });
      setModalPersonalAbierto(false);
      await obtenerDetalle();
    }
  };

  const handleGuardarCambios = async () => {
    if (!contratoAEditar) return;

    if (!editInicio) {
      toast.error('La fecha de inicio es obligatoria.');
      return;
    }

    if (editTermino && new Date(editTermino) < new Date(editInicio)) {
      toast.error('La fecha de término no puede ser anterior a la fecha de inicio.');
      return;
    }

    const otrosContratos = empleado?.contratos?.filter((c) => c.id !== contratoAEditar.id) || [];

    if (otrosContratos.length > 0) {
      const inicioNuevo = new Date(editInicio);
      const terminoNuevo = editTermino ? new Date(editTermino) : new Date('2099-12-31');

      const hayTraslape = otrosContratos.some((contrato) => {
        const inicioExistente = new Date(contrato.fecha_inicio);
        const terminoExistente = contrato.fecha_termino
          ? new Date(contrato.fecha_termino)
          : new Date('2099-12-31');
        return inicioNuevo <= terminoExistente && terminoNuevo >= inicioExistente;
      });

      if (hayTraslape) {
        toast.error(
          'Restricción Contractual: El período ingresado se superpone con las fechas de otro contrato.',
          { duration: 5000 },
        );
        return;
      }
    }

    const toastId = toast.loading('Guardando modificaciones...');
    setGuardando(true);

    const { error } = await supabase
      .from('contratos')
      .update({
        jornada: editJornada,
        sueldo_base: editSueldo,
        fecha_inicio: editInicio,
        fecha_termino: editTermino || null,
      })
      .eq('id', contratoAEditar.id);

    setGuardando(false);

    if (error) {
      toast.error('Error al actualizar: ' + error.message, { id: toastId });
    } else {
      await registrarAuditoria(
        ACCIONES.EDITAR_CONTRATO,
        `Contrato ${contratoAEditar.id} (RUT ${params.rut}): ${editInicio} → ${editTermino || 'Indefinido'}, jornada ${editJornada}h, sueldo $${editSueldo}`,
      );
      toast.success('Contrato actualizado exitosamente', { id: toastId });
      setModalAbierto(false);
      await obtenerDetalle();
    }
  };

  // Función auxiliar para calcular la brecha de enfriamiento
  const calcularBrecha = (finPrevio: string | null, inicioActual: string) => {
    if (!finPrevio) return null;
    const d1 = new Date(finPrevio + 'T00:00:00');
    const d2 = new Date(inicioActual + 'T00:00:00');
    if (d2 <= d1) return null;

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = (diffDays / 30.44).toFixed(1);

    return { dias: diffDays, meses: parseFloat(diffMonths) };
  };

  if (loading)
    return (
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    );
  if (!empleado) return null;

  return (
    <div className="container-fluid" style={{ maxWidth: '900px' }}>
      <div className="mb-3">
        <Link href="/dashboard/trabajadores" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a la lista
        </Link>
      </div>

      <Card className="shadow-sm border-0 mb-4 bg-dark text-white">
        <Card.Body className="p-4 d-flex justify-content-between align-items-center">
          <div>
            <Badge bg="info" text="dark" className="mb-2 font-monospace">
              Ficha del Trabajador
            </Badge>
            <h2 className="fw-bold m-0 text-uppercase">
              {empleado.nombres} {empleado.primer_apellido} {empleado.segundo_apellido || ''}
            </h2>
            <p className="text-light-50 m-0 mt-1 small">
              RUN: {empleado.rut}-{empleado.dv}
            </p>
            <Button
              variant="outline-info"
              size="sm"
              className="mt-3 d-flex align-items-center rounded-pill px-3"
              onClick={abrirEdicionPersonal}
            >
              <i className="bi bi-pencil-square me-2"></i> Editar Datos Personales
            </Button>
          </div>
          <i className="bi bi-person-badge text-white-50" style={{ fontSize: '3.5rem' }}></i>
        </Card.Body>
      </Card>

      <h4 className="fw-bold text-dark mb-4">Línea de Tiempo Contractual</h4>

      <div className="ms-3 mb-5 position-relative border-start border-2 border-primary">
        {empleado.contratos && empleado.contratos.length > 0 ? (
          empleado.contratos.map((c, idx) => {
            const esVigente = !c.fecha_termino || new Date(c.fecha_termino) >= new Date();
            const contratoPrevio = idx > 0 ? empleado.contratos![idx - 1] : null;
            const brecha = contratoPrevio
              ? calcularBrecha(contratoPrevio.fecha_termino, c.fecha_inicio)
              : null;

            return (
              <React.Fragment key={c.id}>
                {/* NODO DE BRECHA DE ENFRIAMIENTO (Aparece entre contratos) */}
                {brecha && (
                  <div className="position-relative mb-4 ps-4">
                    <div
                      className="position-absolute rounded-circle bg-warning border border-2 border-white"
                      style={{
                        width: '16px',
                        height: '16px',
                        left: '-9px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    ></div>
                    <Badge
                      bg={brecha.meses < 3 ? 'danger' : 'success'}
                      className="text-white border"
                    >
                      <i className="bi bi-clock-history me-1"></i>
                      Brecha: {brecha.meses} meses ({brecha.dias} días)
                    </Badge>
                    {brecha.meses < 3 && (
                      <span className="text-danger small ms-2 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i> No cumple enfriamiento
                        legal
                      </span>
                    )}
                  </div>
                )}

                {/* TARJETA DEL CONTRATO (Línea de tiempo) */}
                <div className="position-relative mb-4 ps-4">
                  <div
                    className="position-absolute rounded-circle bg-primary text-white d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: '32px',
                      height: '32px',
                      left: '-17px',
                      top: '10px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {idx + 1}
                  </div>

                  <Card
                    className={`border-0 shadow-sm transition-all hover-shadow ${esVigente ? 'border-start border-4 border-success' : 'border-start border-4 border-secondary'}`}
                  >
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="fw-bold text-uppercase text-dark m-0 d-flex align-items-center">
                          <i className="bi bi-file-earmark-person me-2 text-primary"></i>
                          {c.tipo === 'anexo' ? 'Anexo de Ampliación' : 'Contrato Registrado'}
                        </h6>
                        <div className="d-flex gap-2">
                          {c.tipo === 'anexo' && (
                            <Badge bg="info-subtle" text="info" className="border fw-normal">
                              <i className="bi bi-file-earmark-plus me-1"></i>Anexo
                            </Badge>
                          )}
                          <Badge bg={esVigente ? 'success' : 'secondary'}>
                            {esVigente ? 'Vigente' : 'Terminado'}
                          </Badge>
                        </div>
                      </div>

                      {c.tipo === 'anexo' &&
                        (() => {
                          const origen = empleado.contratos?.find(
                            (o) => o.id === c.contrato_origen_id,
                          );
                          return origen ? (
                            <div className="text-muted small mb-2">
                              <i className="bi bi-link-45deg me-1"></i>
                              Amplía el contrato iniciado el{' '}
                              {new Date(origen.fecha_inicio + 'T00:00:00').toLocaleDateString(
                                'es-CL',
                              )}
                            </div>
                          ) : null;
                        })()}

                      <Row className="mt-3 text-dark small">
                        <Col sm={6} className="mb-2">
                          <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                            PERÍODO
                          </span>
                          <span className="fw-semibold">
                            {new Date(c.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CL')}
                          </span>{' '}
                          a{' '}
                          <span className="fw-semibold">
                            {c.fecha_termino
                              ? new Date(c.fecha_termino + 'T00:00:00').toLocaleDateString('es-CL')
                              : 'Indefinido'}
                          </span>
                        </Col>
                        <Col sm={3} className="mb-2">
                          <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                            JORNADA
                          </span>
                          <span className="fw-semibold">{c.jornada} Hrs.</span>
                        </Col>
                        <Col sm={3} className="mb-2">
                          <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                            SUELDO BASE
                          </span>
                          <span className="fw-semibold">
                            ${parseFloat(c.sueldo_base?.toString() || '0').toLocaleString('es-CL')}
                          </span>
                        </Col>
                      </Row>

                      <div className="border-top pt-2 mt-2 text-end">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => abrirEdicion(c)}
                          className="text-primary text-decoration-none p-0 fw-semibold"
                        >
                          <i className="bi bi-pencil-square me-1"></i> Editar Fechas
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </div>
              </React.Fragment>
            );
          })
        ) : (
          <div className="ps-4 text-muted py-2 small">
            No existen registros contractuales en la historia de este trabajador.
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN */}
      <Modal
        show={modalAbierto}
        onHide={() => setModalAbierto(false)}
        centered
        contentClassName="border-0 shadow-lg"
      >
        <Modal.Header closeButton closeVariant="white" className="bg-primary text-white">
          <Modal.Title className="fw-bold h5">Modificar Términos del Contrato</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Jornada (Horas)</Form.Label>
              <Form.Control
                type="number"
                value={editJornada}
                onChange={(e) => setEditJornada(parseInt(e.target.value) || 0)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Sueldo Base ($)</Form.Label>
              <Form.Control
                type="number"
                value={editSueldo}
                onChange={(e) => setEditSueldo(parseFloat(e.target.value) || 0)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Fecha de Inicio</Form.Label>
              <Form.Control
                type="date"
                value={editInicio}
                onChange={(e) => setEditInicio(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Fecha de Término</Form.Label>
              <Form.Control
                type="date"
                value={editTermino}
                onChange={(e) => setEditTermino(e.target.value)}
              />
              <Form.Text className="small" style={{ fontSize: '0.7rem' }}>
                Dejar en blanco si es indefinido.
              </Form.Text>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="bg-light border-top-0">
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            className="px-3"
            onClick={() => setModalAbierto(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="px-4 fw-bold"
            onClick={handleGuardarCambios}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MODAL DE DATOS PERSONALES */}
      <Modal
        show={modalPersonalAbierto}
        onHide={() => setModalPersonalAbierto(false)}
        centered
        contentClassName="border-0 shadow-lg"
      >
        <Modal.Header closeButton closeVariant="white" className="bg-info text-dark">
          <Modal.Title className="fw-bold h5">Editar Datos Personales</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Género</Form.Label>
              <Form.Select
                value={editGenero}
                onChange={(e) => setEditGenero(e.target.value)}
              >
                <option value="">Seleccione...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </Form.Select>
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Nacionalidad</Form.Label>
              <Form.Control
                type="text"
                value={editNacionalidad}
                onChange={(e) => setEditNacionalidad(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Estado Civil</Form.Label>
              <Form.Select
                value={editEstadoCivil}
                onChange={(e) => setEditEstadoCivil(e.target.value)}
              >
                <option value="">Seleccione...</option>
                <option value="Soltero">Soltero/a</option>
                <option value="Casado">Casado/a</option>
                <option value="Divorciado">Divorciado/a</option>
                <option value="Viudo">Viudo/a</option>
                <option value="Separado">Separado/a</option>
                <option value="Conviviente civil">Conviviente civil</option>
              </Form.Select>
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Lugar de Nacimiento</Form.Label>
              <Form.Control
                type="text"
                value={editLugarNac}
                onChange={(e) => setEditLugarNac(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Fecha de Nacimiento</Form.Label>
              <Form.Control
                type="date"
                value={editFechaNac}
                onChange={(e) => setEditFechaNac(e.target.value)}
              />
            </Col>
            <Col xs={12}>
              <Form.Label className="small fw-bold text-secondary">Domicilio</Form.Label>
              <Form.Control
                type="text"
                value={editDomicilio}
                onChange={(e) => setEditDomicilio(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Comuna</Form.Label>
              <Form.Control
                type="text"
                value={editComuna}
                onChange={(e) => setEditComuna(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Previsión (AFP)</Form.Label>
              <Form.Select
                value={editPrevision}
                onChange={(e) => setEditPrevision(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {PREVISIONES_AFP.map((afp) => (
                  <option key={afp} value={afp}>
                    {afp}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-bold text-secondary">Salud</Form.Label>
              <Form.Select
                value={editSalud}
                onChange={(e) => setEditSalud(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {SISTEMAS_SALUD.map((salud) => (
                  <option key={salud} value={salud}>
                    {salud}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="bg-light border-top-0">
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            className="px-3"
            onClick={() => setModalPersonalAbierto(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="info"
            className="px-4 fw-bold"
            onClick={handleGuardarPersonal}
            disabled={guardandoPersonal}
          >
            {guardandoPersonal ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
