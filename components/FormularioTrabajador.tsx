'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

export default function FormularioTrabajador() {
  // 1. Estados de Identidad
  const [rut, setRut] = useState('');
  const [dv, setDv] = useState('');
  const [nombres, setNombres] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  
  // 2. Estados de Estructura Contractual
  const [jornada, setJornada] = useState('44');
  const [sueldoBase, setSueldoBase] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');

  // Estados de control UX
  const [buscandoRut, setBuscandoRut] = useState(false);
  const [existeTrabajador, setExisteTrabajador] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [mostrarContrato, setMostrarContrato] = useState(false); 
  const [loading, setLoading] = useState(false);

  const calcularDV = (rutAncho: string) => {
    const cuerpo = rutAncho.replace(/[^0-9]/g, '');
    if (!cuerpo) return '';
    let suma = 0;
    let multiplicador = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += multiplicador * parseInt(cuerpo.charAt(i));
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    const resto = suma % 11;
    const dvCalculado = 11 - resto;
    if (dvCalculado === 11) return '0';
    if (dvCalculado === 10) return 'K';
    return dvCalculado.toString();
  };

  // UX: Monitor dinámico del RUT con debounce
  useEffect(() => {
    const cuerpoRut = rut.replace(/[^0-9]/g, '');
    
    if (cuerpoRut.length >= 7) {
      const dvCalculado = calcularDV(cuerpoRut);
      setDv(dvCalculado);

      setBuscandoRut(true);
      const timer = setTimeout(async () => {
        const { data, error } = await supabase
          .from('trabajadores')
          .select('nombres, primer_apellido, segundo_apellido')
          .eq('rut', parseInt(cuerpoRut))
          .single();

        if (!error && data) {
          setNombres(data.nombres);
          setPrimerApellido(data.primer_apellido);
          setSegundoApellido(data.segundo_apellido || '');
          setExisteTrabajador(true);
          setBloqueado(true);
          toast.success('Funcionario verificado. Listo para anexar contrato.', { id: 'rut-check' });
        } else {
          if (bloqueado) {
            setNombres('');
            setPrimerApellido('');
            setSegundoApellido('');
          }
          setExisteTrabajador(false);
          setBloqueado(false);
          setMostrarContrato(false);
        }
        setBuscandoRut(false);
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setDv('');
      setBuscandoRut(false);
    }
  }, [rut]);

  const handleLimpiarFormulario = () => {
    setRut('');
    setDv('');
    setNombres('');
    setPrimerApellido('');
    setSegundoApellido('');
    setJornada('44');
    setSueldoBase('');
    setFechaInicio('');
    setFechaTermino('');
    setExisteTrabajador(false);
    setBloqueado(false);
    setMostrarContrato(false);
    toast.dismiss();
  };

  // Guardar definitivo en base de datos
  const handleGuardarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    const cuerpoRut = parseInt(rut.replace(/[^0-9]/g, ''));

    if (!fechaInicio) {
      toast.error('La fecha de inicio es obligatoria.');
      return;
    }

    if (fechaTermino && new Date(fechaTermino) < new Date(fechaInicio)) {
      toast.error('La fecha de término no puede ser anterior a la de inicio.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Procesando registro contractual...');

    try {
      // 1. Consultar e impedir traslapes de contratos de este funcionario
      const { data: contratosExistentes, error: errBusqueda } = await supabase
        .from('contratos')
        .select('fecha_inicio, fecha_termino')
        .eq('trabajador_rut', cuerpoRut);

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

      // 2. Si el trabajador es completamente nuevo, registrar su identidad primero
      if (!existeTrabajador) {
        const { error: errTrabajador } = await supabase.from('trabajadores').insert({
          rut: cuerpoRut,
          dv: dv.toUpperCase(),
          nombres: nombres.toUpperCase().trim(),
          primer_apellido: primerApellido.toUpperCase().trim(),
          segundo_apellido: segundoApellido ? segundoApellido.toUpperCase().trim() : null
        });
        if (errTrabajador) throw errTrabajador;
      }

      // 3. Insertar los términos del Contrato
      const { error: errContrato } = await supabase.from('contratos').insert({
        trabajador_rut: cuerpoRut,
        jornada: parseInt(jornada),
        sueldo_base: parseFloat(sueldoBase),
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino || null
      });

      if (errContrato) throw errContrato;

      toast.success('¡Ficha contractual guardada exitosamente!', { id: toastId });
      handleLimpiarFormulario();
      
    } catch (error: any) {
      toast.error(`Error al procesar: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm border-0 justify-content-center w-100" style={{ maxWidth: '850px' }}>
      <div className="card-header bg-dark text-white fw-bold d-flex align-items-center">
        <i className="bi bi-person-lines-fill me-2 fs-5"></i> Formulario de Personal y Contratos
      </div>
      
      <div className="card-body p-4 p-md-5">
        
        {/* SECCIÓN 1: IDENTIDAD */}
        <h6 className="text-secondary border-bottom pb-2 mb-4 fw-bold text-uppercase d-flex align-items-center">
          <span className="bg-primary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2" style={{ width: '24px', height: '24px', fontSize: '12px' }}>1</span>
          Datos de Identidad
        </h6>
        
        <div className="row g-3 mb-4">
          <div className="col-8 col-md-4">
            <label className="form-label small fw-bold text-secondary">RUT (Solo números)</label>
            <input
              type="text"
              className={`form-control ${bloqueado ? 'border-success bg-light fw-bold' : ''}`}
              placeholder="Ej: 19496016"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              disabled={bloqueado}
              required
            />
          </div>
          <div className="col-4 col-md-2">
            <label className="form-label small fw-bold text-secondary">DV</label>
            <div className="input-group">
              <span className="input-group-text bg-light fw-bold w-100 justify-content-center" style={{ height: '38px' }}>
                {buscandoRut ? <span className="spinner-border spinner-border-sm text-primary" role="status"></span> : (dv || '-')}
              </span>
            </div>
          </div>
          <div className="col-md-6 d-flex align-items-end">
            {bloqueado && (
              <button type="button" className="btn btn-outline-danger fw-semibold px-3 w-100 w-md-auto" onClick={handleLimpiarFormulario}>
                <i className="bi bi-arrow-counterclockwise me-1"></i> Cambiar RUT o Funcionario
              </button>
            )}
          </div>

          {bloqueado && (
            <div className="col-12 my-2 animate__animated animate__fadeIn">
              <div className="alert alert-info border-0 shadow-sm d-flex align-items-center m-0 py-2 px-3 small">
                <i className="bi bi-shield-lock-fill text-info fs-5 me-2"></i>
                <div>
                  <strong>Funcionario Vinculado:</strong> Los datos de identidad están resguardados en el archivo maestro. Presiona <u>Continuar con Contrato</u> para abrir la sección contractual.
                </div>
              </div>
            </div>
          )}

          {/* CAMPO: NOMBRES */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary">Nombres</label>
            <div className="input-group">
              {bloqueado && (
                <span className="input-group-text bg-light text-muted border-end-0">
                  <i className="bi bi-lock-fill"></i>
                </span>
              )}
              <input 
                type="text" 
                className={`form-control text-uppercase ${bloqueado ? 'bg-light text-muted border-start-0' : ''}`} 
                value={nombres} 
                onChange={(e) => setNombres(e.target.value)} 
                readOnly={bloqueado} 
                required 
              />
            </div>
          </div>

          {/* CAMPO: APELLIDO PATERNO */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary">Apellido Paterno</label>
            <div className="input-group">
              {bloqueado && (
                <span className="input-group-text bg-light text-muted border-end-0">
                  <i className="bi bi-lock-fill"></i>
                </span>
              )}
              <input 
                type="text" 
                className={`form-control text-uppercase ${bloqueado ? 'bg-light text-muted border-start-0' : ''}`} 
                value={primerApellido} 
                onChange={(e) => setPrimerApellido(e.target.value)} 
                readOnly={bloqueado} 
                required 
              />
            </div>
          </div>

          {/* CAMPO: APELLIDO MATERNO */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary">Apellido Materno</label>
            <div className="input-group">
              {bloqueado && (
                <span className="input-group-text bg-light text-muted border-end-0">
                  <i className="bi bi-lock-fill"></i>
                </span>
              )}
              <input 
                type="text" 
                className={`form-control text-uppercase ${bloqueado ? 'bg-light text-muted border-start-0' : ''}`} 
                value={segundoApellido} 
                onChange={(e) => setSegundoApellido(e.target.value)} 
                readOnly={bloqueado} 
              />
            </div>
          </div>
        </div>

        {/* CONTROL DE FLUJO DINÁMICO (UX) */}
        {!mostrarContrato && (
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-outline-secondary px-4 small" onClick={handleLimpiarFormulario}>Limpiar Todo</button>
            <button 
              type="button" 
              className="btn btn-primary px-4 fw-bold"
              disabled={!rut || buscandoRut}
              onClick={() => {
                setMostrarContrato(true);
                toast.success('Estructura contractual desplegada.');
              }}
            >
              {existeTrabajador ? 'Continuar con Contrato →' : 'Configurar Contrato →'}
            </button>
          </div>
        )}

        {/* SECCIÓN 2: ESTRUCTURA CONTRACTUAL */}
        {mostrarContrato && (
          <form onSubmit={handleGuardarFormulario} className="animate__animated animate__fadeIn mt-5">
            <h6 className="text-secondary border-bottom pb-2 mb-4 fw-bold text-uppercase d-flex align-items-center">
              <span className="bg-primary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2" style={{ width: '24px', height: '24px', fontSize: '12px' }}>2</span>
              Estructura Contractual
            </h6>
            
            <div className="row g-3 mb-4">
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
              
              <div className="col-md-5 d-none d-md-block"></div>

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

            <div className="d-flex flex-column flex-sm-row gap-3 pt-3 border-top">
              <button type="submit" className="btn btn-success px-4 py-2 fw-bold" disabled={loading}>
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span> Registrando...</>
                ) : (
                  <><i className="bi bi-save-fill me-2"></i> Guardar Historial Contractual</>
                )}
              </button>
              <button type="button" className="btn btn-outline-secondary px-4 py-2 fw-semibold" onClick={() => setMostrarContrato(false)} disabled={loading}>
                ← Volver a Identidad
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}