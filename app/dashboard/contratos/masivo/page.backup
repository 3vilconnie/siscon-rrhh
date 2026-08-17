'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Card, Table, Button, Badge, Form } from 'react-bootstrap';
import { datosContratoDesdeFilaExcel, type DatosContrato } from '@/lib/contrato';

interface FilaContrato {
  datos: DatosContrato;
  nombre: string;
  rut: number;
  incluir: boolean;
}

export default function ContratosMasivoPage() {
  const [filas, setFilas] = useState<FilaContrato[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [generando, setGenerando] = useState<'pdf' | 'docx' | null>(null);

  const procesarArchivo = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      // Preferimos la hoja "TRABAJADORES"; si no, la primera.
      const hoja =
        wb.SheetNames.find((n) => n.toUpperCase().includes('TRABAJADOR')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[hoja];
      // raw:false → aplica el formato de la celda (fechas como "1 de April de 2026",
      // sueldos como "700,000"), tal como se ve en la planilla.
      const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
        raw: false,
      });

      const parsed: FilaContrato[] = [];
      for (const cruda of filasCrudas) {
        const r = datosContratoDesdeFilaExcel(cruda);
        if (r) parsed.push({ datos: r.datos, nombre: r.nombre, rut: r.rut, incluir: r.seleccion });
      }

      if (parsed.length === 0) {
        toast.error('No se encontraron filas con RUT válido en la planilla.');
        return;
      }
      setFilas(parsed);
      setNombreArchivo(file.name);
      toast.success(`${parsed.length} trabajador(es) leídos de la planilla.`);
    } catch (err) {
      toast.error(`No se pudo leer la planilla: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const toggle = (rut: number) =>
    setFilas((prev) => prev.map((f) => (f.rut === rut ? { ...f, incluir: !f.incluir } : f)));
  const marcarTodos = (v: boolean) => setFilas((prev) => prev.map((f) => ({ ...f, incluir: v })));

  const seleccionadas = filas.filter((f) => f.incluir);

  /** Genera y descarga una plantilla Excel con las columnas esperadas. */
  const descargarPlantilla = () => {
    const headers = [
      'INICIALES', 'FECHA_EMIS', 'CABECERA', 'NOMBRE', 'APELLIDO P', 'APELLIDO M', 'GENERO',
      'RUT', 'DV', 'NACIONALIDAD', 'ESTADO CIVIL', 'LUGAR NAC', 'FECHA NAC', 'DOMICILIO', 'COMUNA',
      'INICIO_CONT', 'TERMINO_CONT', 'LABORES', 'PROGRAMA', 'LUGAR_TRAB', 'DEPENDENCIA_DIR',
      'SUELDO', 'PREVISION', 'SALUD', 'BONO_MOV', 'BONO_COL', 'SELECCION',
    ];
    const ejemplo = [
      'crh', '2026-07-06', 'PZD3', 'SALOMÉ', 'Reyes', 'Vejar', 'F', '15342828', 'K', 'Chilena',
      'Soltera', 'Universidad, Santiago', '1983-11-24', "O'Higgins SN", 'Putre', '2026-04-01',
      '2026-08-31', 'Anfitriona Turística',
      'Transferencia, capacitación y generación de empleos verdes en la Reserva Biosfera Lauca',
      'Putre', 'la gestora de Proyecto la Srta. Paula Díaz', '700000', 'AFP HABITAT', 'VIDATRES',
      '0', '0', 'SI',
    ];
    const wsT = XLSX.utils.aoa_to_sheet([headers, ejemplo]);
    wsT['!cols'] = headers.map(() => ({ wch: 18 }));

    const instrucciones = [
      ['Columna', 'Descripción', 'Valores / formato'],
      ['INICIALES', 'Iniciales del redactor', 'ej. crh'],
      ['FECHA_EMIS', 'Fecha de emisión', 'AAAA-MM-DD'],
      ['CABECERA', 'Programa / proyecto', 'PZD1, PZD3 o CONADI'],
      ['NOMBRE / APELLIDO P / APELLIDO M', 'Identidad del trabajador', ''],
      ['GENERO', 'Género', 'M o F'],
      ['RUT / DV', 'RUT sin puntos y dígito verificador', 'ej. 15342828 / K'],
      ['NACIONALIDAD, ESTADO CIVIL, LUGAR NAC, DOMICILIO, COMUNA', 'Datos personales', ''],
      ['FECHA NAC', 'Fecha de nacimiento', 'AAAA-MM-DD'],
      ['INICIO_CONT / TERMINO_CONT', 'Vigencia del contrato', 'AAAA-MM-DD'],
      ['LABORES', 'Labores del trabajador', 'ej. Jornal'],
      ['PROGRAMA', 'Nombre del programa (cláusula PRIMERO)', ''],
      ['LUGAR_TRAB', 'Comuna del lugar de trabajo', ''],
      ['DEPENDENCIA_DIR', 'Dependencia directa', 'ej. la coordinadora del proyecto ...'],
      ['SUELDO', 'Sueldo bruto mensual', 'solo números, ej. 700000'],
      ['PREVISION / SALUD', 'AFP y sistema de salud', 'ej. AFP HABITAT / FONASA'],
      ['BONO_MOV / BONO_COL', 'Bonos de movilización y colación', 'solo números; 0 en ambos omite la cláusula de bonos'],
      ['SELECCION', 'Incluir en la generación', 'SI o vacío = incluir; NO = omitir'],
    ];
    const wsI = XLSX.utils.aoa_to_sheet(instrucciones);
    wsI['!cols'] = [{ wch: 48 }, { wch: 42 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsT, 'TRABAJADORES');
    XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');
    XLSX.writeFile(wb, 'plantilla_contratos.xlsx');
  };

  const generar = async (formato: 'pdf' | 'docx') => {
    if (seleccionadas.length === 0) return toast.error('Selecciona al menos un trabajador.');

    setGenerando(formato);
    const toastId = toast.loading(`Generando ${seleccionadas.length} contratos...`);
    try {
      const res = await fetch('/api/contratos/generar-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, documentos: seleccionadas.map((f) => f.datos) }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contratos_${seleccionadas.length}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Documento generado.', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar.', {
        id: toastId,
        duration: 6000,
      });
    } finally {
      setGenerando(null);
    }
  };

  return (
    <div className="container-fluid" style={{ maxWidth: '1150px' }}>
      <div className="mb-3">
        <Link href="/dashboard/contratos" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1"></i> Volver a Contratos
        </Link>
      </div>
      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-people-fill text-primary me-2"></i>
          Contratos — Masivo
        </h3>
        <p className="text-muted small m-0">
          Sube tu planilla de información personal (hoja <strong>TRABAJADORES</strong>) y genera un
          único documento con un contrato por página. Es la misma planilla que usabas para la
          combinación de correspondencia.
        </p>
      </div>

      <Card className="shadow-sm border-0 mb-3">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Form.Label className="fw-bold text-secondary small m-0">
              Planilla de información personal (.xlsx / .xlsm)
            </Form.Label>
            <Button variant="outline-success" size="sm" onClick={descargarPlantilla}>
              <i className="bi bi-download me-1"></i> Descargar plantilla
            </Button>
          </div>
          <Form.Control
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) procesarArchivo(f);
            }}
          />
          <Form.Text className="text-muted">
            ¿No tienes la planilla? Descárgala, complétala (hoja <strong>TRABAJADORES</strong>) y súbela.
          </Form.Text>
          {nombreArchivo && (
            <div className="text-muted small mt-2">
              <i className="bi bi-file-earmark-excel me-1"></i>
              {nombreArchivo}
            </div>
          )}
        </Card.Body>
      </Card>

      {filas.length > 0 && (
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-dark text-white fw-bold small py-2 d-flex justify-content-between align-items-center">
            <span>Trabajadores en la planilla</span>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="text-white-50 p-0 text-decoration-none small"
                onClick={() => marcarTodos(true)}
              >
                Todos
              </Button>
              <Button
                variant="link"
                size="sm"
                className="text-white-50 p-0 text-decoration-none small"
                onClick={() => marcarTodos(false)}
              >
                Ninguno
              </Button>
              <Badge bg="info" text="dark">
                {seleccionadas.length}/{filas.length}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table size="sm" className="align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th className="ps-3" style={{ width: 40 }}></th>
                    <th>Trabajador</th>
                    <th>RUT</th>
                    <th>Período</th>
                    <th className="text-end">Sueldo</th>
                    <th>Programa</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const c = f.datos.contrato;
                    const sinFechas = !c.inicio || !c.termino;
                    return (
                      <tr key={f.rut} className={sinFechas ? 'table-warning' : ''}>
                        <td className="ps-3">
                          <Form.Check checked={f.incluir} onChange={() => toggle(f.rut)} />
                        </td>
                        <td className="fw-semibold text-uppercase">{f.nombre}</td>
                        <td className="font-monospace">
                          {f.datos.trabajador.rut_miles}-{f.datos.trabajador.dv}
                        </td>
                        <td>
                          {c.inicio || '—'} → {c.termino || '—'}
                          {sinFechas && (
                            <i
                              className="bi bi-exclamation-triangle text-warning ms-1"
                              title="Revisa el formato de fecha en la planilla"
                            ></i>
                          )}
                        </td>
                        <td className="text-end font-monospace">${c.sueldo_texto}</td>
                        <td>{f.datos.programa.id}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
          <Card.Footer className="d-flex gap-2 justify-content-end bg-white border-top">
            <Button
              variant="outline-primary"
              disabled={seleccionadas.length === 0 || generando !== null}
              onClick={() => generar('docx')}
            >
              <i className="bi bi-file-earmark-word me-1"></i>
              {generando === 'docx' ? 'Generando...' : 'Descargar Word'}
            </Button>
            <Button
              variant="primary"
              disabled={seleccionadas.length === 0 || generando !== null}
              onClick={() => generar('pdf')}
            >
              <i className="bi bi-file-earmark-pdf me-1"></i>
              {generando === 'pdf' ? 'Generando...' : 'Generar PDF'}
            </Button>
          </Card.Footer>
        </Card>
      )}
    </div>
  );
}
