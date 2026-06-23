'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Pagination from '@/components/Pagination'; // 👈 1. IMPORTAMOS EL NUEVO COMPONENTE

interface Trabajador {
  rut: number;
  dv: string;
  nombres: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  num_contratos: number;
}

export default function NominatrabajadoresPage() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE PAGINACIÓN ---
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

  useEffect(() => {
    async function cargarTrabajadores() {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('trabajadores')
        .select(`
          rut,
          dv,
          nombres,
          primer_apellido,
          segundo_apellido,
          contratos(count)
        `)
        .order('primer_apellido', { ascending: true });

      if (!error && data) {
        const listaNormalizada: Trabajador[] = data.map((t: any) => {
          let conteo = 0;
          if (t.contratos) {
            if (Array.isArray(t.contratos) && t.contratos[0]) {
              conteo = t.contratos[0].count;
            } else if (typeof t.contratos === 'object') {
              conteo = (t.contratos as any).count || 0;
            }
          }

          return {
            rut: t.rut,
            dv: t.dv,
            nombres: t.nombres,
            primer_apellido: t.primer_apellido,
            segundo_apellido: t.segundo_apellido,
            num_contratos: Number(conteo) || 0
          };
        });

        setTrabajadores(listaNormalizada);
      } else if (error) {
        console.error('Error al cargar contratos:', error.message);
      }
      setLoading(false);
    }
    cargarTrabajadores();
  }, []);

  // 1. Barra de búsqueda
  const trabajadoresFiltrados = trabajadores.filter((t) => {
    const término = busqueda.toLowerCase().trim();
    if (!término) return true;

    const rutCompleto = `${t.rut}-${t.dv}`.toLowerCase();
    const nombreCompleto = `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido || ''}`.toLowerCase();

    return rutCompleto.includes(término) || nombreCompleto.includes(término);
  });

  // 2. Lógica de Segmentación
  const totalRegistros = trabajadoresFiltrados.length;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(1);
    }
  }, [busqueda, registrosPorPagina, totalPaginas, paginaActual]);

  const indiceUltimoRegistro = paginaActual * registrosPorPagina;
  const indicePrimerRegistro = indiceUltimoRegistro - registrosPorPagina;
  const registrosPaginaActual = trabajadoresFiltrados.slice(indicePrimerRegistro, indiceUltimoRegistro);

  const obtenerBadgeClase = (cantidad: number) => {
    if (cantidad === 2) return 'bg-warning text-dark';
    if (cantidad >= 3) return 'bg-danger text-white fw-bold';
    return 'bg-info text-dark';
  };

  return (
    <div className="container-fluid">
      
      {/* Encabezado Principal */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark m-0">Nómina de Trabajadores</h2>
          <p className="text-muted small">Visualización general del personal y estado contractual.</p>
        </div>
        <Link href="/dashboard/formulario" className="btn btn-primary fw-bold small">
          <i className="bi bi-person-plus-fill me-1"></i> Nuevo Trabajador
        </Link>
      </div>

      {/* Barra de Búsqueda */}
      <div className="mb-4">
        <div className="input-group shadow-sm">
          <span className="input-group-text bg-white border-end-0 text-muted">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="text"
            className="form-control border-start-0"
            placeholder="Buscar por RUT, Nombre o Apellidos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Control de registros */}
      <div className="d-flex justify-content-between align-items-center mb-3 small text-muted">
        <div>
          Mostrando desde el <strong>{totalRegistros === 0 ? 0 : indicePrimerRegistro + 1}</strong> al{' '}
          <strong>{Math.min(indiceUltimoRegistro, totalRegistros)}</strong> de un total de{' '}
          <strong>{totalRegistros}</strong> registros.
        </div>
        
        <div className="d-flex align-items-center gap-2">
          <span>Mostrar:</span>
          <select
            className="form-select form-select-sm shadow-sm"
            style={{ width: '80px' }}
            value={registrosPorPagina}
            onChange={(e) => {
              setRegistrosPorPagina(parseInt(e.target.value));
              setPaginaActual(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
          <span>registros</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="card shadow-sm border-0 bg-white overflow-hidden mb-4">
        <div className="table-responsive">
          <table className="table table-hover align-middle m-0">
            <thead className="table-dark text-uppercase small">
              <tr>
                <th className="px-3 py-3" style={{ width: '15%' }}>RUT</th>
                <th className="py-3" style={{ width: '45%' }}>Nombre Completo</th>
                <th className="py-3 text-center" style={{ width: '20%' }}>N° Contratos</th>
                <th className="px-3 py-3 text-end" style={{ width: '20%' }}>Acciones</th>
              </tr>
            </thead>
            <tbody className="small">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Cargando nómina de personal...
                  </td>
                </tr>
              ) : registrosPaginaActual.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-5 text-muted">
                    No se encontraron trabajadores que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                registrosPaginaActual.map((t) => (
                  <tr key={t.rut}>
                    <td className="px-3 fw-bold">{t.rut}-{t.dv}</td>
                    <td className="text-uppercase">
                      {t.primer_apellido} {t.segundo_apellido || ''} {t.nombres}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${obtenerBadgeClase(t.num_contratos)}`}>
                        {t.num_contratos} {t.num_contratos === 1 ? 'contrato' : 'contratos'}
                      </span>
                    </td>
                    <td className="px-3 text-end">
                      <Link href={`/dashboard/trabajadores/${t.rut}`} className="btn btn-sm btn-outline-primary py-1">
                        <i className="bi bi-eye-fill me-1"></i> Ver Detalle
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. INYECTAMOS EL COMPONENTE LIMPIO PASANDO LAS PROPS */}
      <Pagination 
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        onPaginaChange={(numero) => setPaginaActual(numero)}
      />

    </div>
  );
}