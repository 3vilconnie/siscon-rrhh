'use client';

interface PaginationProps {
  paginaActual: number;
  totalPaginas: number;
  onPaginaChange: (pagina: number) => void;
}

export default function Pagination({ paginaActual, totalPaginas, onPaginaChange }: PaginationProps) {
  // Si solo hay una página o ninguna, no tiene sentido renderizar la barra
  if (totalPaginas <= 1) return null;

  // Algoritmo para calcular el rango de páginas visibles (máximo 5 botones continuos)
  const obtenerPaginasVisibles = () => {
    const maxBotones = 5;
    let inicio = Math.max(1, paginaActual - Math.floor(maxBotones / 2));
    let fin = inicio + maxBotones - 1;

    if (fin > totalPaginas) {
      fin = totalPaginas;
      inicio = Math.max(1, fin - maxBotones + 1);
    }

    const paginas = [];
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  };

  const paginasVisibles = obtenerPaginasVisibles();

  return (
    <div className="d-flex justify-content-center mb-4">
      <nav aria-label="Navegación de páginas">
        <ul className="pagination pagination-sm shadow-sm m-0 align-items-center">
          
          {/* Botón Ir a la Primera Página */}
          <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPaginaChange(1)} 
              title="Primera página"
              disabled={paginaActual === 1}
            >
              <i className="bi bi-chevron-double-left"></i>
            </button>
          </li>

          {/* Botón Anterior */}
          <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
            <button
              className="page-link"
              onClick={() => onPaginaChange(Math.max(paginaActual - 1, 1))}
              disabled={paginaActual === 1}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
          </li>

          {/* Puntos suspensivos iniciales */}
          {paginasVisibles[0] > 1 && (
            <li className="page-item disabled">
              <span className="page-link">...</span>
            </li>
          )}

          {/* Números Dinámicos de Páginas */}
          {paginasVisibles.map((numeroPagina) => (
            <li
              key={numeroPagina}
              className={`page-item ${paginaActual === numeroPagina ? 'active' : ''}`}
            >
              <button
                className="page-link"
                onClick={() => onPaginaChange(numeroPagina)}
              >
                {numeroPagina}
              </button>
            </li>
          ))}

          {/* Puntos suspensivos finales */}
          {paginasVisibles[paginasVisibles.length - 1] < totalPaginas && (
            <li className="page-item disabled">
              <span className="page-link">...</span>
            </li>
          )}

          {/* Botón Siguiente */}
          <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
            <button
              className="page-link"
              onClick={() => onPaginaChange(Math.min(paginaActual + 1, totalPaginas))}
              disabled={paginaActual === totalPaginas}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </li>

          {/* Botón Ir a la Última Página */}
          <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPaginaChange(totalPaginas)} 
              title="Última página"
              disabled={paginaActual === totalPaginas}
            >
              <i className="bi bi-chevron-double-right"></i>
            </button>
          </li>

        </ul>
      </nav>
    </div>
  );
}