'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export default function CargaMasivaExcel() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'danger' | ''; text: string }>({ type: '', text: '' });
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMsg({ type: '', text: '' });
    setProgreso({ actual: 0, total: 0 });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // range: 7 le indica a SheetJS que ignore las primeras 7 filas (0 a 6) 
      // e inicie la lectura exactamente en la fila 8 del reporte SIGPER
      const filas: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 7 });

      if (filas.length === 0) {
        throw new Error('El archivo no contiene filas de datos válidas en la sección esperada.');
      }

      setProgreso({ actual: 0, total: filas.length });
      let procesados = 0;

      for (const fila of filas) {
        // Mapeo exacto según las columnas de tu imagen:
        // A=RUN (0), B=DV (1), C=PRIMER APELLIDO (2), D=SEGUNDO APELLIDO (3), 
        // E=NOMBRES (4), F=JORNADA (5), G=SUELDO B. (6), H=FECHA INI (7), I=FECHA TÉRMINO (8)
        const [rut, dv, primerAp, segundoAp, nombres, jornada, sueldo, fechaIni, fechaTerm] = fila;

        // Si la fila no tiene RUN (por ejemplo, el cierre del Excel), nos saltamos esa línea
        if (!rut || isNaN(Number(rut))) continue;

        // 1. Guardar o actualizar datos de identidad del trabajador (Evita duplicar RUNs)
        const { error: errorTrabajador } = await supabase.from('trabajadores').upsert({
          rut: parseInt(rut),
          dv: String(dv).toUpperCase().trim(),
          primer_apellido: String(primerAp).toUpperCase().trim(),
          segundo_apellido: segundoAp ? String(segundoAp).toUpperCase().trim() : null,
          nombres: String(nombres).toUpperCase().trim()
        });

        if (errorTrabajador) throw errorTrabajador;

        // 2. Insertar el contrato asociado detectado en la línea
        const { error: errorContrato } = await supabase.from('contratos').insert({
          trabajador_rut: parseInt(rut),
          jornada: parseInt(jornada),
          sueldo_base: parseFloat(sueldo),
          fecha_inicio: formatearFechaExcel(fechaIni),
          fecha_termino: fechaTerm ? formatearFechaExcel(fechaTerm) : null
        });

        if (errorContrato) throw errorContrato;

        procesados++;
        setProgreso(prev => ({ ...prev, actual: procesados }));
      }

      setStatusMsg({
        type: 'success',
        text: `¡Éxito! Se procesó el reporte SIGPER correctamente. ${procesados} registros añadidos/actualizados.`
      });
    } catch (error: any) {
      console.error(error);
      setStatusMsg({
        type: 'danger',
        text: `Error al procesar el archivo: ${error.message || 'Verifica el formato interno del Excel.'}`
      });
    } finally {
      setLoading(false);
      // Limpiar el input file
      e.target.value = '';
    }
  };

  // Transforma fechas de formato DD/MM/AAAA a AAAA-MM-DD (Requerido por PostgreSQL)
  const formatearFechaExcel = (fechaRaw: any): string => {
    if (typeof fechaRaw === 'number') {
      // Por si Excel exportó la celda como número de serie de días
      const fechaObj = XLSX.SSF.parse_date_code(fechaRaw);
      const mes = String(fechaObj.m).padStart(2, '0');
      const dia = String(fechaObj.d).padStart(2, '0');
      return `${fechaObj.y}-${mes}-${dia}`;
    }
    
    // Si viene como texto estándar "01/01/2026"
    const partes = String(fechaRaw).split('/');
    if (partes.length === 3) {
      const [dia, mes, ano] = partes;
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    return fechaRaw;
  };

  return (
    <div className="card shadow-sm border-0" style={{ maxWidth: '600px' }}>
      <div className="card-header bg-dark text-white fw-bold">
        <i className="bi bi-cloud-arrow-up-fill me-2"></i> Procesador Masivo de Archivos
      </div>
      <div className="card-body p-4">
        <p className="text-muted small">
          Selecciona el archivo <code>.xlsx</code> o <code>.xls</code> exportado desde <strong>SIGPER</strong>. El sistema omitirá las filas de filtros y mapeará dinámicamente el historial de contratos.
        </p>

        <div className="mb-3 mt-4">
          <label className="form-label fw-semibold small text-secondary">Cargar archivo Excel</label>
          <input
            type="file"
            className="form-control"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            disabled={loading}
          />
        </div>

        {loading && (
          <div className="mt-3">
            <div className="d-flex justify-content-between mb-1 small text-primary fw-bold animate-pulse">
              <span>Procesando registros en Supabase...</span>
              <span>{progreso.actual} / {progreso.total}</span>
            </div>
            <div className="progress" style={{ height: '10px' }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated bg-info"
                role="progressbar"
                style={{ width: `${(progreso.actual / progreso.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {statusMsg.type && (
          <div className={`alert alert-${statusMsg.type} mt-3 mb-0 small d-flex align-items-center`} role="alert">
            <i className={`bi bi-${statusMsg.type === 'success' ? 'check-circle-fill' : 'exclamation-octagon-fill'} me-2 fs-5`}></i>
            <div>{statusMsg.text}</div>
          </div>
        )}
      </div>
    </div>
  );
}