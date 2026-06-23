'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface LogProceso {
  archivo: string;
  estado: 'exito' | 'error';
  detalle: string;
}

export default function CargaMasivaMultiPage() {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [logs, setLogs] = useState<LogProceso[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const listaArchivos = Array.from(e.target.files);
      setArchivos(listaArchivos);
      setLogs([]);
      setProgreso(0);
    }
  };

  const procesarPlanillaIdivual = (file: File): Promise<LogProceso> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const filasRaw: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, range: 7 });

          if (filasRaw.length === 0) {
            return resolve({ archivo: file.name, estado: 'error', detalle: 'La planilla está vacía a partir de la fila 8.' });
          }

          let insertados = 0;
          let erroresFila = 0;
          let listaErroresDetallados: string[] = [];

          for (const rawFila of filasRaw) {
            const fila: any = {};
            Object.keys(rawFila).forEach((key) => {
              const cleanKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
              fila[cleanKey] = rawFila[key];
            });

            const rawRut = fila['RUN'] || fila['RUT'];
            const rut = parseInt(rawRut);
            
            if (!rut || isNaN(rut)) {
              continue; 
            }

            const dv = String(fila['DV'] || '').toUpperCase().trim();
            const nombres = String(fila['NOMBRES'] || '').toUpperCase().trim();
            
            // CORREGIDO: Declaración de la variable paterno de manera limpia
            const p_apellido = fila['PRIMER A'] || fila['PRIMER APELLIDO'] || '';
            const paterno = String(p_apellido).toUpperCase().trim();
            
            const materno = fila['SEGUNDO'] || fila['SEGUNDO APELLIDO'] ? String(fila['SEGUNDO'] || fila['SEGUNDO APELLIDO']).toUpperCase().trim() : null;
            
            const jornada = parseInt(fila['JORNADA'] || 42);
            const s_base = fila['SUELDO B.'] || fila['SUELDO B'] || fila['SUELDO BASE'] || fila['SUELDO'];
            const sueldo = parseFloat(s_base);
            
            const inicio = fila['FECHA INI'] || fila['FECHA INICIO'];
            const termino = fila['FECHA TERMINO'] || fila['FECHA TÉRMINO'] || null;

            if (!nombres || !paterno || isNaN(sueldo) || !inicio) {
              erroresFila++;
              listaErroresDetallados.push(`RUT ${rut}: Faltan campos contractuales requeridos.`);
              continue;
            }

            const formatearFechaSegura = (fechaInput: any): string => {
              if (!fechaInput) return '';
              const strFecha = String(fechaInput).trim();

              if (strFecha.includes('/')) {
                const partes = strFecha.split('/');
                if (partes.length === 3) {
                  const dia = partes[0].padStart(2, '0');
                  const mes = partes[1].padStart(2, '0');
                  const anio = partes[2];
                  return `${anio}-${mes}-${dia}`;
                }
              }

              const d = new Date(fechaInput);
              if (!isNaN(d.getTime())) {
                const year = d.getUTCFullYear();
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              }
              return strFecha;
            };

            const fechaInicioISO = formatearFechaSegura(inicio);
            const fechaTerminoISO = termino ? formatearFechaSegura(termino) : null;

            // A) Sincronizar Identidad (Usa la variable paterno corregida)
            const { error: errTrabajador } = await supabase.from('trabajadores').upsert({
              rut, dv, nombres, primer_apellido: paterno, segundo_apellido: materno
            });

            if (errTrabajador) {
              erroresFila++;
              listaErroresDetallados.push(`RUT ${rut}: Error maestro de identidad (${errTrabajador.message})`);
              continue;
            }

            // B) Periodo Contractual
            const { error: errContrato } = await supabase.from('contratos').insert({
              trabajador_rut: rut,
              jornada,
              sueldo_base: sueldo,
              fecha_inicio: fechaInicioISO,
              fecha_termino: fechaTerminoISO
            });

            if (errContrato) {
              erroresFila++;
              if (errContrato.message.includes('violates exclusion constraint')) {
                listaErroresDetallados.push(`RUT ${rut}: Superposición de fechas detectada con otro contrato.`);
              } else {
                listaErroresDetallados.push(`RUT ${rut}: ${errContrato.message}`);
              }
            } else {
              insertados++;
            }
          }

          if (insertados > 0) {
            if (erroresFila > 0) {
              resolve({ 
                archivo: file.name, 
                estado: 'error', 
                detalle: `Carga parcial: ${insertados} exitosos. ${erroresFila} rechazados (Ej: ${listaErroresDetallados[0]}).` 
              });
            } else {
              resolve({ 
                archivo: file.name, 
                estado: 'exito', 
                detalle: `Carga exitosa: ${insertados} contratos procesados de forma limpia.` 
              });
            }
          } else {
            const motivoFalla = listaErroresDetallados[0] || 'La planilla no contiene registros válidos.';
            resolve({ 
              archivo: file.name, 
              estado: 'error', 
              detalle: `Rechazado. Motivo: ${motivoFalla}` 
            });
          }

        } catch (err: any) {
          resolve({ archivo: file.name, estado: 'error', detalle: `Error de procesamiento: ${err.message}` });
        }
      };

      reader.readAsBinaryString(file);
    });
  };

  const handleIniciarCargaMasiva = async () => {
    if (archivos.length === 0) return;
    
    setProcesando(true);
    setProgreso(0);
    setLogs([]);

    const totalArchivos = archivos.length;
    const listaLogs: LogProceso[] = [];

    for (let i = 0; i < totalArchivos; i++) {
      const resultadoLog = await procesarPlanillaIdivual(archivos[i]);
      listaLogs.push(resultadoLog);
      setLogs([...listaLogs]);
      
      const porcentaje = Math.round(((i + 1) / totalArchivos) * 100);
      setProgreso(porcentaje);
    }

    setProcesando(false);
    setArchivos([]);
  };

  return (
    <div className="container-fluid" style={{ maxWidth: '1000px' }}>
      <div className="mb-4">
        <h2 className="fw-bold text-dark m-0">
          <i className="bi bi-cloud-arrow-up-fill text-primary me-2"></i>
          Carga Masiva Multiaquivos (SIGPER)
        </h2>
        <p className="text-muted small">
          Arrastra o selecciona las 399 planillas .xlsx de forma simultánea. El motor resolverá la cola de cargas automáticamente.
        </p>
      </div>

      <div className="card shadow-sm border-0 p-4 bg-white text-center mb-4">
        <div className="border border-2 border-dashed rounded p-5 bg-light position-relative">
          <i className="bi bi-file-earmark-excel text-success display-4 mb-3 d-block"></i>
          <label className="form-label fw-bold text-dark d-block mb-1 cursor-pointer">
            Seleccionar o arrastrar múltiples planillas
          </label>
          <span className="text-muted small d-block mb-3">Soporta múltiples archivos .xlsx al mismo tiempo</span>
          
          <input
            type="file"
            className="form-control form-control-sm mx-auto"
            style={{ maxWidth: '350px' }}
            multiple
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            disabled={procesando}
          />
        </div>

        {archivos.length > 0 && (
          <div className="mt-4 text-start d-flex justify-content-between align-items-center bg-primary-light p-3 rounded">
            <div>
              <i className="bi bi-files me-2 text-primary"></i>
              Se han seleccionado <strong>{archivos.length} planillas</strong> listas para procesar.
            </div>
            <button
              className="btn btn-primary fw-bold"
              onClick={handleIniciarCargaMasiva}
              disabled={procesando}
            >
              <i className="bi bi-play-circle-fill me-1"></i> Procesar Bloque Masivo
            </button>
          </div>
        )}
      </div>

      {procesando && (
        <div className="card shadow-sm border-0 p-3 mb-4 bg-white">
          <div className="d-flex justify-content-between mb-1 small fw-bold">
            <span>Progreso General de Inserción</span>
            <span className="text-primary">{progreso}% Completo</span>
          </div>
          <div className="progress" style={{ height: '12px' }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated bg-success"
              role="progressbar"
              style={{ width: `${progreso}%` }}
            ></div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-dark text-white fw-bold small">
            <i className="bi bi-terminal me-2"></i>Consola de Auditoría de Carga ({logs.length} procesados)
          </div>
          <div className="card-body p-0 overflow-auto bg-light" style={{ maxHeight: '400px' }}>
            <div className="list-group list-group-flush font-monospace small">
              {logs.map((log, idx) => (
                <div key={idx} className={`list-group-item d-flex justify-content-between align-items-center py-2 ${log.estado === 'error' ? 'list-group-item-danger' : 'list-group-item-success'}`}>
                  <div>
                    <i className={`bi ${log.estado === 'error' ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'} me-2`}></i>
                    <strong>{log.archivo}</strong>: <span className="text-secondary">{log.detalle}</span>
                  </div>
                  <span className={`badge ${log.estado === 'error' ? 'bg-danger' : 'bg-success'}`}>
                    {log.estado.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}