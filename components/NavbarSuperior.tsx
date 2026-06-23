'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trabajador, AlertaNotificacion } from '@/types';
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';

export default function NavbarSuperior() {
  const router = useRouter();
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consultarAlertasConBrecha = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('trabajadores')
          .select('rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, fecha_inicio, fecha_termino)');

        if (!error && data) {
          const listadoCalculado: Omit<AlertaNotificacion, 'leida'>[] = [];

          (data as Trabajador[]).forEach((t) => {
            const analisis = evaluarAlertaContinuidad(t);

            if (analisis.califica) {
              listadoCalculado.push({
                rut: t.rut,
                nombreCompleto: `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`.trim().toUpperCase(),
                totalContratos: analisis.totalContratos
              });
            }
          });

          const estadosLecturaGuardados = localStorage.getItem('siscon_alertas_leidas');
          const rutsLeidos: number[] = estadosLecturaGuardados ? JSON.parse(estadosLecturaGuardados) : [];

          const alertasMapeadas: AlertaNotificacion[] = listadoCalculado.map(item => ({
            ...item,
            leida: rutsLeidos.includes(item.rut)
          }));

          setAlertas(alertasMapeadas);
        }
      } catch (err) {
        console.error('Error calculando alertas:', err);
      } finally {
        setLoading(false);
      }
    };

    consultarAlertasConBrecha();
  }, []);

  useEffect(() => {
    const manejarClicExterno = (evento: MouseEvent) => {
      if (menuAbierto && contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    };
    window.addEventListener('mousedown', manejarClicExterno);
    return () => window.removeEventListener('mousedown', manejarClicExterno);
  }, [menuAbierto]);

  const clickAlerta = (rut: number) => {
    const estadosLecturaGuardados = localStorage.getItem('siscon_alertas_leidas');
    const rutsLeidos: number[] = estadosLecturaGuardados ? JSON.parse(estadosLecturaGuardados) : [];
    
    if (!rutsLeidos.includes(rut)) {
      rutsLeidos.push(rut);
      localStorage.setItem('siscon_alertas_leidas', JSON.stringify(rutsLeidos));
    }

    setAlertas(prev => prev.map(a => a.rut === rut ? { ...a, leida: true } : a));
    setMenuAbierto(false);
    router.push(`/dashboard/alertas?focusRut=${rut}`);
  };

  const conteoNoLeidas = alertas.filter(a => !a.leida).length;

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom px-4 py-2 d-flex justify-content-between align-items-center position-relative shadow-sm">
      <div className="fw-bold text-secondary small text-uppercase">
        Sistema de Control de Contratos (siscon)
      </div>

      <div className="position-relative" ref={contenedorRef}>
        <button 
          className="btn btn-light position-relative rounded-circle p-2"
          onClick={() => setMenuAbierto(!menuAbierto)}
        >
          <i className="bi bi-bell-fill fs-5 text-dark"></i>
          {conteoNoLeidas > 0 && (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger animate-bounce" style={{ fontSize: '10px' }}>
              {conteoNoLeidas}
            </span>
          )}
        </button>

        {menuAbierto && (
          <div className="position-absolute end-0 mt-2 card shadow-lg border-0" style={{ width: '340px', zIndex: 1050, top: '100%' }}>
            <div className="card-header bg-dark text-white fw-bold small py-2 d-flex justify-content-between align-items-center">
              <span>Advertencias por Trabajador</span>
              <span className="badge bg-warning text-dark">{conteoNoLeidas} nuevas</span>
            </div>
            
            <div className="card-body p-0 overflow-auto" style={{ maxHeight: '320px' }}>
              {loading ? (
                <div className="text-center py-3 text-muted small">Evaluando historiales...</div>
              ) : alertas.length === 0 ? (
                <div className="text-center py-4 text-muted small">No hay advertencias registradas</div>
              ) : (
                alertas.map((a) => (
                  <div 
                    key={a.rut} 
                    className={`p-3 border-bottom position-relative transition-all d-flex flex-column gap-1 ${a.leida ? 'bg-white opacity-75' : 'bg-warning bg-opacity-10'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => clickAlerta(a.rut)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span className={`fw-bold text-truncate small ${a.leida ? 'text-muted' : 'text-dark'}`} style={{ maxWidth: '210px' }}>
                        {a.nombreCompleto}
                      </span>
                      {!a.leida && <span className="spinner-grow bg-primary rounded-circle" style={{ width: '8px', height: '8px' }}></span>}
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-1" style={{ fontSize: '0.72rem' }}>
                      <span className="text-muted font-monospace">RUT: {a.rut}</span>
                      <span className="text-primary fw-bold">Revisar y enfocar →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="card-footer p-0 text-center border-top">
              <Link href="/dashboard/alertas" className="d-block w-100 py-2 text-secondary fw-semibold small text-decoration-none bg-light" onClick={() => setMenuAbierto(false)}>
                Ver Panel de Advertencias Completo
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}