'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface TrabajadorAlerta {
  rut: number;
  dv: string;
  nombres: string;
  primer_apellido: string;
  total_contratos: number;
  meses_entre_contratos: number;
}

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<TrabajadorAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarAlertas() {
      const { data, error } = await supabase
        .from('trabajadores_alerta_contratos') // Vista de Supabase
        .select('*');

      if (!error && data) {
        setAlertas(data);
      }
      setLoading(false);
    }
    cargarAlertas();
  }, []);

  if (loading || alertas.length === 0) return null;

  return (
    <div className="alert alert-warning shadow-sm border-start border-4 border-warning mb-4" role="alert">
      <div className="d-flex align-items-center mb-2">
        <i className="bi bi-exclamation-triangle-fill text-warning fs-4 me-2"></i>
        <h5 className="alert-heading m-0 fw-bold text-dark">Alerta Legal de Contratos</h5>
      </div>
      <p className="small mb-3 text-secondary">
        Los siguientes trabajadores registran 2 o más contratos dentro de un periodo de 15 meses y se encuentran con un contrato vigente:
      </p>
      <div className="row g-2">
        {alertas.map((t) => (
          <div key={t.rut} className="col-12">
            <div className="bg-white p-2 rounded border d-flex justify-content-between align-items-center">
              <div>
                <span className="fw-bold text-dark">{t.nombres} {t.primer_apellido}</span>
                <span className="text-muted small ms-2">RUT: {t.rut}-{t.dv}</span>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {t.total_contratos} contratos en un lapso de {t.meses_entre_contratos} meses.
                </div>
              </div>
              <Link href={`/dashboard/trabajadores/${t.rut}`} className="btn btn-sm btn-outline-warning">
                Ver Historial
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}