// app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AlertasPanel from '@/components/AlertasPanel';
import { Trabajador } from '@/types'; // 👈 IMPORTAMOS EL TIPO CENTRALIZADO

export default function TrabajadoresPage() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function obtenerTrabajadores() {
      // Supabase infiere automáticamente el tipo si se lo pasamos en el from<>
      const { data, error } = await supabase
        .from('trabajadores')
        .select(`
          rut, dv, nombres, primer_apellido, segundo_apellido,
          contratos(count)
        `)
        .returns<Trabajador[]>(); // 👈 LE DECIMOS A SUPABASE QUÉ TIPO ESPERAMOS

      if (!error && data) {
        setTrabajadores(data); // 👈 YA NO NECESITAMOS "as any"
      }
      setLoading(false);
    }
    obtenerTrabajadores();
  }, []);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="text-dark fw-bold m-0">Nómina de Trabajadores</h2>
          <p className="text-muted small m-0">Visualización general del personal y estado contractual acumulado.</p>
        </div>
        <Link href="/dashboard/formulario" className="btn btn-primary">
          <i className="bi bi-person-plus me-2"></i>Nuevo Trabajador
        </Link>
      </div>

      <AlertasPanel />

      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th className="ps-4">RUT</th>
                  <th>Nombre Completo</th>
                  <th className="text-center">N° Contratos</th>
                  <th className="text-end pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                      Cargando registros de personal...
                    </td>
                  </tr>
                ) : trabajadores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted">
                      No hay trabajadores registrados. Sube un archivo en Carga Masiva.
                    </td>
                  </tr>
                ) : (
                  trabajadores.map((t) => {
                    // Accedemos de forma segura a los contratos tipados
                    const totalContratos = t.contratos?.[0]?.count || 0;
                    return (
                      <tr key={t.rut}>
                        <td className="ps-4 fw-semibold text-secondary">{t.rut}-{t.dv}</td>
                        <td>
                          {t.nombres} {t.primer_apellido} {t.segundo_apellido || ''}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${totalContratos > 1 ? 'bg-info text-dark' : 'bg-light text-dark border'}`}>
                            {totalContratos} {totalContratos === 1 ? 'contrato' : 'contratos'}
                          </span>
                        </td>
                        <td className="text-end pe-4">
                          <Link href={`/dashboard/trabajadores/${t.rut}`} className="btn btn-sm btn-outline-primary">
                            <i className="bi bi-eye me-1"></i> Ver Detalle
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