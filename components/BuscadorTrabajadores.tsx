'use client';

interface BuscadorProps {
  busqueda: string;
  setBusqueda: (value: string) => void;
  totalFiltrados: number;
  totalTotal: number;
}

export default function BuscadorTrabajadores({
  busqueda,
  setBusqueda,
  totalFiltrados,
  totalTotal,
}: BuscadorProps) {
  return (
    <div className="card shadow-sm border-0 mb-3 bg-white">
      <div className="card-body p-3">
        <div className="input-group">
          <span className="input-group-text bg-light text-secondary border-end-0">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="text"
            className="form-control bg-light border-start-0 ps-1"
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
        
        {busqueda && (
          <div className="form-text text-muted mt-2 small">
            Mostrando <strong>{totalFiltrados}</strong> de <strong>{totalTotal}</strong> resultados encontrados.
          </div>
        )}
      </div>
    </div>
  );
}