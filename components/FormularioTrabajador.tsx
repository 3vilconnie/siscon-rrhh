'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast'; // <-- Implementamos react-hot-toast

export default function FormularioTrabajador() {
  // Estado para el RUT limpio (para la BD) y formateado (para la vista)
  const [rutRaw, setRutRaw] = useState('');
  const [rutDisplay, setRutDisplay] = useState('');
  const [dv, setDv] = useState('');
  const [loading, setLoading] = useState(false);

  // Campos de Texto
  const [nombres, setNombres] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  
  // Campos del Contrato
  const [jornada, setJornada] = useState('44'); // Lo actualicé a 44 hrs por ser el estándar actual
  const [sueldoBase, setSueldoBase] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');

  // Estado para bloquear/desbloquear dinámicamente los campos de identidad
  const [existeTrabajador, setExisteTrabajador] = useState(false);

  // Calcular DV Chileno automáticamente
  const calcularDV = (rutAux: string) => {
    let M = 0, S = 1;
    let T = parseInt(rutAux);
    for (; T; T = Math.floor(T / 10)) {
      S = (S + (T % 10) * (9 - (M++ % 6))) % 11;
    }
    return S ? (S - 1).toString() : 'K';
  };

  // Formatear RUT con puntos mientras el usuario escribe
  const handleRutChange = (valor: string) => {
    // 1. Extraer solo números
    const soloNumeros = valor.replace(/[^0-9]/g, '');
    setRutRaw(soloNumeros);

    // 2. Aplicar separador de miles (Puntos)
    if (soloNumeros) {
      const formateado = parseInt(soloNumeros, 10).toLocaleString('es-CL');
      setRutDisplay(formateado);
    } else {
      setRutDisplay('');
    }
  };

  const handleLimpiarFormulario = () => {
    setRutRaw('');
    setRutDisplay('');
    setDv('');
    setNombres('');
    setPrimerApellido('');
    setSegundoApellido('');
    setSueldoBase('');
    setFechaInicio('');
    setFechaTermino('');
    setJornada('44');
    setExisteTrabajador(false);
  };

  // Buscar si el trabajador ya existe al salir del campo (onBlur)
  const handleRutBlur = async () => {
    if (!rutRaw) return;

    // Calcular y asignar DV en tiempo real
    const dvCalculado = calcularDV(rutRaw);
    setDv(dvCalculado);

    const toastId = toast.loading('Buscando registro en el sistema...');

    // Buscar en Supabase
    const { data: trabajador, error } = await supabase
      .from('trabajadores')
      .select('*')
      .eq('rut', parseInt(rutRaw))
      .single();

    if (trabajador && !error) {
      setNombres(trabajador.nombres);
      setPrimerApellido(trabajador.primer_apellido);
      setSegundoApellido(trabajador.segundo_apellido || '');
      setExisteTrabajador(true);
      
      toast.success('Funcionario encontrado. Datos de identidad bloqueados.', { id: toastId });
    } else {
      setNombres('');
      setPrimerApellido('');
      setSegundoApellido('');
      setExisteTrabajador(false);
      
      toast.dismiss(toastId); // Solo quitamos el estado de carga si es nuevo
    }
  };

  // Guardar el Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fechaInicio) {
      toast.error('La fecha de inicio es obligatoria.');
      return;
    }

    if (fechaTermino && new Date(fechaTermino) < new Date(fechaInicio)) {
      toast.error('La fecha de término no puede ser anterior a la de inicio.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Procesando registro...');

    try {
      // 1. Consultar traslapes de contratos
      const { data: contratosExistentes, error: errBusqueda } = await supabase
        .from('contratos')
        .select('fecha_inicio, fecha_termino')
        .eq('trabajador_rut', parseInt(rutRaw));

      if (!errBusqueda && contratosExistentes && contratosExistentes.length > 0) {
        const inicioNuevo = new Date(fechaInicio);
        const terminoNuevo = fechaTermino ? new Date(fechaTermino) : new Date('2099-12-31');

        const hayTraslape = contratosExistentes.some(contrato => {
          const inicioExistente = new Date(contrato.fecha_inicio);
          const terminoExistente = contrato.fecha_termino ? new Date(contrato.fecha_termino) : new Date('2099-12-31');
          return (inicioNuevo <= terminoExistente && terminoNuevo >= inicioExistente);
        });

        if (hayTraslape) {
          toast.error('El período ingresado se superpone con las fechas de otro contrato ya registrado.', { id: toastId, duration: 5000 });
          setLoading(false);
          return; 
        }
      }

      // 2. Guardar Identidad
      const { error: errTrabajador } = await supabase.from('trabajadores').upsert({
        rut: parseInt(rutRaw),
        dv: dv.toUpperCase(),
        nombres: nombres.toUpperCase().trim(),
        primer_apellido: primerApellido.toUpperCase().trim(),
        segundo_apellido: segundoApellido ? segundoApellido.toUpperCase().trim() : null
      });

      if (errTrabajador) throw errTrabajador;

      // 3. Insertar Contrato
      const { error: errContrato } = await supabase.from('contratos').insert({
        trabajador_rut: parseInt(rutRaw),
        jornada: parseInt(jornada),
        sueldo_base: parseFloat(sueldoBase),
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino || null
      });

      if (errContrato) throw errContrato;

      toast.success('¡Ficha contractual e identidad guardadas exitosamente!', { id: toastId });
      handleLimpiarFormulario();
      
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm border-0 justify-content-center w-100" style={{ maxWidth: '850px' }}>
      <div className="card-header bg-dark text-white fw-bold d-flex align-items-center">
        <i className="bi bi-person-lines-fill me-2 fs-5"></i> Formulario de Personal y Contratos
      </div>
      
      <form onSubmit={handleSubmit} className="card-body p-4 p-md-5">
        
        {/* Notificación visual de trabajador existente */}
        {existeTrabajador && (
          <div className="alert alert-info py-2 d-flex align-items-center small shadow-sm mb-4">
            <i className="bi bi-info-circle-fill me-2 fs-5"></i>
            <div>
              <strong>Funcionario Vinculado:</strong> Los datos de identidad están bloqueados para evitar alteraciones accidentales. Solo se agregará un nuevo registro al historial de contratos.
            </div>
          </div>
        )}

        <h6 className="text-secondary border-bottom pb-2 mb-4 fw-bold text-uppercase d-flex align-items-center">
          <span className="bg-primary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2" style={{ width: '24px', height: '24px', fontSize: '12px' }}>1</span>
          Datos de Identidad
        </h6>
        
        <div className="row g-3 mb-5">
          {/* Campo RUT (Ahora formateado) */}
          <div className="col-8 col-md-4">
            <label className="form-label small fw-bold text-secondary">RUT (Solo números)</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: 12.345.678"
              value={rutDisplay}
              onChange={(e) => handleRutChange(e.target.value)}
              onBlur={handleRutBlur}
              required
            />
          </div>

          {/* Campo DV */}
          <div className="col-4 col-md-2">
            <label className="form-label small fw-bold text-secondary">DV</label>
            <input
              type="text"
              className="form-control fw-bold text-center bg-light"
              value={dv}
              readOnly
              tabIndex={-1}
            />
          </div>

          {/* Campo Nombres */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary d-flex justify-content-between">
              Nombres 
              {existeTrabajador && <i className="bi bi-lock-fill text-warning" title="Dato bloqueado por el sistema"></i>}
            </label>
            <input
              type="text"
              className={`form-control ${existeTrabajador ? 'bg-light text-muted border-warning text-uppercase fw-semibold' : 'text-uppercase'}`}
              placeholder="NOMBRES"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              readOnly={existeTrabajador}
              required
            />
          </div>

          {/* Campo Primer Apellido */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary d-flex justify-content-between">
              Primer Apellido
              {existeTrabajador && <i className="bi bi-lock-fill text-warning"></i>}
            </label>
            <input
              type="text"
              className={`form-control ${existeTrabajador ? 'bg-light text-muted border-warning text-uppercase fw-semibold' : 'text-uppercase'}`}
              placeholder="APELLIDO PATERNO"
              value={primerApellido}
              onChange={(e) => setPrimerApellido(e.target.value)}
              readOnly={existeTrabajador}
              required
            />
          </div>

          {/* Campo Segundo Apellido */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary d-flex justify-content-between">
              Segundo Apellido
              {existeTrabajador && <i className="bi bi-lock-fill text-warning"></i>}
            </label>
            <input
              type="text"
              className={`form-control ${existeTrabajador ? 'bg-light text-muted border-warning text-uppercase fw-semibold' : 'text-uppercase'}`}
              placeholder="APELLIDO MATERNO"
              value={segundoApellido}
              onChange={(e) => setSegundoApellido(e.target.value)}
              readOnly={existeTrabajador}
            />
          </div>
        </div>

        <h6 className="text-secondary border-bottom pb-2 mb-4 fw-bold text-uppercase d-flex align-items-center">
          <span className="bg-primary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2" style={{ width: '24px', height: '24px', fontSize: '12px' }}>2</span>
          Estructura Contractual
        </h6>
        
        <div className="row g-3 mb-5">
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Jornada Semanal</label>
            <div className="input-group">
              <input type="number" className="form-control" value={jornada} onChange={(e) => setJornada(e.target.value)} required />
              <span className="input-group-text bg-light text-muted">Hrs.</span>
            </div>
          </div>
          
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Sueldo Base Bruto</label>
            <div className="input-group">
              <span className="input-group-text bg-light text-muted">$</span>
              <input type="number" className="form-control" placeholder="650000" value={sueldoBase} onChange={(e) => setSueldoBase(e.target.value)} required />
            </div>
          </div>
          
          <div className="col-md-5 d-none d-md-block"></div> {/* Espaciador para la grilla */}

          <div className="col-md-4">
            <label className="form-label small fw-semibold">Fecha de Inicio</label>
            <input type="date" className="form-control" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </div>
          
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Fecha de Término</label>
            <input type="date" className="form-control" value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)} />
            <div className="form-text" style={{ fontSize: '0.75rem' }}>Dejar vacío si es indefinido.</div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="d-flex flex-column flex-sm-row gap-3 pt-3 border-top">
          <button type="submit" className="btn btn-success px-4 py-2 fw-bold" disabled={loading || !rutRaw}>
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2"></span> Registrando...</>
            ) : (
              <><i className="bi bi-save-fill me-2"></i> Guardar Ficha Contractual</>
            )}
          </button>
          
          <button 
            type="button" 
            className="btn btn-outline-secondary px-4 py-2 fw-semibold" 
            onClick={handleLimpiarFormulario}
            disabled={loading}
          >
            <i className="bi bi-eraser-fill me-2"></i> Limpiar Campos
          </button>
        </div>
      </form>
    </div>
  );
}