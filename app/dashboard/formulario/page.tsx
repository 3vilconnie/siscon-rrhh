import FormularioTrabajador from '@/components/FormularioTrabajador';

export default function FormularioPage() {
  return (
    <div className="container-fluid">
      
      <section className="d-flex align-items-center w-100 flex-column">
        <div className="mb-4">
          <h2 className="text-dark fw-bold m-0">Ingreso Manual y Modificaciones</h2>
          <p className="text-muted small m-0">Inscribe nuevos funcionarios o añade extensiones de anexos de contratos al sistema.</p>
        </div>
        <FormularioTrabajador />
      </section>
    </div>
  );
}