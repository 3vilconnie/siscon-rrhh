'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Card, Row, Col, Form, Button, Table, Badge, Modal, Spinner } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import { PlantillaContrato } from '@/types';
import { PROGRAMAS_CONTRATO } from '@/lib/contrato';

type FormPlantilla = {
  nombre: string;
  programa: string;
  labores: string;
  lugarTrabajo: string;
  dependenciaDir: string;
  jornada: number;
  incluirBonos: boolean;
  bonoMovilizacion: number;
  bonoColacion: number;
  ciudad: string;
  inicialesRedactor: string;
  sueldoSugerido: number;
};

const FORM_VACIO: FormPlantilla = {
  nombre: '',
  programa: PROGRAMAS_CONTRATO[0].id,
  labores: '',
  lugarTrabajo: '',
  dependenciaDir: '',
  jornada: 44,
  incluirBonos: false,
  bonoMovilizacion: 0,
  bonoColacion: 0,
  ciudad: 'Arica',
  inicialesRedactor: '',
  sueldoSugerido: 0,
};

export default function PlantillasContratoPage() {
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormPlantilla>(FORM_VACIO);

  const [plantillaAEliminar, setPlantillaAEliminar] = useState<PlantillaContrato | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargarPlantillas = async () => {
    const { data, error } = await supabase
      .from('plantillas_contrato')
      .select('*')
      .order('nombre');
    if (error) {
      toast.error('Error al cargar las plantillas.');
      console.error(error);
    }
    setPlantillas((data as PlantillaContrato[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await cargarPlantillas();
      setLoading(false);
    })();
  }, []);

  const abrirNueva = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setShowFormModal(true);
  };

  const abrirEditar = (p: PlantillaContrato) => {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      programa: p.programa,
      labores: p.labores ?? '',
      lugarTrabajo: p.lugar_trabajo ?? '',
      dependenciaDir: p.dependencia_dir ?? '',
      jornada: p.jornada ?? 44,
      incluirBonos: p.incluir_bonos,
      bonoMovilizacion: p.bono_movilizacion,
      bonoColacion: p.bono_colacion,
      ciudad: p.ciudad ?? 'Arica',
      inicialesRedactor: p.iniciales_redactor ?? '',
      sueldoSugerido: p.sueldo_sugerido,
    });
    setShowFormModal(true);
  };

  const cerrarFormModal = () => {
    setShowFormModal(false);
    setEditandoId(null);
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      toast.error('Ingresa un nombre para la plantilla.');
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        programa: form.programa,
        labores: form.labores || null,
        lugar_trabajo: form.lugarTrabajo || null,
        dependencia_dir: form.dependenciaDir || null,
        jornada: form.jornada || null,
        incluir_bonos: form.incluirBonos,
        bono_movilizacion: form.incluirBonos ? form.bonoMovilizacion : 0,
        bono_colacion: form.incluirBonos ? form.bonoColacion : 0,
        ciudad: form.ciudad || null,
        iniciales_redactor: form.inicialesRedactor || null,
        sueldo_sugerido: form.sueldoSugerido || 0,
      };

      if (editandoId) {
        const { error } = await supabase
          .from('plantillas_contrato')
          .update(payload)
          .eq('id', editandoId);
        if (error) throw error;
        await registrarAuditoria(
          ACCIONES.MODIFICAR_CONFIGURACION,
          `Plantilla de contrato editada: ${form.nombre}`,
        );
        toast.success('Plantilla actualizada.');
      } else {
        const { error } = await supabase.from('plantillas_contrato').insert(payload);
        if (error) throw error;
        await registrarAuditoria(
          ACCIONES.MODIFICAR_CONFIGURACION,
          `Plantilla de contrato creada: ${form.nombre}`,
        );
        toast.success('Plantilla creada.');
      }

      await cargarPlantillas();
      cerrarFormModal();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo guardar la plantilla.',
      );
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!plantillaAEliminar) return;
    setEliminando(true);
    try {
      const { error } = await supabase
        .from('plantillas_contrato')
        .delete()
        .eq('id', plantillaAEliminar.id);
      if (error) throw error;
      await registrarAuditoria(
        ACCIONES.MODIFICAR_CONFIGURACION,
        `Plantilla de contrato eliminada: ${plantillaAEliminar.nombre}`,
      );
      toast.success('Plantilla eliminada.');
      setPlantillaAEliminar(null);
      await cargarPlantillas();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo eliminar la plantilla.',
      );
    } finally {
      setEliminando(false);
    }
  };

  const label = (t: string) => <Form.Label className="small fw-bold text-secondary">{t}</Form.Label>;

  return (
    <div className="container-fluid" style={{ maxWidth: '1000px' }}>
      <div className="mb-3">
        <Link href="/dashboard/contratos" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a Contratos
        </Link>
      </div>
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-file-earmark-ruled text-primary me-2"></i>
            Plantillas de Contrato
          </h3>
          <p className="text-muted small m-0">
            Guarda los datos transversales de un tipo de contrato (labores, programa, jornada,
            sueldo, bonos...) para reutilizarlos al generar contratos, sin tener que rellenarlos
            cada vez. Al aplicar una plantilla, sus valores se copian al formulario y quedan
            editables — nunca queda un vínculo entre el contrato generado y la plantilla.
          </p>
        </div>
        <Button variant="primary" className="fw-semibold shadow-sm" onClick={abrirNueva}>
          <i className="bi bi-plus-lg me-2"></i>Nueva Plantilla
        </Button>
      </div>

      <Card className="shadow-sm border-0">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="bg-light text-secondary text-uppercase" style={{ fontSize: '0.8rem' }}>
                <tr>
                  <th>Nombre</th>
                  <th>Programa</th>
                  <th>Jornada</th>
                  <th className="text-end">Sueldo sugerido</th>
                  <th>Bonos</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando plantillas...
                    </td>
                  </tr>
                ) : plantillas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-5 text-muted">
                      Aún no has creado ninguna plantilla.
                    </td>
                  </tr>
                ) : (
                  plantillas.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-semibold text-dark">{p.nombre}</td>
                      <td>
                        <Badge bg="light" text="dark" className="border fw-normal">
                          {p.programa}
                        </Badge>
                      </td>
                      <td className="text-secondary">{p.jornada ?? '—'} h</td>
                      <td className="text-end font-monospace">
                        ${p.sueldo_sugerido.toLocaleString('es-CL')}
                      </td>
                      <td>
                        {p.incluir_bonos ? (
                          <Badge bg="success-subtle" text="success" className="border fw-normal">
                            Sí
                          </Badge>
                        ) : (
                          <span className="text-muted small">No</span>
                        )}
                      </td>
                      <td className="text-end">
                        <Button
                          variant="light"
                          size="sm"
                          className="text-primary rounded-circle me-1"
                          title="Editar"
                          onClick={() => abrirEditar(p)}
                        >
                          <i className="bi bi-pencil-square"></i>
                        </Button>
                        <Button
                          variant="light"
                          size="sm"
                          className="text-danger rounded-circle"
                          title="Eliminar"
                          onClick={() => setPlantillaAEliminar(p)}
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

      {/* --- MODAL: CREAR / EDITAR PLANTILLA --- */}
      <Modal show={showFormModal} onHide={cerrarFormModal} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="bg-primary text-white border-bottom-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-file-earmark-ruled me-2"></i>
            {editandoId ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Form>
            <Row className="g-3">
              <Col md={12}>
                {label('Nombre de la plantilla')}
                <Form.Control
                  type="text"
                  placeholder="Ej: Operario de Bodega - Turno Noche"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </Col>

              <Col md={12}>
                {label('Programa / Proyecto (cabecera)')}
                <Form.Select
                  value={form.programa}
                  onChange={(e) => setForm({ ...form, programa: e.target.value })}
                >
                  {PROGRAMAS_CONTRATO.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={6}>
                {label('Labores')}
                <Form.Control
                  type="text"
                  placeholder="Ej: Jornal"
                  value={form.labores}
                  onChange={(e) => setForm({ ...form, labores: e.target.value })}
                />
              </Col>
              <Col md={6}>
                {label('Lugar de trabajo (comuna)')}
                <Form.Control
                  type="text"
                  value={form.lugarTrabajo}
                  onChange={(e) => setForm({ ...form, lugarTrabajo: e.target.value })}
                />
              </Col>

              <Col md={12}>
                {label('Dependencia directa')}
                <Form.Control
                  type="text"
                  placeholder="Ej: la coordinadora del proyecto ..."
                  value={form.dependenciaDir}
                  onChange={(e) => setForm({ ...form, dependenciaDir: e.target.value })}
                />
              </Col>

              <Col md={4}>
                {label('Jornada (h)')}
                <Form.Control
                  type="number"
                  value={form.jornada}
                  onChange={(e) => setForm({ ...form, jornada: Number(e.target.value) || 0 })}
                />
              </Col>

              <Col md={12}>
                <div className="bg-light p-3 rounded border">
                  <Form.Check
                    type="checkbox"
                    id="check-bonos-plantilla"
                    label="Incluir bonos de movilización y colación (cláusula NOVENO)"
                    className="fw-semibold text-dark mb-3"
                    checked={form.incluirBonos}
                    onChange={(e) => setForm({ ...form, incluirBonos: e.target.checked })}
                  />
                  <Row className="g-3">
                    <Col md={6}>
                      {label('Bono movilización')}
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <Form.Control
                          type="number"
                          disabled={!form.incluirBonos}
                          value={form.bonoMovilizacion}
                          onChange={(e) =>
                            setForm({ ...form, bonoMovilizacion: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      {label('Bono colación')}
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <Form.Control
                          type="number"
                          disabled={!form.incluirBonos}
                          value={form.bonoColacion}
                          onChange={(e) =>
                            setForm({ ...form, bonoColacion: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </Col>
                  </Row>
                </div>
              </Col>

              <Col md={4}>
                {label('Ciudad')}
                <Form.Control
                  type="text"
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                />
              </Col>
              <Col md={4}>
                {label('Iniciales redactor')}
                <Form.Control
                  type="text"
                  placeholder="Ej: crh"
                  value={form.inicialesRedactor}
                  onChange={(e) => setForm({ ...form, inicialesRedactor: e.target.value })}
                />
              </Col>
              <Col md={4}>
                {label('Sueldo base sugerido')}
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <Form.Control
                    type="number"
                    value={form.sueldoSugerido || ''}
                    onChange={(e) =>
                      setForm({ ...form, sueldoSugerido: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-0">
          <Button variant="outline-secondary" onClick={cerrarFormModal} className="fw-semibold">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleGuardar}
            disabled={guardando}
            className="fw-semibold shadow-sm"
          >
            {guardando ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              'Guardar Plantilla'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* --- MODAL: CONFIRMAR ELIMINACIÓN --- */}
      <Modal show={!!plantillaAEliminar} onHide={() => setPlantillaAEliminar(null)} centered>
        <Modal.Header closeButton className="border-bottom-0">
          <Modal.Title className="fw-bold fs-5 text-danger">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>Eliminar Plantilla
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          ¿Seguro que quieres eliminar la plantilla{' '}
          <strong>{plantillaAEliminar?.nombre}</strong>? Los contratos ya generados con ella no se
          ven afectados, solo dejará de estar disponible para usarla en nuevos contratos.
        </Modal.Body>
        <Modal.Footer className="border-top-0">
          <Button
            variant="outline-secondary"
            onClick={() => setPlantillaAEliminar(null)}
            className="fw-semibold"
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={confirmarEliminar}
            disabled={eliminando}
            className="fw-semibold"
          >
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
