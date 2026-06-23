'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Contrato {
  id: string;
  jornada: number;
  sueldo_base: number;
  fecha_inicio: string;
  fecha_termino: string | null;
}

interface TrabajadorDetalle {
  rut: number;
  dv: string;
  nombres: string;
  primer_apellido: string;
  segundo_apellido: string;
  contratos: Contrato[];
}

export default function DetalleTrabajadorPage() {
  const params = useParams();
  const router = useRouter();
  
  const [empleado, setEmpleado] = useState<TrabajadorDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  
  // CONTROL DEL MODAL MEDIANTE ESTADO DE REACT
  const [modalAbierto, setModalAbierto] = useState(false);
  const [contratoAEditar, setContratoAEditar] = useState<Contrato | null>(null);
  
  const [editJornada, setEditJornada] = useState(44);
  const [editSueldo, setEditSueldo] = useState(0);
  const [editInicio, setEditInicio] = useState('');
  const [editTermino, setEditTermino] = useState('');
  const [guardando, setGuardando] = useState(false);

  const obtenerDetalle = async () => {
    if (!params.rut) return;
    const { data, error } = await supabase
      .from('trabajadores')
      .select(`rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, jornada, sueldo_base, fecha_inicio, fecha_termino)`)
      .eq('rut', parseInt(params.rut as string))
      .single();

    if (error || !data) {
      alert("Trabajador no encontrado");
      router.push('/dashboard/trabajadores');
    } else {
      if (data.contratos) {
        data.contratos.sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
      }
      setEmpleado(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    obtenerDetalle();
  }, [params.rut]);

  const abrirEdicion = (c: Contrato) => {
    setContratoAEditar(c);
    setEditJornada(c.jornada);
    setEditSueldo(c.sueldo_base);
    setEditInicio(c.fecha_inicio);
    setEditTermino(c.fecha_termino || '');
    setModalAbierto(true); // <-- Abre el modal al cambiar el estado
  };

  const handleGuardarCambios = async () => {
    if (!contratoAEditar) return;

    // =========================================================
    // NUEVO: CONTROL DE TRASLAPE DE FECHAS ANTES DE GUARDAR
    // =========================================================
    if (!editInicio) {
      alert("La fecha de inicio es obligatoria.");
      return;
    }

    if (editTermino && new Date(editTermino) < new Date(editInicio)) {
      alert("🚨 Error: La fecha de término no puede ser anterior a la fecha de inicio.");
      return;
    }

    // Filtrar todos los contratos cargados en el estado del empleado, excluyendo el que editamos
    const otrosContratos = empleado?.contratos?.filter(c => c.id !== contratoAEditar.id) || [];

    if (otrosContratos.length > 0) {
      const inicioNuevo = new Date(editInicio);
      const terminoNuevo = editTermino ? new Date(editTermino) : new Date('2099-12-31');

      const hayTraslape = otrosContratos.some(contrato => {
        const inicioExistente = new Date(contrato.fecha_inicio);
        const terminoExistente = contrato.fecha_termino ? new Date(contrato.fecha_termino) : new Date('2099-12-31');

        // Condición matemática de cruce de períodos
        return (inicioNuevo <= terminoExistente && terminoNuevo >= inicioExistente);
      });

      if (hayTraslape) {
        alert("🚨 Restricción Contractual: El período ingresado se superpone o choca con las fechas de otro contrato ya registrado para este trabajador.");
        return; // Detiene la ejecución aquí y no realiza el update en Supabase
      }
    }
    // =========================================================

    setGuardando(true); // <-- Esto está en tu línea 76 actual

    const { error } = await supabase
      .from('contratos')
      .update({
        jornada: editJornada,
        sueldo_base: editSueldo,
        fecha_inicio: editInicio,
        fecha_termino: editTermino || null
      })
      .eq('id', contratoAEditar.id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      setModalAbierto(false); 
      await obtenerDetalle(); 
    }
    setGuardando(false);
  };

  if (loading) return <div className="text-center py-5 text-muted">Cargando ficha histórica...</div>;
  if (!empleado) return null;

  return (
    <div className="container-fluid">
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

      <h4 className="fw-bold text-dark mb-3">Historial Cronológico de Contratos</h4>
      <div className="row g-3">
        {empleado.contratos.map((c, idx) => {
          const esVigente = !c.fecha_termino || new Date(c.fecha_termino) >= new Date();
          return (
            <div key={c.id} className="col-md-6">
              <div className={`card h-100 border-0 shadow-sm border-start border-4 ${esVigente ? 'border-success' : 'border-secondary'}`}>
                <div className="card-body d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="fw-bold text-uppercase text-muted m-0">Contrato N° {idx + 1}</h6>
                      <span className={`badge ${esVigente ? 'bg-success' : 'bg-secondary'}`}>{esVigente ? 'Vigente' : 'Terminado'}</span>
                    </div>
                    <ul className="list-unstyled my-3 small text-dark">
                      <li className="mb-1"><strong>📅 Inicio:</strong> {c.fecha_inicio}</li>
                      <li className="mb-1"><strong>📅 Término:</strong> {c.fecha_termino || 'Indefinido'}</li>
                      <li className="mb-1"><strong>⏱️ Jornada:</strong> {c.jornada} Horas Semanales</li>
                      <li className="mb-1"><strong>💵 Sueldo Base:</strong> ${parseFloat(c.sueldo_base as any).toLocaleString('es-CL')}</li>
                    </ul>
                  </div>
                  <div className="border-top pt-2 mt-2 text-end">
                    <button onClick={() => abrirEdicion(c)} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-pencil-square me-1"></i> Modificar Contrato
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL COMPLETAMENTE CONTROLADO POR EL INYECTOR DE CLASES DE REACT */}
      <div 
        className={`modal fade ${modalAbierto ? 'show d-block bg-dark bg-opacity-50' : 'd-none'}`} 
        tabIndex={-1}
        style={{ transition: 'all 0.3s' }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title fw-bold">Modificar Términos</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setModalAbierto(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label small fw-bold">Jornada (Horas)</label>
                <input type="number" className="form-control" value={editJornada} onChange={(e) => setEditJornada(parseInt(e.target.value) || 0)} />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold">Sueldo Base ($)</label>
                <input type="number" className="form-control" value={editSueldo} onChange={(e) => setEditSueldo(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold">Fecha de Inicio</label>
                <input type="date" className="form-control" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold">Fecha de Término</label>
                <input type="date" className="form-control" value={editTermino} onChange={(e) => setEditTermino(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer bg-light">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button>
              <button type="button" className="btn btn-sm btn-primary fw-bold" onClick={handleGuardarCambios} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}