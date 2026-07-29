"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Trabajador, DetalleDocumento} from "@/types";


export default function ModuloRecepcionDocumentos() {

  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([]);
  const [detalleOtro, setDetalleOtro] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [baseDatosTrabajadores, setBaseDatosTrabajadores] = useState<Trabajador[]>([]);
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().split('T')[0]);

  // Estado para manejar las filas de la tabla dinámicamente
  const [detalles, setDetalles] = useState<DetalleDocumento[]>([
  ]);

  const fetchTrabajadores = async ()=>{
    setLoading(true);

    const {data, error} = await supabase.from("trabajadores").select(`rut, dv, nombres, primer_apellido, segundo_apellido`);

    if(error || !data){
        toast.error("error al cargar la base de datos de trabajadores.");
    }
    setBaseDatosTrabajadores(data ?? []);
    setLoading(false);
    }

  const handleTipoToggle = (tipo: string) => {
    setTiposSeleccionados(prev => {
      const isSelected = prev.includes(tipo);
      if (isSelected && tipo === 'Otro') setDetalleOtro('');
      return isSelected ? prev.filter(t => t !== tipo) : [...prev, tipo];
    });
  };

  // Función para agregar una nueva fila vacía
  const agregarFila = () => {
    setDetalles([...detalles, { 
      id: Date.now(), fechaEmision: '', cabecera: '', nombre: '', apellidoP: '', apellidoM: '', genero: 'S/R', rut: '', dv: '' 
    }]);
  };

  // Función para manejar los cambios en los inputs de la tabla
  const handleInputChange = (index: number, campo: keyof DetalleDocumento, valor: string) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index] = { ...nuevosDetalles[index], [campo]: valor };
    setDetalles(nuevosDetalles);
  };

  const buscarNombre = (e : React.ChangeEvent<HTMLInputElement>, rut : string) => {
    const rutBuscado = rut.replace(/\./g, '');

    if(!rut) return;

    const trabajadorEncontrado = baseDatosTrabajadores.find(t => rut === t.rut.toString());

    e.target.value = !trabajadorEncontrado ? e.target.value : `${trabajadorEncontrado?.nombres} ${trabajadorEncontrado?.primer_apellido} ${trabajadorEncontrado?.segundo_apellido}`;

  }

  // Función que busca al trabajador cuando el usuario sale del input de RUT
  const buscarTrabajador = (index: number) => {
    const rutBuscado = detalles[index].rut.replace(/\./g, ''); // Quitamos puntos por si acaso

    console.log(rutBuscado);

    if (!rutBuscado) return;

    const trabajadorEncontrado = baseDatosTrabajadores.find(t => t.rut.toString() === rutBuscado);

    if (trabajadorEncontrado) {
      const nuevosDetalles = [...detalles];
      nuevosDetalles[index] = {
        ...nuevosDetalles[index],
        cabecera: "S/R",
        nombre: trabajadorEncontrado.nombres,
        apellidoP: trabajadorEncontrado.primer_apellido,
        apellidoM: trabajadorEncontrado.segundo_apellido,
        genero: trabajadorEncontrado.genero ?? "S/R",
        dv: trabajadorEncontrado.dv
      };
      console.table(detalles);
      console.log("------------");
      console.table(nuevosDetalles);
      setDetalles(nuevosDetalles);
    }
  };

  useEffect(()=>{
    fetchTrabajadores();
  },[]);

  if (loading) return <div className="spinner-border" role="status"></div>

  return (
    <div className="container my-5">
      <div className="card shadow-sm border-0">
        <div className="card-body p-4 p-md-5">
          <h2 className="text-center fw-bold mb-5">Formulario Recepción de Documentos</h2>

          {/* SECCIÓN 1: Tipos de Documentos e Información General */}
          <div className="row mb-5 pb-4 border-bottom">
            <div className="col-12 col-md-6 mb-4 mb-md-0">
              <h5 className="fw-semibold mb-3">Tipo(s) de Documento adjunto:</h5>
              <div className="d-flex flex-column gap-2">
                {['Finiquito', 'Contrato', 'Anexo contrato', 'Notificación', 'Otro'].map((tipo) => (
                  <div key={tipo} className="form-check">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id={`check-${tipo.replace(/\s+/g, '-')}`}
                      checked={tiposSeleccionados.includes(tipo)}
                      onChange={() => handleTipoToggle(tipo)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label className="form-check-label" htmlFor={`check-${tipo.replace(/\s+/g, '-')}`} style={{ cursor: 'pointer' }}>
                      {tipo}
                    </label>
                    
                    {tipo === 'Otro' && tiposSeleccionados.includes('Otro') && (
                      <input
                        type="text"
                        className="form-control form-control-sm mt-2 w-75 border-top-0 border-end-0 border-start-0 rounded-0 bg-light"
                        placeholder="Especifique el tipo de documento..."
                        value={detalleOtro}
                        onChange={(e) => setDetalleOtro(e.target.value)}
                        autoFocus
                        style={{ borderBottom: '2px solid #0d6efd', boxShadow: 'none' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="mb-3">
                <label className="form-label fw-medium text-secondary">Fecha de Recepción</label>
                <input type="date" className="form-control shadow-sm" value={fechaRecepcion} onChange={e=>setFechaRecepcion(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium text-secondary">Cantidad / Descripción general</label>
                <input type="text" className="form-control shadow-sm" placeholder="Ej: 4 Contratos rectificados, 1 copia" />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Detalle de los Documentos (Tabla) */}
          <div className="mb-5 pb-4 border-bottom">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-semibold m-0">Detalle</h5>
              <button type="button" onClick={agregarFila} className="btn btn-primary btn-sm px-3 shadow-sm">
                + Añadir Fila
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle text-nowrap mb-0">
                <thead style={{ backgroundColor: '#8b0000', color: 'white' }}>
                  <tr>
                    <th className="py-2 fw-normal">FECHA_EMIS</th>
                    <th className="py-2 fw-normal">CABECERA</th>
                    <th className="py-2 fw-normal">RUT</th>
                    <th className="py-2 fw-normal text-center">DV</th>
                    <th className="py-2 fw-normal">NOMBRE</th>
                    <th className="py-2 fw-normal">APELLIDO P</th>
                    <th className="py-2 fw-normal">APELLIDO M</th>
                    <th className="py-2 fw-normal">GENERO</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.length == 0 ? <tr><td colSpan={8}><span className="d-flex text-muted justify-content-center my-3">Aún no ingresas datos.</span></td></tr> : detalles.map((fila, index) => (
                    <tr key={fila.id}>
                      <td className="p-1">
                        <input type="date" value={fila.fechaEmision} onChange={(e) => handleInputChange(index, 'fechaEmision', e.target.value)} className="form-control form-control-sm border-0 bg-transparent shadow-none" />
                      </td>
                      <td className="p-1">
                        <input type="text" value={fila.cabecera} onChange={(e) => handleInputChange(index, 'cabecera', e.target.value)} className="form-control form-control-sm border-0 bg-transparent shadow-none" placeholder="PZD1" />
                      </td>
                      <td className="p-1">
                        <input 
                          type="text" 
                          value={fila.rut} 
                          onChange={(e) => handleInputChange(index, 'rut', e.target.value)} 
                          onBlur={() => buscarTrabajador(index)} // <-- AQUÍ SE DISPARA LA BÚSQUEDA AL SALIR DEL INPUT
                          className="form-control form-control-sm border-0 bg-transparent shadow-none" 
                          placeholder="20910472" 
                        />
                      </td>
                      <td className="p-1 text-center">
                        <input type="text" value={fila.dv} onChange={(e) => handleInputChange(index, 'dv', e.target.value)} className="form-control form-control-sm border-0 bg-transparent shadow-none text-center d-inline-block" placeholder="5" maxLength={1} style={{ width: '40px' }} />
                      </td>
                      <td className="p-1">
                        <input type="text" value={fila.nombre} onChange={(e) => handleInputChange(index, 'nombre', e.target.value)} className="form-control form-control-sm border-0 bg-transparent shadow-none" placeholder="Nombre" />
                      </td>
                      <td className="p-1">
                        <input type="text" value={fila.apellidoP} onChange={(e) => handleInputChange(index, 'apellidoP', e.target.value)} className="form-control form-control-sm border-0 bg-transparent shadow-none" placeholder="Apellido P" />
                      </td>
                      <td className="p-1">
                        <input type="text" value={fila.apellidoM ?? ""} onChange={(e) => handleInputChange(index, 'apellidoM', e.target.value)} className="form-control form-control-sm border-0 bg-transparent shadow-none" placeholder="Apellido M" />
                      </td>
                      <td className="p-1">
                        <select value={fila.genero} onChange={(e) => handleInputChange(index, 'genero', e.target.value)} className="form-select form-select-sm border-0 bg-transparent shadow-none">
                          <option value="SR">S/R</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN 3: Responsables */}
          <div className="row text-center pt-2">
            <div className="col-12 col-md-6 mb-4 mb-md-0">
              <input type="text" 
              className="form-control text-center text-uppercase fw-medium mx-auto mb-1 border-top-0 border-end-0 border-start-0 rounded-0 bg-transparent" 
              placeholder="Nombre de quien entrega" 
              style={{ width: '75%', borderBottom: '2px solid #6c757d', boxShadow: 'none' }}
              onChange={(e) => buscarNombre(e as any, e.target.value)}
              />
              <span className="text-muted small">Entrega</span>
            </div>
            <div className="col-12 col-md-6">
              <input type="text" 
              className="form-control text-center text-uppercase fw-medium mx-auto mb-1 border-top-0 border-end-0 border-start-0 rounded-0 bg-transparent" 
              placeholder="Nombre de quien recibe" 
              style={{ width: '75%', borderBottom: '2px solid #6c757d', boxShadow: 'none' }} 
              onChange={(e) => buscarNombre(e as any, e.target.value)}
              />
              <span className="text-muted small">Recibe</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="d-flex justify-content-end mt-5">
            <button type="button" className="btn btn-success px-4 py-2 shadow-sm">
              Guardar Documento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}