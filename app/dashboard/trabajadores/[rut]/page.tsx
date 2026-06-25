'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast'; 
import { Trabajador, Contrato } from '@/types'; 
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

  const obtenerDetalle = async () => {
    if (!params.rut) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('trabajadores')
      .select(`rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, jornada, sueldo_base, fecha_inicio, fecha_termino)`)
      .eq('rut', parseInt(params.rut as string))
      .single();

    if (error || !data) {
      toast.error("Trabajador no encontrado en la base de datos.");
      router.push('/dashboard/trabajadores');
    } else {
      if (data.contratos) {
        data.contratos.sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
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

  const handleGuardarCambios = async () => {
    if (!contratoAEditar) return;

    if (!editInicio) {
      toast.error("La fecha de inicio es obligatoria.");
      return;
    }

    if (editTermino && new Date(editTermino) < new Date(editInicio)) {
      toast.error("La fecha de término no puede ser anterior a la fecha de inicio.");
      return;
    }

    const otrosContratos = empleado?.contratos?.filter(c => c.id !== contratoAEditar.id) || [];

    if (otrosContratos.length > 0) {
      const inicioNuevo = new Date(editInicio);
      const terminoNuevo = editTermino ? new Date(editTermino) : new Date('2099-12-31');

      const hayTraslape = otrosContratos.some(contrato => {
        const inicioExistente = new Date(contrato.fecha_inicio);
        const terminoExistente = contrato.fecha_termino ? new Date(contrato.fecha_termino) : new Date('2099-12-31');
        return (inicioNuevo <= terminoExistente && terminoNuevo >= inicioExistente);
      });

      if (hayTraslape) {
        toast.error("Restricción Contractual: El período ingresado se superpone con las fechas de otro contrato.", { duration: 5000 });
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
        fecha_termino: editTermino || null
      })
      .eq('id', contratoAEditar.id);

    setGuardando(false);

    if (error) {
      toast.error("Error al actualizar: " + error.message, { id: toastId });
    } else {
      toast.success("Contrato actualizado exitosamente", { id: toastId });
      setModalAbierto(false); 
      await obtenerDetalle(); 
    }
  };

  // Función auxiliar para calcular la brecha de enfriamiento
  const calcularBrecha = (finPrevio: string | null, inicioActual: string) => {
    if (!finPrevio) return null;
    const d1 = new Date(finPrevio);
    const d2 = new Date(inicioActual);
    if (d2 <= d1) return null; 
    
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = (diffDays / 30.44).toFixed(1);
    
    return { dias: diffDays, meses: parseFloat(diffMonths) };
  };

  if (loading) return <div className="text-center py-5 text-muted">Cargando ficha histórica...</div>;
  if (!empleado) return null;

  return (
    <div className="container-fluid" style={{ maxWidth: '900px' }}>
      <div className="mb-3">
        <Link href="/dashboard/trabajadores" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a la lista
        </Link>
      </div>

      <div className="card shadow-sm border-0 mb-4 bg-dark text-white">
        <div className="card-body p-4 d-flex justify-content-between align-items-center">
          <div>
            <span className="badge bg-info text-dark mb-2 font-monospace">Ficha del Trabajador</span>
            <h2 className="fw-bold m-0 text-uppercase">{empleado.nombres} {empleado.primer_apellido} {empleado.segundo_apellido || ''}</h2>
            <p className="text-light-50 m-0 mt-1 small">RUN: {empleado.rut}-{empleado.dv}</p>
          </div>
          <i className="bi bi-person-badge text-white-50" style={{ fontSize: '3.5rem' }}></i>
        </div>
      </div>

      <h4 className="fw-bold text-dark mb-4">Línea de Tiempo Contractual</h4>
      
      <div className="ms-3 mb-5 position-relative border-start border-2 border-primary">
        {empleado.contratos && empleado.contratos.length > 0 ? (
          empleado.contratos.map((c, idx) => {
            const esVigente = !c.fecha_termino || new Date(c.fecha_termino) >= new Date();
            const contratoPrevio = idx > 0 ? empleado.contratos![idx - 1] : null;
            const brecha = contratoPrevio ? calcularBrecha(contratoPrevio.fecha_termino, c.fecha_inicio) : null;

            return (
              <React.Fragment key={c.id}>
                {/* NODO DE BRECHA DE ENFRIAMIENTO (Aparece entre contratos) */}
                {brecha && (
                  <div className="position-relative mb-4 ps-4">
                    <div className="position-absolute rounded-circle bg-warning border border-2 border-white" 
                         style={{ width: '16px', height: '16px', left: '-9px', top: '50%', transform: 'translateY(-50%)' }}></div>
                    <div className={`badge ${brecha.meses < 3 ? 'bg-danger' : 'bg-success'} text-white border`}>
                      <i className="bi bi-clock-history me-1"></i>
                      Brecha: {brecha.meses} meses ({brecha.dias} días)
                    </div>
                    {brecha.meses < 3 && (
                      <span className="text-danger small ms-2 fw-semibold">
                        <i className="bi bi-exclamation-circle me-1"></i> No cumple enfriamiento legal
                      </span>
                    )}
                  </div>
                )}

                {/* TARJETA DEL CONTRATO (Línea de tiempo) */}
                <div className="position-relative mb-4 ps-4">
                  <div className="position-absolute rounded-circle bg-primary text-white d-flex align-items-center justify-content-center shadow-sm" 
                       style={{ width: '32px', height: '32px', left: '-17px', top: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {idx + 1}
                  </div>
                  
                  <div className={`card border-0 shadow-sm transition-all hover-shadow ${esVigente ? 'border-start border-4 border-success' : 'border-start border-4 border-secondary'}`}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="fw-bold text-uppercase text-dark m-0 d-flex align-items-center">
                          <i className="bi bi-file-earmark-person me-2 text-primary"></i> 
                          Contrato Registrado
                        </h6>
                        <span className={`badge ${esVigente ? 'bg-success' : 'bg-secondary'}`}>
                          {esVigente ? 'Vigente' : 'Terminado'}
                        </span>
                      </div>
                      
                      <div className="row mt-3 text-dark small">
                        <div className="col-sm-6 mb-2">
                          <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>PERÍODO</span>
                          <span className="fw-semibold">{c.fecha_inicio}</span> a <span className="fw-semibold">{c.fecha_termino || 'Indefinido'}</span>
                        </div>
                        <div className="col-sm-3 mb-2">
                          <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>JORNADA</span>
                          <span className="fw-semibold">{c.jornada} Hrs.</span>
                        </div>
                        <div className="col-sm-3 mb-2">
                          <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>SUELDO BASE</span>
                          <span className="fw-semibold">${parseFloat(c.sueldo_base?.toString() || '0').toLocaleString('es-CL')}</span>
                        </div>
                      </div>

                      <div className="border-top pt-2 mt-2 text-end">
                        <button onClick={() => abrirEdicion(c)} className="btn btn-link btn-sm text-primary text-decoration-none p-0 fw-semibold">
                          <i className="bi bi-pencil-square me-1"></i> Editar Fechas
                        </button>
                      </div>
                    </div>
                  </div>
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
      <div className={`modal fade ${modalAbierto ? 'show d-block bg-dark bg-opacity-50' : 'd-none'}`} tabIndex={-1} style={{ transition: 'all 0.2s' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title fw-bold">Modificar Términos del Contrato</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setModalAbierto(false)}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label small fw-bold text-secondary">Jornada (Horas)</label>
                  <input type="number" className="form-control" value={editJornada} onChange={(e) => setEditJornada(parseInt(e.target.value) || 0)} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-secondary">Sueldo Base ($)</label>
                  <input type="number" className="form-control" value={editSueldo} onChange={(e) => setEditSueldo(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-secondary">Fecha de Inicio</label>
                  <input type="date" className="form-control" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-secondary">Fecha de Término</label>
                  <input type="date" className="form-control" value={editTermino} onChange={(e) => setEditTermino(e.target.value)} />
                  <div className="form-text small" style={{fontSize: '0.7rem'}}>Dejar en blanco si es indefinido.</div>
                </div>
              </div>
            </div>
            <div className="modal-footer bg-light border-top-0">
              <button type="button" className="btn btn-sm btn-outline-secondary px-3" onClick={() => setModalAbierto(false)}>Cancelar</button>
              <button type="button" className="btn btn-sm btn-primary px-4 fw-bold" onClick={handleGuardarCambios} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}