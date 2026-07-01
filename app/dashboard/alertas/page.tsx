'use client';
import AlertasPanel from '@/components/AlertasPanel';

export default function ReporteAlertasPage() {
  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h2 className="text-warning fw-bold m-0">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Panel de Advertencias Contractuales
        </h2>
        <p className="text-muted small m-0">
          Seguimiento consultivo de personal con 2 o más contratos en un marco de 15 meses y con relación laboral vigente.
        </p>
      </div>

      {/* Renderizamos el panel interactivo optimizado */}
      <AlertasPanel />
    </div>
  );
}