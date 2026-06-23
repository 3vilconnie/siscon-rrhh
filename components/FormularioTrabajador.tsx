'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function FormularioTrabajador() {
  const [rut, setRut] = useState('');
  const [dv, setDv] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'danger' | ''; text: string }>({ type: '', text: '' });

  // Campos de Texto
  const [nombres, setNombres] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  
  // Campos del Contrato
  const [jornada, setJornada] = useState('42');
  const [sueldoBase, setSueldoBase] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');

  // Estado para bloquear/desbloquear dinámicamente los campos de identidad
  const [existeTrabajador, setExisteTrabajador] = useState(false);

  // LÓGICA 1: Calcular DV Chileno automáticamente
  const calcularDV = (rutAux: string) => {
    let M = 0, S = 1;
    let T = parseInt(rutAux);
    for (; T; T = Math.floor(T / 10)) {
      S = (S + (T % 10) * (9 - (M++ % 6))) % 11;
    }
    return S ? (S - 1).toString() : 'K';
  };

  // Permitir escribir en el input de RUT
  const handleRutChange = (valor: string) => {
    setRut(valor);
  };

  // NUEVA FUNCIÓN: Limpiar por completo todos los datos y alertas del formulario
  const handleLimpiarFormulario = () => {
    setRut('');
    setDv('');
    setNombres('');
    setPrimerApellido('');
    setSegundoApellido('');
    setSueldoBase('');
    setFechaInicio('');
    setFechaTermino('');
    setJornada('42'); // Vuelve a la jornada base predeterminada
    setExisteTrabajador(false); // Desbloquea los campos
    setMsg({ type: '', text: '' }); // Quita los carteles de alerta
  };

  // LÓGICA 2: Al presionar TAB o salir del campo RUT, buscar si ya existe
  const handleRutBlur = async () => {
    const cleanRut = rut.replace(/[^0-9]/g, ''); // Limpiar puntos o letras
    if (!cleanRut) return;

    setRut(cleanRut);
    // Calcular y asignar DV en tiempo real
    const dvCalculado = calcularDV(cleanRut);
    setDv(dvCalculado);

    // Buscar en Supabase si el trabajador ya está registrado
    const { data: trabajador, error } = await supabase
      .from('trabajadores')
      .select('*')
      .eq('rut', parseInt(cleanRut))
      .single();

    if (trabajador && !error) {
      // ¡Autocompletar datos de identidad! El operador no tendrá que reescribirlos
      setNombres(trabajador.nombres);
      setPrimerApellido(trabajador.primer_apellido);
      setSegundoApellido(trabajador.segundo_apellido || '');
      setExisteTrabajador(true); // Activa el bloqueo de los inputs
      setMsg({ type: 'success', text: 'Trabajador encontrado en el sistema. Los nuevos datos generarán un nuevo contrato.' });
    } else {
      // Es un trabajador completamente nuevo, limpiar campos para llenado manual
      setNombres('');
      setPrimerApellido('');
      setSegundoApellido('');
      setExisteTrabajador(false); // Permite la escritura manual
      setMsg({ type: '', text: '' });
    }
  };

  // LÓGICA 3: Guardar el Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    // =========================================================
    // VALIDACIÓN PREVENTIVA DE TRASLAPE DE FECHAS (CAPA 2)
    // =========================================================
    if (!fechaInicio) {
      setMsg({ type: 'danger', text: 'La fecha de inicio es obligatoria.' });
      setLoading(false);
      return;
    }

    if (fechaTermino && new Date(fechaTermino) < new Date(fechaInicio)) {
      setMsg({ type: 'danger', text: '🚨 Error: La fecha de término no puede ser anterior a la de inicio.' });
      setLoading(false);
      return;
    }

    try {
      // 1. Consultar si este RUT ya registra otros contratos en la base de datos
      const { data: contratosExistentes, error: errBusqueda } = await supabase
        .from('contratos')
        .select('fecha_inicio, fecha_termino')
        .eq('trabajador_rut', parseInt(rut)); // Compara con el RUT digitado

      if (!errBusqueda && contratosExistentes && contratosExistentes.length > 0) {
        const inicioNuevo = new Date(fechaInicio);
        const terminoNuevo = fechaTermino ? new Date(fechaTermino) : new Date('2099-12-31');

        // Evaluar colisión de periodos usando la fórmula matemática
        const hayTraslape = contratosExistentes.some(contrato => {
          const inicioExistente = new Date(contrato.fecha_inicio);
          const terminoExistente = contrato.fecha_termino ? new Date(contrato.fecha_termino) : new Date('2099-12-31');
          
          return (inicioNuevo <= terminoExistente && terminoNuevo >= inicioExistente);
        });

        if (hayTraslape) {
          setMsg({
            type: 'danger',
            text: '🚨 Restricción Contractual: El período ingresado se superpone o choca con las fechas de otro contrato ya registrado para este funcionario.'
          });
          setLoading(false);
          return; // Detiene el envío e impide que golpee la base de datos
        }
      }

      // =========================================================
      // SI PASÓ EL FILTRO, SE GUARDA NORMALMENTE
      // =========================================================
      
      // 1. Guardar/Actualizar Identidad
      const { error: errTrabajador } = await supabase.from('trabajadores').upsert({
        rut: parseInt(rut),
        dv: dv.toUpperCase(),
        nombres: nombres.toUpperCase().trim(),
        primer_apellido: primerApellido.toUpperCase().trim(),
        segundo_apellido: segundoApellido ? segundoApellido.toUpperCase().trim() : null
      });

      if (errTrabajador) throw errTrabajador;

      // 2. Insertar nuevo periodo contractual
      const { error: errContrato } = await supabase.from('contratos').insert({
        trabajador_rut: parseInt(rut),
        jornada: parseInt(jornada),
        sueldo_base: parseFloat(sueldoBase),
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino || null
      });

      if (errContrato) throw errContrato;

      setMsg({ type: 'success', text: '¡Ficha contractual e identidad guardadas exitosamente!' });
      
      // Llamamos al método de limpieza para dejar el formulario listo de inmediato
      handleLimpiarFormulario();
    } catch (error: any) {
      setMsg({ type: 'danger', text: `Error al guardar: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm border-0 justify-content-center" style={{ maxWidth: '800px' }}>
      <div className="card-header bg-primary text-white fw-bold">
        <i className="bi bi-person-gear me-2"></i> Formulario de Personal y Contratos
      </div>
      <form onSubmit={handleSubmit} className="card-body p-4">
        
        {msg.text && (
          <div className={`alert alert-${msg.type} small py-2`} role="alert">
            {msg.text}
          </div>
        )}

        <h5 className="text-secondary border-bottom pb-2 mb-3 fw-bold small text-uppercase">1. Datos de Identidad</h5>
        
        <div className="row g-3 mb-4">
          {/* Campo RUT */}
          <div className="col-md-3">
            <label className="form-label small fw-bold text-secondary">RUT (Sin puntos ni guión)</label>
            <input
              type="text"
              className="form-control"
              placeholder="RUT"
              value={rut}
              onChange={(e) => handleRutChange(e.target.value)}
              onBlur={handleRutBlur}
            />
          </div>

          {/* Campo DV */}
          <div className="col-md-1">
            <label className="form-label small fw-bold text-secondary">DV</label>
            <input
              type="text"
              className="form-control fw-bold text-center bg-light"
              value={dv}
              readOnly
            />
          </div>

          {/* Campo Nombres */}
          <div className="col-md-8">
            <label className="form-label small fw-bold text-secondary">Nombres</label>
            <input
              type="text"
              className={`form-control ${existeTrabajador ? 'bg-light text-muted fw-medium' : ''}`}
              placeholder="NOMBRES"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              readOnly={existeTrabajador}
              required
            />
          </div>

          {/* Campo Primer Apellido */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary">Primer Apellido</label>
            <input
              type="text"
              className={`form-control ${existeTrabajador ? 'bg-light text-muted fw-medium' : ''}`}
              placeholder="APELLIDO PATERNO"
              value={primerApellido}
              onChange={(e) => setPrimerApellido(e.target.value)}
              readOnly={existeTrabajador}
              required
            />
          </div>

          {/* Campo Segundo Apellido */}
          <div className="col-md-6">
            <label className="form-label small fw-bold text-secondary">Segundo Apellido</label>
            <input
              type="text"
              className={`form-control ${existeTrabajador ? 'bg-light text-muted fw-medium' : ''}`}
              placeholder="APELLIDO MATERNO"
              value={segundoApellido}
              onChange={(e) => setSegundoApellido(e.target.value)}
              readOnly={existeTrabajador}
            />
          </div>
        </div>

        <h5 className="text-secondary border-bottom pb-2 mb-3 fw-bold small text-uppercase">2. Estructura Contractual</h5>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Horas Semanales (Jornada)</label>
            <input type="number" className="form-control" value={jornada} onChange={(e) => setJornada(e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Sueldo Base ($)</label>
            <input type="number" className="form-control" placeholder="650000" value={sueldoBase} onChange={(e) => setSueldoBase(e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Fecha Inicio</label>
            <input type="date" className="form-control" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Fecha Término (Opcional)</label>
            <input type="date" className="form-control" value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)} />
          </div>
        </div>

        {/* CONTENEDOR DE ACCIONES CON EL NUEVO BOTÓN */}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary px-4 fw-bold" disabled={loading}>
            {loading ? 'Guardando Registro...' : 'Guardar Ficha Contractual'}
          </button>
          
          <button 
            type="button" 
            className="btn btn-outline-secondary px-4" 
            onClick={handleLimpiarFormulario}
            disabled={loading}
          >
            <i className="bi bi-eraser-fill me-1"></i> Limpiar Campos
          </button>
        </div>
      </form>
    </div>
  );
}