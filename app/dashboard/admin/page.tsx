// app/dashboard/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';
import { Trabajador } from '@/types';

interface Usuario {
  id: string;
  email: string;
  user_metadata: { role?: string };
  banned_until?: string | null;
  created_at: string;
}

interface ParametrosSistema {
  ventana_meses: number;
  enfriamiento_meses: number;
  minimo_contratos: number;
}

interface LogAuditoria {
  id: string;
  actor: string;
  accion: string;
  detalles: string;
  creado_en: string;
}

export default function ConsolaAdministradorCompleta() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  const [parametros, setParametros] = useState<ParametrosSistema>({
    ventana_meses: 15, enfriamiento_meses: 3, minimo_contratos: 2
  });
  const [guardandoParametros, setGuardandoParametros] = useState(false);

  // --- NUEVOS ESTADOS PARA EL MODAL DE CONFIRMACIÓN DE ACCIONES ---
  const [modalConfirmar, setModalConfirmar] = useState({
    visible: false,
    tipo: 'suspender' as 'suspender' | 'activar' | 'eliminar',
    usuarioId: '',
    usuarioEmail: ''
  });
  const [checkConsentimiento, setCheckConsentimiento] = useState(false); // UX para prevenir borrado accidental
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  const cargarDatosConsola = async () => {
    setLoading(true);
    try {
      const resUsers = await fetch('/api/admin/usuarios');
      if (resUsers.ok) setUsuarios(await resUsers.json());

      const resConfig = await fetch('/api/configuraciones');
      if (resConfig.ok) {
        const dataConfig = await resConfig.json();
        if (dataConfig.ventana_meses) setParametros(dataConfig);
      }

      const resLogs = await fetch('/api/admin/auditoria');
      if (resLogs.ok) setLogs(await resLogs.json());
    } catch (error) {
      console.error('Error al inicializar consola:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosConsola();
  }, []);

  const handleGuardarParametros = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoParametros(true);
    try {
      const res = await fetch('/api/configuraciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parametros)
      });
      if (res.ok) alert('¡Parámetros actualizados! ⚙️✨');
    } finally {
      setGuardandoParametros(false);
    }
  };

  // UX: En lugar de disparar window.confirm, abrimos el modal estilizado
  const abrirModalConfirmacion = (u: Usuario, tipo: 'suspender' | 'activar' | 'eliminar') => {
    setCheckConsentimiento(false);
    setModalConfirmar({
      visible: true,
      tipo,
      usuarioId: u.id,
      usuarioEmail: u.email
    });
  };

  // Procesador unificado de acciones sobre usuarios
  const ejecutarAccionUsuario = async () => {
    const { tipo, usuarioId } = modalConfirmar;
    setProcesandoAccion(true);

    try {
      if (tipo === 'eliminar') {
        const res = await fetch('/api/admin/usuarios', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: usuarioId })
        });
        if (res.ok) cargarDatosConsola();
      } else {
        const res = await fetch('/api/admin/usuarios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: usuarioId, 
            accion: tipo === 'activar' ? 'activar' : 'suspender' 
          })
        });
        if (res.ok) cargarDatosConsola();
      }
      setModalConfirmar({ visible: false, tipo: 'suspender', usuarioId: '', usuarioEmail: '' });
    } catch (error) {
      console.error(error);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const generarArchivoCSV = (columnas: string[], filas: any[][], nombreArchivo: string) => {
    const separador = ';';
    const contenido = [
      columnas.join(separador),
      ...filas.map(fila => fila.map(celda => `"${String(celda).replace(/"/g, '""')}"`).join(separador))
    ].join('\n');
    const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${nombreArchivo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportarNomina = async () => {
    setExportando(true);
    try {
      const res = await fetch('/api/admin/exportar');
      if (!res.ok) throw new Error('Error al extraer datos');
      const data: Trabajador[] = await res.json();
      const columnas = ['RUT', 'DV', 'Nombres', 'Apellido Paterno', 'Apellido Materno', 'Total Contratos'];
      const filas = data.map(t => [t.rut, t.dv, t.nombres, t.primer_apellido, t.segundo_apellido || '', t.contratos?.length || 0]);
      generarArchivoCSV(columnas, filas, `Reporte_Nomina_Completa_${new Date().toISOString().split('T')[0]}`);
    } catch (error) {
      alert('Hubo un error al exportar la nómina.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarAlertas = async () => {
    setExportando(true);
    try {
      const res = await fetch('/api/admin/exportar');
      if (!res.ok) throw new Error('Error al extraer datos');
      const data: Trabajador[] = await res.json();
      const columnas = ['RUT', 'DV', 'Nombre Completo', 'Contratos Consecutivos', 'Tiene Vigente', 'Fecha Sugerida Retorno'];
      const filas: any[][] = [];
      data.forEach(t => {
        const analisis = evaluarAlertaContinuidad(t, parametros);
        if (analisis.califica) {
          filas.push([t.rut, t.dv, `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`.trim().toUpperCase(), analisis.totalContratos, analisis.tieneVigente ? 'SÍ' : 'NO', analisis.fechaSugerida]);
        }
      });
      if (filas.length === 0) {
        alert('No hay trabajadores en zona de alerta en este momento.');
        return;
      }
      generarArchivoCSV(columnas, filas, `Reporte_Alertas_Legales_${new Date().toISOString().split('T')[0]}`);
    } catch (error) {
      alert('Hubo un error al exportar las alertas.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark m-0">⚙️ Consola de Administración</h2>
          <p className="text-muted small m-0">Administración de credenciales, parámetros, auditoría y reportes.</p>
        </div>
        <button className="btn btn-outline-dark fw-bold small" onClick={cargarDatosConsola} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-1"></i> Sincronizar
        </button>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-4 d-flex flex-column gap-4">
          <div className="card shadow-sm border-0 bg-white p-4">
            <h5 className="fw-bold text-secondary border-bottom pb-2 mb-3">Parámetros de Alerta</h5>
            <form onSubmit={handleGuardarParametros} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small fw-bold">Ventana de Evaluación (Meses)</label>
                <input type="number" className="form-control" value={parametros.ventana_meses} onChange={(e) => setParametros({ ...parametros, ventana_meses: Number(e.target.value) })} min={1} required />
              </div>
              <div>
                <label className="form-label small fw-bold">Enfriamiento (Meses)</label>
                <input type="number" className="form-control" value={parametros.enfriamiento_meses} onChange={(e) => setParametros({ ...parametros, enfriamiento_meses: Number(e.target.value) })} min={1} required />
              </div>
              <button type="submit" className="btn btn-warning fw-bold mt-2" disabled={guardandoParametros}>
                {guardandoParametros ? 'Guardando...' : 'Actualizar Reglas'}
              </button>
            </form>
          </div>

          <div className="card shadow-sm border-0 bg-white p-4">
            <h5 className="fw-bold text-secondary border-bottom pb-2 mb-3">
              <i className="bi bi-file-earmark-excel me-2 text-success"></i>Exportación de Datos
            </h5>
            <p className="text-muted small mb-3">Descarga la información en formato CSV compatible con Microsoft Excel.</p>
            <div className="d-flex flex-column gap-2">
              <button className="btn btn-outline-success text-start fw-semibold" onClick={handleExportarNomina} disabled={exportando}>
                <i className="bi bi-people me-2"></i>Descargar Nómina Completa
              </button>
              <button className="btn btn-outline-danger text-start fw-semibold" onClick={handleExportarAlertas} disabled={exportando}>
                <i className="bi bi-exclamation-triangle me-2"></i>Reporte Legal de Alertas
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8 d-flex flex-column gap-4">
          <div className="card shadow-sm border-0 bg-white p-4">
            <h5 className="fw-bold text-secondary border-bottom pb-2 mb-3">
              <i className="bi bi-person-plus-fill me-2 text-primary"></i>Crear Nuevo Operador
            </h5>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                const role = (form.elements.namedItem('role') as HTMLSelectElement).value;

                try {
                  const res = await fetch('/api/admin/usuarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, role })
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert(`¡Invitación enviada exitosamente a ${email}!\n\nEl usuario recibirá un enlace seguro para acceder y crear su propia contraseña.`);
                    form.reset();
                    cargarDatosConsola(); 
                  } else {
                    alert(`Error: ${data.error}`);
                  }
                } catch (error) {
                  alert('Error de conexión al crear usuario.');
                }
              }}
              className="row g-3"
            >
              <div className="col-md-5">
                <input type="email" name="email" className="form-control" placeholder="correo@institucion.cl" required />
              </div>
              <div className="col-md-4">
                <select name="role" className="form-select" required>
                  <option value="usuario">Operador Estándar</option>
                  <option value="admin">Administrador Global</option>
                </select>
              </div>
              <div className="col-md-3">
                <button type="submit" className="btn btn-primary w-100 fw-bold">Crear Cuenta</button>
              </div>
            </form>
          </div>

          <div className="card shadow-sm border-0 bg-white overflow-hidden">
            <div className="card-header bg-dark text-white fw-bold small py-3">
              <i className="bi bi-shield-lock me-2"></i>Operadores Institucionales
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle m-0 small">
                <thead className="table-light text-uppercase">
                  <tr>
                    <th className="px-3">Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th className="text-end px-3">Gestión</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-4">Cargando...</td></tr>
                  ) : (
                    usuarios.map((u) => {
                      const suspendido = !!u.banned_until;
                      return (
                        <tr key={u.id} className={suspendido ? 'table-danger bg-opacity-25' : ''}>
                          <td className="px-3 fw-semibold">{u.email}</td>
                          <td><span className={`badge ${u.user_metadata?.role === 'admin' ? 'bg-danger' : 'bg-secondary'}`}>{u.user_metadata?.role || 'USER'}</span></td>
                          <td>{suspendido ? <span className="badge bg-danger">Suspendido</span> : <span className="badge bg-success">Activo</span>}</td>
                          <td className="text-end px-3">
                            <button 
                              onClick={() => abrirModalConfirmacion(u, suspendido ? 'activar' : 'suspender')} 
                              className={`btn btn-sm py-1 px-2 me-2 fw-bold ${suspendido ? 'btn-success' : 'btn-outline-warning'}`}
                              title={suspendido ? "Reactivar acceso" : "Suspender temporalmente"}
                            >
                              <i className={`bi ${suspendido ? 'bi-play-fill' : 'bi-pause-fill'}`}></i>
                            </button>
                            <button 
                              onClick={() => abrirModalConfirmacion(u, 'eliminar')} 
                              className="btn btn-sm btn-outline-danger py-1 px-2"
                              title="Eliminar definitivamente"
                            >
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card shadow-sm border-0 bg-white">
            <div className="card-header bg-secondary text-white fw-bold small">
              <i className="bi bi-journal-text me-2"></i>Historial de Auditoría
            </div>
            <div className="card-body p-0 overflow-auto" style={{ maxHeight: '350px' }}>
              <div className="list-group list-group-flush small font-monospace">
                {logs.length === 0 ? (
                  <div className="p-3 text-muted text-center">No hay registros aún.</div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="list-group-item p-2 border-bottom">
                      <div className="d-flex justify-content-between mb-1">
                        <strong className="text-primary">{log.accion}</strong>
                        <span className="text-muted" style={{ fontSize: '10px' }}>
                          {new Date(log.creado_en).toLocaleString('es-CL')}
                        </span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{log.detalles}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- NUEVO: MODAL DE SEGURIDAD ESTILIZADO DE BOOTSTRAP 5 --- */}
      {modalConfirmar.visible && (
        <div className="modal show d-block animate__animated animate__fadeIn" tabIndex={-1} style={{ backgroundColor: 'rgba(33,37,41,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              
              <div className={`modal-header border-0 text-white ${
                modalConfirmar.tipo === 'eliminar' ? 'bg-danger' : 'bg-dark'
              }`}>
                <h5 className="modal-title fw-bold">
                  <i className={`bi me-2 ${
                    modalConfirmar.tipo === 'eliminar' ? 'bi-exclamation-octagon-fill' : 'bi-shield-exclamation'
                  }`}></i>
                  {modalConfirmar.tipo === 'eliminar' && 'Confirmación de Eliminación Crítica'}
                  {modalConfirmar.tipo === 'suspender' && 'Confirmación de Suspensión de Operador'}
                  {modalConfirmar.tipo === 'activar' && 'Confirmación de Reactivación de Cuenta'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setModalConfirmar(prev => ({ ...prev, visible: false }))}
                  disabled={procesandoAccion}
                ></button>
              </div>

              <div className="modal-body p-4">
                <p className="text-secondary small mb-3">Estás a punto de modificar el estado de la siguiente credencial del sistema:</p>
                <div className="bg-light p-3 rounded mb-3 font-monospace small border">
                  <strong>Email:</strong> {modalConfirmar.usuarioEmail} <br />
                  <strong>ID Técnico:</strong> {modalConfirmar.usuarioId}
                </div>

                {/* FLUJO CONDICIONAL SEGÚN LA ACCIÓN */}
                {modalConfirmar.tipo === 'eliminar' ? (
                  <div className="alert alert-danger p-2 px-3 small border-0 m-0">
                    <i className="bi bi-info-circle-fill me-2"></i>
                    Esta acción es irreversible y removerá al operador permanentemente.
                  </div>
                ) : modalConfirmar.tipo === 'suspender' ? (
                  <p className="small text-muted m-0">El usuario no podrá iniciar sesión ni realizar consultas en la base de datos hasta que un administrador levante el bloqueo.</p>
                ) : (
                  <p className="small text-muted m-0">Se restaurará el acceso de forma inmediata a los paneles del dashboard contractual.</p>
                )}

                {/* UX CRÍTICA: Checkbox de consentimiento antes de permitir el clic destructivo */}
                {modalConfirmar.tipo === 'eliminar' && (
                  <div className="form-check mt-3 border-top pt-3">
                    <input 
                      className="form-check-input cursor-pointer" 
                      type="checkbox" 
                      id="checkConsentimiento" 
                      checked={checkConsentimiento}
                      onChange={(e) => setCheckConsentimiento(e.target.checked)}
                    />
                    <label className="form-check-label small fw-bold text-danger cursor-pointer" htmlFor="checkConsentimiento">
                      Comprendo las consecuencias y deseo eliminar definitivamente esta cuenta.
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer border-0 bg-light py-2">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary px-3" 
                  onClick={() => setModalConfirmar(prev => ({ ...prev, visible: false }))}
                  disabled={procesandoAccion}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm fw-bold px-4 ${
                    modalConfirmar.tipo === 'eliminar' ? 'btn-danger' : 'btn-dark'
                  }`}
                  onClick={ejecutarAccionUsuario}
                  disabled={procesandoAccion || (modalConfirmar.tipo === 'eliminar' && !checkConsentimiento)}
                >
                  {procesandoAccion ? 'Procesando...' : 'Confirmar Acción'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}