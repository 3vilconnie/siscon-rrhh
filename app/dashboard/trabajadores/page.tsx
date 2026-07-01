'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import { Trabajador } from '@/types';

type SortKey = 'rut' | 'nombre' | 'num_contratos';
// NUEVO: Tipo para los filtros rápidos por estado contractual
type FiltroContrato = 'todos' | 'unico' | 'alerta' | 'critico';

export default function NominatrabajadoresPage() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState(''); // <-- UX: Debounce
  const [estaFiltrando, setEstaFiltrando] = useState(false); // <-- UX: Spinner de búsqueda
  const [loading, setLoading] = useState(true);

  // --- NUEVO ESTADO DE FILTRADO RÁPIDO (PILLS) ---
  const [filtoRapido, setFiltroRapido] = useState<FiltroContrato>('todos');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({
    key: 'nombre',
    direction: 'asc'
  });

  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

  // Efecto para simular el debounce de la búsqueda (UX fluida)
  useEffect(() => {
    if (!busqueda) {
      setBusquedaDebounced('');
      setEstaFiltrando(false);
      return;
    }
    setEstaFiltrando(true);
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
      setEstaFiltrando(false);
    }, 300); // 300ms de espera antes de aplicar el filtro pesado

    return () => clearTimeout(handler);
  }, [busqueda]);

  useEffect(() => {
    async function cargarTrabajadores() {
      setLoading(true);
      const { data, error } = await supabase
        .from('trabajadores')
        .select(`
          rut, dv, nombres, primer_apellido, segundo_apellido,
          contratos(count)
        `);

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
      }
      setLoading(false);
    }
    cargarTrabajadores();
  }, []);

  // 1. Filtrar por Búsqueda Y por Filtro Rápido (Pills)
  const trabajadoresFiltrados = trabajadores.filter((t) => {
    // A) Aplicar Filtro de texto
    const término = busquedaDebounced.toLowerCase().trim();
    const rutCompleto = `${t.rut}-${t.dv}`.toLowerCase();
    const nombreCompleto = `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido || ''}`.toLowerCase();
    const coincideTexto = !término || rutCompleto.includes(término) || nombreCompleto.includes(término);

    // B) Aplicar Filtro Rápido de Contratos
    let coincideContrato = true;
    const cant = t.num_contratos || 0;
    if (filtoRapido === 'unico') coincideContrato = cant === 1;
    if (filtoRapido === 'alerta') coincideContrato = cant === 2;
    if (filtoRapido === 'critico') coincideContrato = cant >= 3;

    return coincideTexto && coincideContrato;
  });

  // 2. Ordenar los filtrados
  const trabajadoresOrdenados = [...trabajadoresFiltrados].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (key === 'rut') return direction === 'asc' ? a.rut - b.rut : b.rut - a.rut;
    if (key === 'num_contratos') {
      const numA = a.num_contratos || 0;
      const numB = b.num_contratos || 0;
      return direction === 'asc' ? numA - numB : numB - numA;
    }
    if (key === 'nombre') {
      const nombreA = `${a.primer_apellido} ${a.segundo_apellido || ''} ${a.nombres}`.trim();
      const nombreB = `${b.primer_apellido} ${b.segundo_apellido || ''} ${b.nombres}`.trim();
      return direction === 'asc' ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    }
    return 0;
  });

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) return <i className="bi bi-arrow-down-up text-white-50 ms-1" style={{ fontSize: '0.75rem' }}></i>;
    return sortConfig.direction === 'asc' 
      ? <i className="bi bi-sort-up-alt text-info ms-1 fs-6"></i>
      : <i className="bi bi-sort-down text-info ms-1 fs-6"></i>;
  };

  const totalRegistros = trabajadoresOrdenados.length;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;

  const indiceUltimoRegistro = paginaActual * registrosPorPagina;
  const indicePrimerRegistro = indiceUltimoRegistro - registrosPorPagina;
  const registrosPaginaActual = trabajadoresOrdenados.slice(indicePrimerRegistro, indiceUltimoRegistro);

  const obtenerBadgeClase = (cantidad: number) => {
    if (cantidad === 2) return 'bg-warning text-dark';
    if (cantidad >= 3) return 'bg-danger text-white fw-bold';
    return 'bg-info text-dark';
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark m-0">Nómina de Trabajadores</h2>
          <p className="text-muted small">Visualización general del personal y estado contractual.</p>
        </div>
        <Link href="/dashboard/formulario" className="btn btn-primary fw-bold small">
          <i className="bi bi-person-plus-fill me-1"></i> Nuevo Trabajador
        </Link>
      </div>

      {/* BARRA DE BÚSQUEDA OPTIMIZADA CON SPINNER */}
      <div className="mb-3">
        <div className="input-group shadow-sm">
          <span className="input-group-text bg-white border-end-0 text-muted">
            {estaFiltrando ? (
              <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
            ) : (
              <i className="bi bi-search"></i>
            )}
          </span>
          <input
            type="text"
            className="form-control border-start-0"
            placeholder="Buscar por RUT, Nombre o Apellidos..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
          />
        </div>
      </div>

      {/* UX: PILLS DE FILTRADO RÁPIDO */}
      <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
        <span className="text-secondary small fw-bold me-1">Segmentar por:</span>
        <button 
          onClick={() => { setFiltroRapido('todos'); setPaginaActual(1); }}
          className={`btn btn-sm rounded-pill px-3 fw-semibold ${filtoRapido === 'todos' ? 'btn-dark' : 'btn-outline-secondary'}`}
        >
          Todos ({trabajadores.length})
        </button>
        <button 
          onClick={() => { setFiltroRapido('unico'); setPaginaActual(1); }}
          className={`btn btn-sm rounded-pill px-3 fw-semibold ${filtoRapido === 'unico' ? 'btn-info text-dark' : 'btn-outline-info'}`}
        >
          Contrato Único ({trabajadores.filter(t => t.num_contratos === 1).length})
        </button>
        <button 
          onClick={() => { setFiltroRapido('alerta'); setPaginaActual(1); }}
          className={`btn btn-sm rounded-pill px-3 fw-semibold ${filtoRapido === 'alerta' ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
        >
          En Alerta (2) ({trabajadores.filter(t => t.num_contratos === 2).length})
        </button>
        <button 
          onClick={() => { setFiltroRapido('critico'); setPaginaActual(1); }}
          className={`btn btn-sm rounded-pill px-3 fw-semibold ${filtoRapido === 'critico' ? 'btn-danger' : 'btn-outline-danger'}`}
        >
          Críticos (3+) ({trabajadores.filter(t => (t.num_contratos || 0) >= 3).length})
        </button>
      </div>

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
        </div>
      </div>

      <div className="card shadow-sm border-0 bg-white overflow-hidden mb-4">
        <div className="table-responsive">
          <table className="table table-hover align-middle m-0">
            <thead className="table-dark text-uppercase small user-select-none">
              <tr>
                <th className="px-3 py-3" style={{ width: '15%', cursor: 'pointer' }} onClick={() => handleSort('rut')}>
                  RUT {renderSortIcon('rut')}
                </th>
                <th className="py-3" style={{ width: '45%', cursor: 'pointer' }} onClick={() => handleSort('nombre')}>
                  Nombre Completo {renderSortIcon('nombre')}
                </th>
                <th className="py-3 text-center" style={{ width: '20%', cursor: 'pointer' }} onClick={() => handleSort('num_contratos')}>
                  N° Contratos {renderSortIcon('num_contratos')}
                </th>
                <th className="px-3 py-3 text-end" style={{ width: '20%' }}>Acciones</th>
              </tr>
            </thead>
            <tbody className="small">
              {loading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td className="px-3 py-3"><p className="placeholder-glow m-0"><span className="placeholder col-8 rounded"></span></p></td>
                    <td className="py-3"><p className="placeholder-glow m-0"><span className="placeholder col-6 rounded"></span></p></td>
                    <td className="py-3 text-center"><p className="placeholder-glow m-0"><span className="placeholder col-4 bg-secondary rounded"></span></p></td>
                    <td className="px-3 py-3 text-end"><p className="placeholder-glow m-0"><span className="placeholder col-7 bg-primary rounded"></span></p></td>
                  </tr>
                ))
              ) : registrosPaginaActual.length === 0 ? (
                // UX: EMPTY STATE RELEVANTE CON ACCIÓN DIRECTA
                <tr>
                  <td colSpan={4} className="text-center py-5 bg-white text-muted">
                    <i className="bi bi-person-x display-4 text-secondary mb-3 d-block"></i>
                    <h5 className="fw-bold text-dark mb-1">No se encontraron resultados</h5>
                    <p className="small text-muted mb-3">Ningún trabajador coincide con los criterios o filtros actuales.</p>
                    <button 
                      className="btn btn-sm btn-outline-secondary fw-semibold rounded-pill px-3"
                      onClick={() => { setBusqueda(''); setFiltroRapido('todos'); }}
                    >
                      Limpiar Filtros
                    </button>
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
                      <span className={`badge ${obtenerBadgeClase(t.num_contratos || 0)}`}>
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

      <Pagination 
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        onPaginaChange={(numero) => setPaginaActual(numero)}
      />
    </div>
  );
}