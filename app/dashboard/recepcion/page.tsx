'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Card, Row, Col, Form, Table, Button, Spinner, Container } from 'react-bootstrap';
import { Trabajador, DetalleDocumento } from '@/types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logoGobierno from '@/app/assets/logoconaf.png';

export default function ModuloRecepcionDocumentos() {
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([]);
  const [detalleOtro, setDetalleOtro] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [baseDatosTrabajadores, setBaseDatosTrabajadores] = useState<Trabajador[]>([]);
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().split('T')[0]);
  const [detalleDocumento, setDetalleDocumento] = useState('');
  const [recibe, setRecibe] = useState('');
  const [entrega, setEntrega] = useState('');
  const [loadingDoc, setLoadingDoc] = useState<boolean>(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Estado para manejar las filas de la tabla dinámicamente
  const [detalles, setDetalles] = useState<DetalleDocumento[]>([]);

  const fetchTrabajadores = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('trabajadores')
      .select(`rut, dv, nombres, primer_apellido, segundo_apellido`);

    if (error || !data) {
      toast.error('error al cargar la base de datos de trabajadores.');
    }
    setBaseDatosTrabajadores(data ?? []);
    setLoading(false);
  };

  const handleTipoToggle = (tipo: string) => {
    setTiposSeleccionados((prev) => {
      const isSelected = prev.includes(tipo);
      if (isSelected && tipo === 'Otro') setDetalleOtro('');
      return isSelected ? prev.filter((t) => t !== tipo) : [...prev, tipo];
    });
  };

  // Función para agregar una nueva fila vacía
  const agregarFila = () => {
    setDetalles([
      ...detalles,
      {
        id: Date.now(),
        fechaEmision: '',
        cabecera: '',
        nombre: '',
        apellidoP: '',
        apellidoM: '',
        genero: 'S/R',
        rut: '',
        dv: '',
      },
    ]);
  };

  // Función para manejar los cambios en los inputs de la tabla
  const handleInputChange = (index: number, campo: keyof DetalleDocumento, valor: string) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index] = { ...nuevosDetalles[index], [campo]: valor };
    setDetalles(nuevosDetalles);
  };

  const buscarNombre = (e: React.ChangeEvent<HTMLInputElement>, rut: string) => {
    //const rutBuscado = rut.replace(/\./g, '');

    if (!rut) return;

    const trabajadorEncontrado = baseDatosTrabajadores.find((t) => rut === t.rut.toString());

    e.target.value = !trabajadorEncontrado
      ? e.target.value
      : `${trabajadorEncontrado?.nombres} ${trabajadorEncontrado?.primer_apellido} ${trabajadorEncontrado?.segundo_apellido}`;
  };

  const eliminarFila = (id: number) => {
    // 1) Guardo la fila y su posición ANTES de borrar, para poder restaurarla
    const index = detalles.findIndex((d) => d.id === id);
    if (index === -1) return;
    const filaEliminada = detalles[index];

    // 2) Elimino
    setDetalles((prev) => prev.filter((d) => d.id !== id));

    // 3) Toast con acción "Deshacer"
    toast(
      (t) => (
        <span className="d-flex align-items-center gap-3">
          Fila eliminada.
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => {
              // Reinserto la fila en su posición original
              setDetalles((prev) => {
                const copia = [...prev];
                copia.splice(index, 0, filaEliminada);
                return copia;
              });
              toast.dismiss(t.id);
            }}
          >
            Deshacer
          </button>
        </span>
      ),
      { duration: 5000 },
    );
  };

  // Función que busca al trabajador cuando el usuario sale del input de RUT
  const buscarTrabajador = (index: number) => {
    const rutBuscado = detalles[index].rut.replace(/\./g, '');

    if (!rutBuscado) return;

    const trabajadorEncontrado = baseDatosTrabajadores.find((t) => t.rut.toString() === rutBuscado);

    if (trabajadorEncontrado) {
      const nuevosDetalles = [...detalles];
      nuevosDetalles[index] = {
        ...nuevosDetalles[index],
        cabecera: 'S/R',
        nombre: trabajadorEncontrado.nombres,
        apellidoP: trabajadorEncontrado.primer_apellido,
        apellidoM: trabajadorEncontrado.segundo_apellido,
        genero: trabajadorEncontrado.genero ?? 'S/R',
        dv: trabajadorEncontrado.dv,
      };

      setDetalles(nuevosDetalles);
    } else {
      toast.error('Trabajador no encontrado.');
    }
  };

  const generarPDF = async () => {
    if (tiposSeleccionados.length == 0)
      return toast.error('Debe seleccionar un tipo de documento.');
    if (!detalleDocumento) return toast.error('Debe ingresar descripción documento.');
    if (detalles.length == 0) return toast.error('No puede generar un documento sin detalle');
    const elemento = pdfRef.current;
    if (!elemento) return;
    if (!entrega) return toast.error('Debe ingresar el emisor.');
    if (!recibe) return toast.error('Debe ingresar el receptor.');

    try {
      setLoadingDoc(true);
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'letter');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight(); // Altura de una página A4
      const imgHeight = (canvas.height * pdfWidth) / canvas.width; // Altura total de tu imagen

      let heightLeft = imgHeight;
      let position = 0;

      // 1. Agregamos la primera página (desde arriba)
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      // 2. Si todavía queda imagen por imprimir, agregamos más páginas
      while (heightLeft > 0) {
        position -= pageHeight; // Desplazamos la imagen hacia arriba el equivalente a una hoja
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('Recepcion_Documentos.pdf');
      toast.success('Documento generado con éxito.');
    } catch (error) {
      toast.error(`Hubo un error al generar el PDF ${error}`);
    } finally {
      setLoadingDoc(false);
    }
  };

  useEffect(() => {
    fetchTrabajadores();
  }, []);

  if (loading) return <Spinner animation="border" role="status" />;

  return (
    <Container className="my-2">
      <Card className="shadow-sm border-0">
        <Card.Body className="p-4 p-md-5" ref={pdfRef} style={{ minHeight: '297mm' }}>
          <Row className="mb-5">
            <header>
              <img src={logoGobierno.src} style={{ width: '8.59cm' }} /> <br />
              CORPORACION NACIONAL FORESTAL <br />
              REGIÓN DE ARICA Y PARINACOTA <br />
              DEPTO. FINANZAS Y ADMINISTRACIÓN <br />
              SECCIÓN RECURSOS HUMANOS <br />
              CDC/JAN/crh
            </header>
          </Row>
          <h3 className="text-center fw-bold mb-5">Formulario Recepción de Documentos</h3>

          {/* SECCIÓN 1: Tipos de Documentos e Información General */}
          <Row className="mb-5 pb-4 border-bottom">
            <Col xs={12} md={6} className="mb-4 mb-md-0">
              <h5 className="fw-semibold mb-3">Tipo(s) de Documento adjunto:</h5>
              <div className="d-flex flex-column gap-2">
                {['Finiquito', 'Contrato', 'Anexo contrato', 'Notificación', 'Otro'].map((tipo) => (
                  <div key={tipo}>
                    <Form.Check
                      type="checkbox"
                      id={`check-${tipo.replace(/\s+/g, '-')}`}
                      label={tipo}
                      checked={tiposSeleccionados.includes(tipo)}
                      onChange={() => handleTipoToggle(tipo)}
                      style={{ cursor: 'pointer' }}
                    />

                    {tipo === 'Otro' && tiposSeleccionados.includes('Otro') && (
                      <Form.Control
                        type="text"
                        size="sm"
                        className="mt-2 w-75 border-top-0 border-end-0 border-start-0 rounded-0 bg-light"
                        placeholder="Especifique el tipo de documento..."
                        value={detalleOtro}
                        onChange={(e) => setDetalleOtro(e.target.value)}
                        autoFocus
                        style={{ borderBottom: '2px solid #0d6efd', boxShadow: 'none' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium text-secondary">Fecha de Recepción</Form.Label>
                <Form.Control
                  type="date"
                  className="shadow-sm"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium text-secondary">
                  Cantidad / Descripción general
                </Form.Label>
                <Form.Control
                  type="text"
                  className="shadow-sm"
                  placeholder="Ej: 4 Contratos rectificados, 1 copia"
                  value={detalleDocumento}
                  onChange={(e) => setDetalleDocumento(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          {/* SECCIÓN 2: Detalle de los Documentos (Tabla) */}
          <div>
            <div className="mb-5 pb-4 border-bottom w-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-semibold m-0">Detalle</h5>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={agregarFila}
                  className="px-3 shadow-sm"
                  data-html2canvas-ignore="true"
                >
                  + Añadir Fila
                </Button>
              </div>
              <div className="table-responsive">
                <Table bordered hover className="align-middle text-nowrap mb-0">
                  <thead style={{ backgroundColor: '#8b0000', color: 'white' }}>
                    <tr>
                      <th className="py-2 fw-normal">FECHA EMISIÓN</th>
                      <th className="py-2 fw-normal">PROGRAMA</th>
                      <th className="py-2 fw-normal">RUT</th>
                      <th className="py-2 fw-normal text-center">DV</th>
                      <th className="py-2 fw-normal">NOMBRE</th>
                      <th className="py-2 fw-normal">APELLIDO PATERNO</th>
                      <th className="py-2 fw-normal">APELLIDO MATERNO</th>
                      <th className="py-2 fw-normal">GENERO</th>
                      <th className="py-2 fw-normal" data-html2canvas-ignore="true">
                        ACCIÓN
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.length == 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <span className="d-flex text-muted justify-content-center my-3">
                            Aún no ingresas datos.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      detalles.map((fila, index) => (
                        <tr key={fila.id}>
                          <td className="p-1">
                            <Form.Control
                              type="date"
                              size="sm"
                              value={fila.fechaEmision}
                              onChange={(e) =>
                                handleInputChange(index, 'fechaEmision', e.target.value)
                              }
                              className="border-0 bg-transparent shadow-none"
                            />
                          </td>
                          <td className="p-1">
                            <Form.Control
                              type="text"
                              size="sm"
                              value={fila.cabecera}
                              onChange={(e) => handleInputChange(index, 'cabecera', e.target.value)}
                              className="border-0 bg-transparent shadow-none"
                              placeholder="PZD1"
                            />
                          </td>
                          <td className="p-1">
                            <Form.Control
                              type="text"
                              size="sm"
                              value={fila.rut}
                              onChange={(e) => handleInputChange(index, 'rut', e.target.value)}
                              onBlur={() => buscarTrabajador(index)} // <-- AQUÍ SE DISPARA LA BÚSQUEDA AL SALIR DEL INPUT
                              className="border-0 bg-transparent shadow-none"
                              placeholder="20910472"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <Form.Control
                              type="text"
                              size="sm"
                              value={fila.dv}
                              onChange={(e) => handleInputChange(index, 'dv', e.target.value)}
                              className="border-0 bg-transparent shadow-none text-center d-inline-block"
                              placeholder="5"
                              maxLength={1}
                              style={{ width: '40px' }}
                            />
                          </td>
                          <td className="p-1">
                            <Form.Control
                              type="text"
                              size="sm"
                              value={fila.nombre}
                              onChange={(e) => handleInputChange(index, 'nombre', e.target.value)}
                              className="border-0 bg-transparent shadow-none"
                              placeholder="Nombre"
                            />
                          </td>
                          <td className="p-1">
                            <Form.Control
                              type="text"
                              size="sm"
                              value={fila.apellidoP}
                              onChange={(e) =>
                                handleInputChange(index, 'apellidoP', e.target.value)
                              }
                              className="border-0 bg-transparent shadow-none"
                              placeholder="Apellido P"
                            />
                          </td>
                          <td className="p-1">
                            <Form.Control
                              type="text"
                              size="sm"
                              value={fila.apellidoM ?? ''}
                              onChange={(e) =>
                                handleInputChange(index, 'apellidoM', e.target.value)
                              }
                              className="border-0 bg-transparent shadow-none"
                              placeholder="Apellido M"
                            />
                          </td>
                          <td className="p-1">
                            <Form.Select
                              size="sm"
                              value={fila.genero}
                              onChange={(e) => handleInputChange(index, 'genero', e.target.value)}
                              className="border-0 bg-transparent shadow-none"
                            >
                              <option value="SR">S/R</option>
                              <option value="M">M</option>
                              <option value="F">F</option>
                            </Form.Select>
                          </td>
                          <td className="p-1" data-html2canvas-ignore="true">
                            <Button
                              variant="danger"
                              onClick={() => eliminarFila(fila.id)}
                              title="Eliminar fila"
                            >
                              <span className="bi bi-trash text-light"></span>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </div>

            {/* SECCIÓN 3: Responsables */}
            <Row className="text-center pt-2 w-100">
              <Col xs={12} md={6} className="mb-4 mb-md-0">
                <Form.Control
                  type="text"
                  className="text-center text-uppercase fw-medium mx-auto mb-1 border-bottom-0 border-end-0 border-start-0 rounded-0 bg-transparent"
                  placeholder="RUT o Nombre de quien entrega"
                  style={{ width: '75%', borderTop: '2px solid #6c757d', boxShadow: 'none' }}
                  onChange={(e) => {
                    buscarNombre(e as any, e.target.value);
                    setEntrega(e.target.value);
                  }}
                />
                <span className="text-muted small">Entrega</span>
              </Col>
              <Col xs={12} md={6}>
                <Form.Control
                  type="text"
                  className="text-center text-uppercase fw-medium mx-auto mb-1 border-bottom-0 border-end-0 border-start-0 rounded-0 bg-transparent"
                  placeholder="RUT o Nombre de quien recibe"
                  style={{ width: '75%', borderTop: '2px solid #6c757d', boxShadow: 'none' }}
                  onChange={(e) => {
                    buscarNombre(e as any, e.target.value);
                    setRecibe(e.target.value);
                  }}
                />
                <span className="text-muted small">Recibe</span>
              </Col>
            </Row>
          </div>

          {/* Acciones */}
          <div className="d-flex justify-content-end align-items-end mt-5">
            <Button
              type="button"
              variant="success"
              className="px-4 py-2 shadow-sm"
              onClick={generarPDF}
              data-html2canvas-ignore="true"
              disabled={loadingDoc}
            >
              {loadingDoc ? 'Cargando...' : 'Guardar Documento'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
