'use client';

interface BuscadorProps {
  busqueda: string;
  setBusqueda: (value: string) => void;
  totalFiltrados: number;
  totalTotal: number;
  estaFiltrando?: boolean; // <-- NUEVO: Saber si el usuario está escribiendo
}

export default function BuscadorTrabajadores({
  busqueda,
  setBusqueda,
  totalFiltrados,
  totalTotal,
  estaFiltrando = false,
}: BuscadorProps) {
  return (
    <div className="card shadow-sm border-0 mb-3 bg-white">
      <div className="card-body p-3">
        <div className="input-group">
          <span className="input-group-text bg-light text-secondary border-end-0">
            {estaFiltrando ? (
              // Icono de carga animado mientras escribe
              <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
            ) : (
              <i className="bi bi-search"></i>
            )}
          </span>
          <input
            type="text"
            className="form-control bg-light border-start-0 ps-2"
            placeholder="Buscar por RUT, Nombre o Apellidos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button 
              className="btn btn-outline-secondary border-start-0" 
              type="button" 
              onClick={() => setBusqueda('')}
            >
              Limpiar
            </button>
          )}
        </div>
        
        {busqueda && !estaFiltrando && (
          <div className="form-text text-muted mt-2 small">
            Mostrando <strong>{totalFiltrados}</strong> de <strong>{totalTotal}</strong> resultados encontrados.
          </div>
        )}
      </div>
    </div>
  );
}