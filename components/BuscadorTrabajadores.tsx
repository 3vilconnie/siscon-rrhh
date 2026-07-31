'use client';

import { Card, InputGroup, Form, Button, Spinner } from 'react-bootstrap';

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
    <Card className="shadow-sm border-0 mb-3 bg-white">
      <Card.Body className="p-3">
        <InputGroup>
          <InputGroup.Text className="bg-light text-secondary border-end-0">
            {estaFiltrando ? (
              <Spinner animation="border" size="sm" className="text-primary" role="status" />
            ) : (
              <i className="bi bi-search"></i>
            )}
          </InputGroup.Text>
          <Form.Control
            type="text"
            className="bg-light border-start-0 ps-2"
            placeholder="Buscar por RUT, Nombre o Apellidos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <Button
              variant="outline-secondary"
              className="border-start-0"
              type="button"
              onClick={() => setBusqueda('')}
            >
              Limpiar
            </Button>
          )}
        </InputGroup>

        {busqueda && !estaFiltrando && (
          <Form.Text className="text-muted mt-2 small">
            Mostrando <strong>{totalFiltrados}</strong> de <strong>{totalTotal}</strong> resultados
            encontrados.
          </Form.Text>
        )}
      </Card.Body>
    </Card>
  );
}
