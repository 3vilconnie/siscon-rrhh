'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Trabajador, AlertaNotificacion } from '@/types';
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const calcularNotificacionesCampana = async () => {
      try {
        const { data, error } = await supabase
          .from('trabajadores')
          .select('rut, nombres, primer_apellido, segundo_apellido, contratos(id, fecha_inicio, fecha_termino)');

        if (error) throw error;

        if (data) {
          const listadoNotificaciones: AlertaNotificacion[] = [];

          (data as Trabajador[]).forEach((t) => {
            const analisis = evaluarAlertaContinuidad(t);

            if (analisis.califica) {
              listadoNotificaciones.push({
                rut: t.rut,
                nombreCompleto: `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`.trim().toUpperCase(),
                totalContratos: analisis.totalContratos
              });
            }
          });

          setAlertas(listadoNotificaciones);
        }
      } catch (err) {
        console.error('Error al actualizar contador de campana:', err);
      } finally {
        setLoading(false);
      }
    };

    calcularNotificacionesCampana();
  }, []);

  return (
    <div className="position-relative">
      <button 
        className="btn btn-link text-dark p-1 position-relative border-0" 
        style={{ textDecoration: 'none', outline: 'none' }}
        onClick={() => setMenuAbierto(!menuAbierto)}
      >
        <i className="bi bi-bell-fill fs-4 text-secondary"></i>
        {alertas.length > 0 && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-danger text-white d-flex align-items-center justify-content-center"
            style={{ width: '20px', height: '20px', fontSize: '11px', fontWeight: 'bold' }}
          >
            {alertas.length}
          </span>
        )}
      </button>

      {menuAbierto && (
        <div 
          className="position-absolute dropdown-menu dropdown-menu-end show shadow-lg border p-0 bg-white rounded" 
          style={{ right: 0, top: '40px', width: '320px', zIndex: 1060 }}
        >
          <div className="card-header bg-dark text-white fw-bold small py-2 px-3 d-flex justify-content-between align-items-center">
            <span>Advertencias de Continuidad</span>
            <span className="badge bg-warning text-dark">{alertas.length} activas</span>
          </div>

          <div className="overflow-auto" style={{ maxHeight: '280px' }}>
            {loading ? (
              <div className="text-center py-3 text-muted small">Analizando líneas de tiempo...</div>
            ) : alertas.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                <i className="bi bi-check-circle-fill text-success fs-4 d-block mb-1"></i>
                Sin advertencias críticas de recontratación.
              </div>
            ) : (
              alertas.map((alerta) => (
                <div key={alerta.rut} className="p-3 border-bottom bg-light bg-opacity-50 small">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <strong className="text-dark text-truncate" style={{ maxWidth: '190px' }} title={alerta.nombreCompleto}>
                      {alerta.nombreCompleto}
                    </strong>
                    <span className="badge bg-warning text-dark font-monospace" style={{ fontSize: '10px' }}>
                      RUT: {alerta.rut}
                    </span>
                  </div>
                  <p className="text-muted m-0" style={{ fontSize: '12px', lineHeight: '1.3' }}>
                    Registra una continuidad de <strong>{alerta.totalContratos} contratos</strong> sin cumplir los 3 meses de enfriamiento.
                  </p>
                  <div className="text-end mt-2">
                    <Link 
                      href={`/dashboard/trabajadores/${alerta.rut}`}
                      className="text-primary fw-bold text-decoration-none"
                      style={{ fontSize: '11px' }}
                      onClick={() => setMenuAbierto(false)}
                    >
                      Ver Historial Cronológico <i className="bi bi-chevron-right"></i>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card-footer p-0 text-center border-top">
            <Link 
              href="/dashboard/alertas" 
              className="d-block w-100 py-2 text-secondary fw-semibold small text-decoration-none bg-light"
              onClick={() => setMenuAbierto(false)}
            >
              Ver Panel de Advertencias Completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}