'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
// app/dashboard/alertas/page.tsx (Extracto de cómo quedaría el useEffect)
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';
import { AlertaNotificacion, Trabajador } from '@/types';

interface AlertaContrato {
  rut: number;
  dv: string;
  nombres: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  total_contratos: number;
  tiene_vigente: boolean;
  fecha_sugerida_retorno?: string;
}

export default function ReporteAlertasPage() {
  const searchParams = useSearchParams();
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Capturamos el RUT enfocado desde la barra de direcciones
  const targetRut = searchParams.get('focusRut');

// Integración ideal dentro del useEffect de app/dashboard/alertas/page.tsx
useEffect(() => {
  const cargarAlertasYContratos = async () => {
    setLoading(true);
    
    // 1. Traer la configuración viva de la base de datos
    let configSistema = {};
    const resConfig = await fetch('/api/configuraciones');
    if (resConfig.ok) {
      configSistema = await resConfig.json();
    }

    // 2. Traer los trabajadores
    const { data, error } = await supabase
      .from('trabajadores')
      .select('rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, fecha_inicio, fecha_termino)');
    
    if (!error && data) {
      const listadoAlertas: AlertaNotificacion[] = [];

      (data as Trabajador[]).forEach((t) => {
        // Enviar la configuración dinámica al motor! ⚡
        const analisis = evaluarAlertaContinuidad(t, configSistema);

        if (analisis.califica) {
          listadoAlertas.push({
            rut: t.rut,
            dv: t.dv,
            nombreCompleto: `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`.trim().toUpperCase(),
            totalContratos: analisis.totalContratos,
            tiene_vigente: analisis.tieneVigente,
            fecha_sugerida_retorno: analisis.fechaSugerida
          });
        }
      });
      setAlertas(listadoAlertas);
    }
    setLoading(false);
  };

  cargarAlertasYContratos();
}, []);

  // 3. EFECTO AUTO-FOCUS: Se ejecuta cuando termina de cargar la tabla y se detecta un targetRut
  useEffect(() => {
    if (!loading && targetRut) {
      setTimeout(() => {
        const elementoFila = document.getElementById(`fila-alerta-${targetRut}`);
        if (elementoFila) {
          elementoFila.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300); // Pequeño delay de renderizado para asegurar la animación
    }
  }, [loading, targetRut]);

  if (loading) return <div className="p-4 text-muted">Generando panel de advertencias y alertas preventivas...</div>;

  return (
    <div className="container-fluid">
      {/* Estilos embebidos para animar e iluminar el focus temporal */}
      <style>{`
        .fila-enfocada {
          animation: iluminarFocus 2.5s ease-in-out forwards;
          border: 2px solid #ffc107 !important;
        }
        @keyframes iluminarFocus {
          0% { background-color: rgba(255, 193, 7, 0.4); }
          50% { background-color: rgba(255, 193, 7, 0.15); }
          100% { background-color: rgba(255, 193, 7, 0.05); }
        }
      `}</style>

      <div className="mb-4">
        <h2 className="text-warning fw-bold m-0">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Panel de Advertencias Contractuales
        </h2>
        <p className="text-muted small m-0">
          Seguimiento consultivo de personal con 2 o más contratos en un marco de 15 meses y con relación laboral vigente.
        </p>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle m-0">
              <thead className="table-dark">
                <tr>
                  <th>RUT</th>
                  <th>Nombre Completo</th>
                  <th className="text-center">Contratos en el Periodo</th>
                  <th className="text-center">Estado de Alerta</th>
                  <th className="text-center">Recontratación Sugerida (3 Meses)</th>
                  <th className="text-end px-3">Acción</th>
                </tr>
              </thead>
              <tbody className="small">
                {alertas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-muted italic">
                      🎉 Todo en orden. No se registran funcionarios activos que cumplan el criterio de riesgo de continuidad.
                    </td>
                  </tr>
                ) : (
                  alertas.map((a) => {
                    const esFilaObjetivo = Number(targetRut) === a.rut;
                    return (
                      <tr 
                        key={a.rut} 
                        id={`fila-alerta-${a.rut}`} 
                        className={esFilaObjetivo ? 'fila-enfocada' : 'table-warning bg-opacity-10'}
                      >
                        <td className="fw-bold font-monospace">{a.rut}-{a.dv}</td>
                        
                        {/* 1. Usamos la nueva propiedad nombreCompleto */}
                        <td className="text-uppercase fw-semibold">
                          {a.nombreCompleto}
                        </td>
                        
                        <td className="text-center">
                          {/* 2. Cambiamos total_contratos por totalContratos */}
                          <span className="badge bg-warning text-dark fw-bold">{a.totalContratos} contratos</span>
                        </td>
                        
                        <td className="text-center">
                          <span className="badge bg-success">1 Contrato Vigente</span>
                        </td>
                        
                        <td className="text-center fw-bold text-secondary">
                          {a.fecha_sugerida_retorno}
                        </td>
                        
                        <td className="text-end px-3">
                          <Link href={`/dashboard/trabajadores/${a.rut}`} className="btn btn-sm btn-outline-dark py-1">
                            <i className="bi bi-eye me-1"></i> Ver Historial
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}