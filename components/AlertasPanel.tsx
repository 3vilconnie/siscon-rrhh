'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';
import { Trabajador, Contrato } from '@/types';
import React from 'react';

export default function AlertasPanel() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState<any>(null);
  
  const detalleRef = useRef<HTMLDivElement>(null);

  const [parametros, setParametros] = useState({
    ventana_meses: 15,
    enfriamiento_meses: 3,
    minimo_contratos: 2
  });

  useEffect(() => {
    async function inicializarPanel() {
      try {
        const resConfig = await fetch('/api/configuraciones');
        if (resConfig.ok) {
          const dataConfig = await resConfig.json();
          if (dataConfig.ventana_meses) setParametros(dataConfig);
        }

        const { data: lista, error } = await supabase
          .from('trabajadores')
          .select('*, contratos(*)');

        if (!error && lista) {
          setTrabajadores(lista);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    inicializarPanel();
  }, []);

  useEffect(() => {
    if (trabajadores.length === 0) return;
    
    const listadoCalculado: any[] = [];
    
    trabajadores.forEach((t) => {
      const analisis = evaluarAlertaContinuidad(t, parametros);
      
      if (analisis.califica) {
        const contratosOrdenados = t.contratos 
          ? [...t.contratos].sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
          : [];

        listadoCalculado.push({
          rut: t.rut,
          dv: t.dv,
          nombreCompleto: `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`.trim().toUpperCase(),
          totalContratos: analisis.totalContratos,
          tieneVigente: analisis.tieneVigente,
          fechaSugerida: analisis.fechaSugerida,
          contratos: contratosOrdenados
        });
      }
    });
    
    setAlertas(listadoCalculado);
  }, [trabajadores, parametros]);

  const handleVerDetalle = (alerta: any) => {
    setSeleccionado(alerta);

    setTimeout(() => {
      if (detalleRef.current) {
        const elementoTop = detalleRef.current.getBoundingClientRect().top + window.scrollY;
        const offsetSuperior = 90; 

        window.scrollTo({
          top: elementoTop - offsetSuperior,
          behavior: 'smooth'
        });
      }
    }, 80);
  };

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

  if (loading) {
    return (
      <div className="p-4 text-center small text-muted">
        <span className="spinner-border spinner-border-sm me-2 text-primary" role="status"></span> 
        Analizando registros históricos...
      </div>
    );
  }

  return (
    <div className="row g-4">
      {/* COLUMNA IZQUIERDA: LISTA DE TRABAJADORES EN RIESGO LEGAL */}
      <div className="col-12 col-lg-6">
        <div className="card shadow-sm border-0 bg-white">
          <div className="card-header bg-danger text-white fw-bold d-flex align-items-center justify-content-between py-3">
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
              <span>Funcionarios en Alerta de Continuidad ({alertas.length})</span>
            </div>
            <span className="badge bg-white text-danger fw-bold rounded-pill small">Próxima Renovación</span>
          </div>

          <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: '650px' }}>
            {alertas.length === 0 ? (
              <div className="p-5 text-center text-muted small">
                <i className="bi bi-shield-check display-4 text-success mb-2 d-block"></i>
                No se detectan funcionarios que cumplan criterios de alerta.
              </div>
            ) : (
              alertas.map((a) => (
                <div 
                  key={a.rut} 
                  onClick={() => handleVerDetalle(a)}
                  className={`list-group-item p-3 cursor-pointer transition-all border-bottom ${
                    seleccionado?.rut === a.rut ? 'bg-danger bg-opacity-10 border-start border-danger border-4' : 'bg-white'
                  }`}
                  style={{ transition: 'background 0.2s ease' }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className="fw-bold text-dark mb-1 text-uppercase">{a.nombreCompleto}</h6>
                      <span className="text-muted font-monospace small">RUT: {a.rut}-{a.dv}</span>
                    </div>
                    <span className="badge bg-danger p-2 small">{a.totalContratos} Contratos</span>
                  </div>

                  <div className="mt-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                    <span className="text-muted small">
                      <i className="bi bi-calendar-range me-1"></i> 
                      Sugerencia Retorno: <strong className="text-dark">{a.fechaSugerida || 'Inmediato'}</strong>
                    </span>
                    <button className="btn btn-sm btn-link text-danger p-0 fw-bold text-decoration-none small">
                      Ver Historial Cronológico →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA: DESGLOSE CON HISTORIAL CRONOLÓGICO SEGURO */}
      <div className="col-12 col-lg-6" ref={detalleRef}>
        {seleccionado ? (
          <div className="card shadow-sm border-0 bg-white p-4 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <div>
                <h5 className="fw-bold text-dark m-0 text-uppercase" style={{ fontSize: '1.05rem' }}>{seleccionado.nombreCompleto}</h5>
                <span className="text-muted font-monospace small">Historial de Contratos (RUT: {seleccionado.rut})</span>
              </div>
              <button className="btn-close" onClick={() => setSeleccionado(null)}></button>
            </div>

            <div className="alert alert-warning border-0 p-3 small mb-4 shadow-sm">
              <div className="d-flex align-items-center mb-1">
                <i className="bi bi-shield-exclamation text-warning fs-5 me-2"></i>
                <strong className="text-dark">Sugerencia de Próxima Contratación:</strong>
              </div>
              <p className="m-0 text-dark-emphasis mb-2 small">
                Para romper la continuidad legal, la siguiente firma de contrato no debería ser antes del:
              </p>
              <div className="p-2 bg-white rounded border text-center font-monospace fw-bold fs-6 text-danger">
                {seleccionado.fechaSugerida || 'Revisar Historial'}
              </div>
            </div>

            {/* SOLUCIÓN AL BUG VISUAL: Añadimos px-3 y cambiamos la estructura para evitar recortes de overflow */}
            <div className="overflow-auto px-2" style={{ maxHeight: '440px' }}>
              <div className="position-relative border-start border-2 border-primary ms-3 pt-2">
                {seleccionado.contratos.map((c: Contrato, idx: number) => {
                  const esVigente = !c.fecha_termino || new Date(c.fecha_termino) >= new Date();
                  const contratoPrevio = idx > 0 ? seleccionado.contratos[idx - 1] : null;
                  const brecha = contratoPrevio ? calcularBrecha(contratoPrevio.fecha_termino, c.fecha_inicio) : null;

                  return (
                    <React.Fragment key={c.id}>
                      {/* Alerta de Brecha de Enfriamiento */}
                      {brecha && (
                        <div className="position-relative my-3 ps-4">
                          <div className="position-absolute rounded-circle bg-warning border border-2 border-white" 
                               style={{ width: '12px', height: '12px', left: '-7px', top: '50%', transform: 'translateY(-50%)' }}></div>
                          <div className={`badge ${brecha.meses < parametros.enfriamiento_meses ? 'bg-danger' : 'bg-success'} text-white border small`}>
                            Brecha entre contratos: {brecha.meses} meses
                          </div>
                        </div>
                      )}

                      {/* Tarjeta de Contrato */}
                      <div className="position-relative mb-4 ps-4">
                        {/* Ajustamos left a -13px alineado perfectamente con el padding superior de seguridad */}
                        <div className="position-absolute rounded-circle bg-primary text-white d-flex align-items-center justify-content-center shadow-sm" 
                             style={{ width: '24px', height: '24px', left: '-13px', top: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {idx + 1}
                        </div>
                        
                        <div className={`card border-0 shadow-sm ${esVigente ? 'border-start border-3 border-success' : 'border-start border-3 border-secondary'}`}>
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-bold text-dark small">Contrato #{idx + 1}</span>
                              <span className={`badge ${esVigente ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                                {esVigente ? 'Vigente' : 'Terminado'}
                              </span>
                            </div>
                            <div className="row g-1 text-muted" style={{ fontSize: '0.78rem' }}>
                              <div className="col-12">
                                <i className="bi bi-calendar3 me-1"></i> {c.fecha_inicio} al {c.fecha_termino || 'Indefinido'}
                              </div>
                              <div className="col-12">
                                <i className="bi bi-clock me-1"></i> Jornada: {c.jornada} Hrs.
                              </div>
                              <div className="col-12">
                                <i className="bi bi-currency-dollar me-1"></i> Sueldo Base: ${parseFloat(c.sueldo_base?.toString() || '0').toLocaleString('es-CL')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="h-100 d-flex align-items-center justify-content-center p-5 border rounded bg-light border-dashed text-muted text-center small" style={{ minHeight: '350px' }}>
            <div>
              <i className="bi bi-clipboard2-pulse display-4 text-secondary mb-3 d-block"></i>
              Selecciona un funcionario de la nómina de advertencias para desplegar cronológicamente su línea temporal de contratos.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}