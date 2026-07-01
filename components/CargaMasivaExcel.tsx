'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface ArchivoPrevia {
  id: string;
  file: File;
  nombre: string;
  tamano: string;
  estado: 'pendiente' | 'procesando' | 'exito' | 'error';
  detalle?: string;
}

export default function CargaMasivaExcel() {
  const [archivos, setArchivos] = useState<ArchivoPrevia[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [isDragging, setIsCollapsed] = useState(false); // Controla el estado visual del arrastre
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convertir bytes a un formato legible por humanos
  const formatearTamano = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Manejar la selección manual o por drop de archivos
  const agregarArchivosALista = (filesList: FileList) => {
    const nuevos = Array.from(filesList)
      .filter(file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))
      .map(file => ({
        id: crypto.randomUUID(),
        file,
        nombre: file.name,
        tamano: formatearTamano(file.size),
        estado: 'pendiente' as const
      }));

    if (nuevos.length === 0) {
      toast.error('Por favor, selecciona solo archivos válidos de Microsoft Excel (.xlsx, .xls)');
      return;
    }

    setArchivos(prev => [...prev, ...nuevos]);
  };

  // Eventos de Drag & Drop (Nativos y fluidos)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsCollapsed(true);
  };

  const handleDragLeave = () => {
    setIsCollapsed(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsCollapsed(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      agregarArchivosALista(e.dataTransfer.files);
    }
  };

  const removerArchivo = (id: string) => {
    setArchivos(prev => prev.filter(a => a.id !== id));
  };

  // Transforma fechas de formato DD/MM/AAAA a AAAA-MM-DD (Requerido por PostgreSQL)
  const formatearFechaExcel = (fechaRaw: any): string => {
    if (typeof fechaRaw === 'number') {
      const fechaObj = XLSX.SSF.parse_date_code(fechaRaw);
      const mes = String(fechaObj.m).padStart(2, '0');
      const dia = String(fechaObj.d).padStart(2, '0');
      return `${fechaObj.y}-${mes}-${dia}`;
    }
    const partes = String(fechaRaw).split('/');
    if (partes.length === 3) {
      const [dia, mes, ano] = partes;
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    return fechaRaw;
  };

  // Procesador individual secuencial (Resiliente)
  const procesarPlanilla = async (item: ArchivoPrevia): Promise<boolean> => {
    try {
      const buffer = await item.file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const filas: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 7 });

      if (filas.length === 0) {
        throw new Error('La planilla no posee filas de datos válidas desde la línea 8.');
      }

      for (const fila of filas) {
        const [rut, dv, primerAp, segundoAp, nombres, jornada, sueldo, fechaIni, fechaTerm] = fila;
        if (!rut || isNaN(Number(rut))) continue;

        // A) Sincronizar Identidad
        const { error: errT } = await supabase.from('trabajadores').upsert({
          rut: parseInt(rut),
          dv: String(dv).toUpperCase().trim(),
          primer_apellido: String(primerAp).toUpperCase().trim(),
          segundo_apellido: segundoAp ? String(segundoAp).toUpperCase().trim() : null,
          nombres: String(nombres).toUpperCase().trim()
        });
        if (errT) throw errT;

        // B) Insertar Periodo Contractual
        const { error: errC } = await supabase.from('contratos').insert({
          trabajador_rut: parseInt(rut),
          jornada: parseInt(jornada) || 44,
          sueldo_base: parseFloat(sueldo) || 0,
          fecha_inicio: formatearFechaExcel(fechaIni),
          fecha_termino: fechaTerm ? formatearFechaExcel(fechaTerm) : null
        });
        if (errC) throw errC;
      }
      return true;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Error de estructura interna.');
    }
  };

  // Disparador global del bloque de cola
  const handleProcesarBloque = async () => {
    if (archivos.length === 0 || procesando) return;

    setProcesando(true);
    const toastId = toast.loading('Procesando cola masiva de planillas...');

    // Copiamos la lista para ir mutando los estados visuales paso a paso
    const listaModificable = [...archivos];

    for (let i = 0; i < listaModificable.length; i++) {
      if (listaModificable[i].estado === 'exito') continue; // Omitir ya subidos

      listaModificable[i].estado = 'procesando';
      setArchivos([...listaModificable]);

      try {
        await procesarPlanilla(listaModificable[i]);
        listaModificable[i].estado = 'exito';
        listaModificable[i].detalle = 'Procesado limpiamente.';
      } catch (error: any) {
        listaModificable[i].estado = 'error';
        listaModificable[i].detalle = error.message;
      }

      setArchivos([...listaModificable]);
    }

    const errores = listaModificable.filter(a => a.estado === 'error').length;
    if (errores > 0) {
      toast.error(`Cola finalizada con ${errores} planillas rechazadas. Revisa el desglose.`, { id: toastId });
    } else {
      toast.success('¡Todas las planillas SIGPER se procesaron con éxito!', { id: toastId });
      setArchivos([]); // Limpiar la lista solo si todo fue perfecto
    }
    setProcesando(false);
  };

  return (
    <div className="card shadow-sm border-0 bg-white mx-auto w-100" style={{ maxWidth: '800px' }}>
      <div className="card-header bg-dark text-white fw-bold d-flex align-items-center">
        <i className="bi bi-cloud-arrow-up-fill me-2 fs-5 text-primary"></i> Procesador Masivo de Reportes SIGPER
      </div>
      
      <div className="card-body p-4 p-md-5">
        
        {/* ZONA INTERACTIVA DRAG AND DROP */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !procesando && fileInputRef.current?.click()}
          className={`border border-2 border-dashed rounded p-5 text-center position-relative transition-all cursor-pointer ${
            isDragging ? 'border-primary bg-primary bg-opacity-10 text-primaryScale' : 'border-secondary bg-light text-muted'
          }`}
          style={{ transition: 'all 0.2s ease', pointerEvents: procesando ? 'none' : 'auto' }}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            className="d-none" 
            multiple 
            accept=".xlsx, .xls"
            onChange={(e) => e.target.files && agregarArchivosALista(e.target.files)}
          />
          <i className={`bi bi-file-earmark-excel display-3 mb-3 d-block ${isDragging ? 'text-primary' : 'text-success'}`}></i>
          <h5 className="fw-bold text-dark mb-1">Arrastra tus planillas SIGPER aquí</h5>
          <p className="small m-0 text-secondary">O haz clic para explorar tus carpetas locales (Soporta carga múltiple en bloque)</p>
        </div>

        {/* LISTADO DE PREVISUALIZACIÓN ANTES DE SUBIR */}
        {archivos.length > 0 && (
          <div className="mt-4 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <h6 className="fw-bold text-secondary m-0">Cola de archivos listos para procesar ({archivos.length})</h6>
              {!procesando && (
                <button className="btn btn-link btn-sm text-danger text-decoration-none p-0 small fw-semibold" onClick={() => setArchivos([])}>
                  Vaciar Cola
                </button>
              )}
            </div>

            <div className="list-group gap-2 overflow-auto ps-1" style={{ maxHeight: '280px' }}>
              {archivos.map((item) => (
                <div 
                  key={item.id} 
                  className={`list-group-item d-flex justify-content-between align-items-center rounded border shadow-sm p-3 transition-all ${
                    item.estado === 'exito' ? 'border-success bg-success bg-opacity-10' :
                    item.estado === 'error' ? 'border-danger bg-danger bg-opacity-10' :
                    item.estado === 'procesando' ? 'border-primary bg-light' : 'bg-white'
                  }`}
                >
                  <div className="d-flex align-items-center gap-3 text-truncate" style={{ maxWidth: '75%' }}>
                    {item.estado === 'exito' && <i className="bi bi-check-circle-fill text-success fs-5"></i>}
                    {item.estado === 'error' && <i className="bi bi-x-circle-fill text-danger fs-5"></i>}
                    {item.estado === 'procesando' && <span className="spinner-border spinner-border-sm text-primary" role="status"></span>}
                    {item.estado === 'pendiente' && <i className="bi bi-file-earmark-arrow-up text-secondary fs-5"></i>}
                    
                    <div className="text-truncate">
                      <span className="fw-bold text-dark d-block text-truncate small" title={item.nombre}>{item.nombre}</span>
                      <span className="text-muted font-monospace" style={{ fontSize: '0.72rem' }}>Tamaño: {item.tamano}</span>
                      {item.detalle && <span className="d-block text-muted" style={{ fontSize: '0.7rem' }}>{item.detalle}</span>}
                    </div>
                  </div>

                  {!procesando && item.estado === 'pendiente' && (
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-danger border-0 p-1 rounded-circle"
                      onClick={() => removerArchivo(item.id)}
                      title="Quitar de la lista"
                    >
                      <i className="bi bi-trash3-fill"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* BOTÓN DISPARADOR DE CARGA */}
            <div className="d-flex justify-content-end mt-4 pt-3 border-top">
              <button 
                type="button" 
                className="btn btn-success fw-bold px-4 py-2"
                onClick={handleProcesarBloque}
                disabled={procesando || archivos.filter(a => a.estado === 'pendiente').length === 0}
              >
                {procesando ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span> Sincronizando Bloque...</>
                ) : (
                  <><i className="bi bi-play-circle-fill me-2"></i> Iniciar Inserción Masiva</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}