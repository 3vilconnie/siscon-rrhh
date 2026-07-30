'use client';

import { Pagination as BsPagination } from 'react-bootstrap';

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
        <BsPagination size="sm" className="shadow-sm m-0 align-items-center">

          {/* Botón Ir a la Primera Página */}
          <BsPagination.First
            title="Primera página"
            disabled={paginaActual === 1}
            onClick={() => onPaginaChange(1)}
          >
            <i className="bi bi-chevron-double-left"></i>
          </BsPagination.First>

          {/* Botón Anterior */}
          <BsPagination.Prev
            disabled={paginaActual === 1}
            onClick={() => onPaginaChange(Math.max(paginaActual - 1, 1))}
          >
            <i className="bi bi-chevron-left"></i>
          </BsPagination.Prev>

          {/* Puntos suspensivos iniciales */}
          {paginasVisibles[0] > 1 && <BsPagination.Ellipsis disabled />}

          {/* Números Dinámicos de Páginas */}
          {paginasVisibles.map((numeroPagina) => (
            <BsPagination.Item
              key={numeroPagina}
              active={paginaActual === numeroPagina}
              onClick={() => onPaginaChange(numeroPagina)}
            >
              {numeroPagina}
            </BsPagination.Item>
          ))}

          {/* Puntos suspensivos finales */}
          {paginasVisibles[paginasVisibles.length - 1] < totalPaginas && <BsPagination.Ellipsis disabled />}

          {/* Botón Siguiente */}
          <BsPagination.Next
            disabled={paginaActual === totalPaginas}
            onClick={() => onPaginaChange(Math.min(paginaActual + 1, totalPaginas))}
          >
            <i className="bi bi-chevron-right"></i>
          </BsPagination.Next>

          {/* Botón Ir a la Última Página */}
          <BsPagination.Last
            title="Última página"
            disabled={paginaActual === totalPaginas}
            onClick={() => onPaginaChange(totalPaginas)}
          >
            <i className="bi bi-chevron-double-right"></i>
          </BsPagination.Last>

        </BsPagination>
      </nav>
    </div>
  );
}
