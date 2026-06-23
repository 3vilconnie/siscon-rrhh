'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
  const [alertas, setAlertas] = useState<AlertaContrato[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Capturamos el RUT enfocado desde la barra de direcciones
  const targetRut = searchParams.get('focusRut');

  useEffect(() => {
    const cargarAlertasYContratos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trabajadores')
        .select(`
          rut,
          dv,
          nombres,
          primer_apellido,
          segundo_apellido,
          contratos(id, fecha_inicio, fecha_termino)
        `);
      
      if (!error && data) {
        const hoy = new Date();
        const quinceMesesAtras = new Date();
        quinceMesesAtras.setMonth(quinceMesesAtras.getMonth() - 15);

        const listadoAlertas: AlertaContrato[] = [];

        data.forEach((t: any) => {
          if (t.contratos && t.contratos.length >= 2) {
            const contratosVentana = t.contratos
              .filter((c: any) => new Date(c.fecha_inicio) >= quinceMesesAtras)
              .sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

            const tieneContratoActivo = contratosVentana.some((c: any) => {
              if (!c.fecha_termino) return true;
              const fTermino = new Date(c.fecha_termino);
              fTermino.setHours(0, 0, 0, 0);
              const hoySinHoras = new Date(hoy);
              hoySinHoras.setHours(0, 0, 0, 0);
              return fTermino >= hoySinHoras;
            });

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
                  const diferenciaTiempo = inicioActual.getTime() - finPrevio.getTime();
                  const diferenciaMeses = diferenciaTiempo / (1000 * 60 * 60 * 24 * 30.44);

                  if (diferenciaMeses < 3) {
                    rachaActual++;
                    if (rachaActual > contratosConsecutivosMax) contratosConsecutivosMax = rachaActual;
                  } else {
                    rachaActual = 1;
                  }
                } else {
                  rachaActual++;
                  if (rachaActual > contratosConsecutivosMax) contratosConsecutivosMax = rachaActual;
                }
              }
            }

            if (contratosConsecutivosMax >= 2 && tieneContratoActivo) {
              const contratosConTermino = contratosVentana.filter((c: any) => c.fecha_termino);
              let fechaSugerida = 'Revisar ficha';

              if (contratosConTermino.length > 0) {
                const ultimoTermino = new Date(contratosConTermino[contratosConTermino.length - 1].fecha_termino);
                ultimoTermino.setMonth(ultimoTermino.getMonth() + 3);
                fechaSugerida = ultimoTermino.toLocaleDateString('es-CL', {
                  day: '2-digit', month: '2-digit', year: 'numeric'
                });
              }

              listadoAlertas.push({
                rut: t.rut,
                dv: t.dv,
                nombres: t.nombres,
                primer_apellido: t.primer_apellido,
                segundo_apellido: t.segundo_apellido,
                total_contratos: contratosConsecutivosMax,
                tiene_vigente: true,
                fecha_sugerida_retorno: fechaSugerida
              });
            }
          }
        });

        setAlertas(listadoAlertas);
      } else if (error) {
        console.error(error.message);
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
                        id={`fila-alerta-${a.rut}`} // ID dinámico indispensable para el focus
                        className={esFilaObjetivo ? 'fila-enfocada' : 'table-warning bg-opacity-10'}
                      >
                        <td className="fw-bold font-monospace">{a.rut}-{a.dv}</td>
                        <td className="text-uppercase fw-semibold">
                          {a.nombres} {a.primer_apellido} {a.segundo_apellido || ''}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-warning text-dark fw-bold">{a.total_contratos} contratos</span>
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