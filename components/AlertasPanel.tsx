'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface AlertaNotificacion {
  rut: number;
  nombreCompleto: string;
  totalContratos: number;
}

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const calcularNotificacionesCampana = async () => {
      try {
        // 1. Solicitamos los trabajadores con sus contratos en tiempo real
        const { data, error } = await supabase
          .from('trabajadores')
          .select(`
            rut,
            nombres,
            primer_apellido,
            segundo_apellido,
            contratos(id, fecha_inicio, fecha_termino)
          `);

        if (error) throw error;

        if (data) {
          const hoy = new Date();
          const quinceMesesAtras = new Date();
          quinceMesesAtras.setMonth(quinceMesesAtras.getMonth() - 15);

          const listadoNotificaciones: AlertaNotificacion[] = [];

          // 2. Filtro inteligente de brechas consecutivas (Elimina alertas falsas como la de Abraham)
          data.forEach((t: any) => {
            if (t.contratos && t.contratos.length >= 2) {
              
              // Filtrar el marco de 15 meses y ordenar cronológicamente
              const contratosVentana = t.contratos
                .filter((c: any) => new Date(c.fecha_inicio) >= quinceMesesAtras)
                .sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

              // Validar si el trabajador posee alguna relación laboral vigente hoy
              const tieneContratoActivo = contratosVentana.some((c: any) => {
                if (!c.fecha_termino) return true;
                const fTermino = new Date(c.fecha_termino);
                fTermino.setHours(0, 0, 0, 0);
                const hoySinHoras = new Date(hoy);
                hoySinHoras.setHours(0, 0, 0, 0);
                return fTermino >= hoySinHoras;
              });

              // Medir la brecha temporal entre los contratos sucesivos
              let contratosConsecutivosMax = 0;
              let rachaActual = 0;

              if (contratosVentana.length > 0) {
                rachaActual = 1;
                contratosConsecutivosMax = 1;

                for (let i = 1; i < contratosVentana.length; i++) {
                  const contratoPrevio = contratosVentana[i - 1];
                  const contratoActual = contratosVentana[i];

                  if (contratoPrevio.fecha_termino) {
                    const finPrevio = new Date(contratoPrevio.fecha_termino);
                    const inicioActual = new Date(contratoActual.fecha_inicio);

                    // Calculamos la distancia real en meses entre contratos
                    const diferenciaTiempo = inicioActual.getTime() - finPrevio.getTime();
                    const diferenciaMeses = diferenciaTiempo / (1000 * 60 * 60 * 24 * 30.44);

                    if (diferenciaMeses < 3) {
                      rachaActual++;
                      if (rachaActual > contratosConsecutivosMax) {
                        contratosConsecutivosMax = rachaActual;
                      }
                    } else {
                      rachaActual = 1; // Respetó los 3 meses fuera, se reinicia la racha de consecutivos
                    }
                  } else {
                    rachaActual++;
                    if (rachaActual > contratosConsecutivosMax) {
                      contratosConsecutivosMax = rachaActual;
                    }
                  }
                }
              }

              // Si tiene racha de 2 o más contratos consecutivos Y está vigente, califica para la alerta
              if (contratosConsecutivosMax >= 2 && tieneContratoActivo) {
                const materno = t.segundo_apellido ? ` ${t.segundo_apellido}` : '';
                listadoNotificaciones.push({
                  rut: t.rut,
                  nombreCompleto: `${t.primer_apellido}${materno} ${t.nombres}`.toUpperCase(),
                  totalContratos: contratosConsecutivosMax
                });
              }
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
      {/* BOTÓN DE LA CAMPANITA CON EL IDENTIFICADOR VISUAL */}
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

      {/* DETALLE DESPLEGABLE DE NOTIFICACIONES */}
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
              style={{ transition: 'background 0.2s' }}
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