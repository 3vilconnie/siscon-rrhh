'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Asegúrate de importar tu cliente estándar de supabase
import { useRouter } from 'next/navigation';

interface UsuarioAdmin {
  id: string;
  email: string;
  rol: string;
  ultimaConexion: string;
}

export default function ModuloAdministradorPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false); // Estado para validar el acceso
  
  // Estados para el formulario de creación
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState('usuario');

  // Mensajes de feedback
  const [statusMsg, setStatusMsg] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    const verificarPermisosYContratos = async () => {
      setLoading(true);
      try {
        // 1. Obtener el usuario autenticado actualmente
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/login'); // Si no hay sesión, al login
          return;
        }

        // 2. Evaluar el rol guardado en los metadatos
        const rolUsuario = user.user_metadata?.role;

        if (rolUsuario !== 'admin') {
          // ❌ NO ES ADMIN: Lo sacamos expulsado a la nómina general
          alert('🚫 Acceso denegado: No posee privilegios de Administrador para ver esta sección.');
          router.push('/dashboard/trabajadores');
          return;
        }

        // ✅ ES ADMIN: Permitimos renderizar la vista y cargamos la tabla
        setAutorizado(true);
        await cargarUsuarios();
      } catch (err) {
        console.error('Error de autenticación:', err);
        router.push('/dashboard/trabajadores');
      } finally {
        setLoading(false);
      }
    };

    verificarPermisosYContratos();
  }, [router]);

  const cargarUsuarios = async () => {
    try {
      const res = await fetch('/api/admin/usuarios');
      const data = await res.json();
      if (data.usuarios) setUsuarios(data.usuarios);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEmail || !nuevoPassword) return;

    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'CREAR',
          email: nuevoEmail,
          password: nuevoPassword,
          nuevoRol: nuevoRol
        })
      });
      const data = await res.json();
      if (data.error) {
        setStatusMsg({ tipo: 'danger', texto: `Error: ${data.error}` });
      } else {
        setStatusMsg({ tipo: 'success', texto: '¡Usuario creado con éxito en el sistema Auth!' });
        setNuevoEmail('');
        setNuevoPassword('');
        cargarUsuarios();
      }
    } catch (err) {
      setStatusMsg({ tipo: 'danger', texto: 'Error de conexión con la API Admin' });
    }
  };

  const cambiarRol = async (userId: string, rolActual: string) => {
    const elSiguienteRol = rolActual === 'admin' ? 'usuario' : 'admin';
    if (!confirm(`¿Desea cambiar los privilegios del usuario a [${elSiguienteRol.toUpperCase()}]?`)) return;

    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'MODIFICAR_ROL', userId, nuevoRol: elSiguienteRol })
      });
      const data = await res.json();
      if (!data.error) {
        setStatusMsg({ tipo: 'success', texto: 'Privilegios actualizados correctamente.' });
        cargarUsuarios();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const restablecerPassword = async (userId: string, email: string) => {
    const passNueva = prompt(`Ingrese la nueva contraseña provisoria para ${email}:`);
    if (!passNueva || passNueva.trim().length < 6) {
      if (passNueva) alert('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'RESETEAR_PASSWORD', userId, password: passNueva })
      });
      const data = await res.json();
      if (!data.error) {
        alert(`🔑 Contraseña de ${email} cambiada exitosamente a: ${passNueva}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mientras valida los roles, mostramos pantalla de carga preventiva para evitar parpadeos
  if (loading || !autorizado) {
    return <div className="p-4 text-muted">Verificando credenciales de seguridad administrativa...</div>;
  }

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h2 className="fw-bold text-dark m-0">⚙️ Consola de Administración</h2>
        <p className="text-muted small">Gestión centralizada de credenciales, roles y accesos institucionales.</p>
      </div>

      {statusMsg.texto && (
        <div className={`alert alert-${statusMsg.tipo} alert-dismissible fade show small`} role="alert">
          {statusMsg.texto}
          <button type="button" className="btn-close" onClick={() => setStatusMsg({ tipo: '', texto: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        {/* FORMULARIO DE CREACIÓN */}
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 bg-white p-3">
            <h5 className="fw-bold text-secondary mb-3">Registrar Nuevo Operador</h5>
            <form onSubmit={handleCrearUsuario} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small text-muted fw-bold mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  className="form-control form-control-sm" 
                  placeholder="ejemplo@conaf.cl"
                  value={nuevoEmail} 
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label className="form-label small text-muted fw-bold mb-1">Contraseña Inicial</label>
                <input 
                  type="password" 
                  className="form-control form-control-sm" 
                  placeholder="Mínimo 6 caracteres"
                  value={nuevoPassword} 
                  onChange={(e) => setNuevoPassword(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label className="form-label small text-muted fw-bold mb-1">Asignar Rol Inicial</label>
                <select 
                  className="form-select form-select-sm"
                  value={nuevoRol} 
                  onChange={(e) => setNuevoRol(e.target.value)}
                >
                  <option value="usuario">Usuario Estándar (Consultas)</option>
                  <option value="admin">Administrador (Control Total)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-sm btn-dark fw-bold mt-2 py-2">
                <i className="bi bi-person-plus-fill me-1"></i> Crear Cuenta Activa
              </button>
            </form>
          </div>
        </div>

        {/* TABLA DE USUARIOS */}
        <div className="col-12 col-md-8">
          <div className="card shadow-sm border-0 bg-white overflow-hidden">
            <div className="card-header bg-dark text-white fw-bold small py-3">
              Cuentas de Usuarios Registradas
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle m-0 small">
                <thead className="table-light text-uppercase" style={{ fontSize: '11px' }}>
                  <tr>
                    <th className="px-3">Email Institucional</th>
                    <th>Privilegio / Rol</th>
                    <th>Última Actividad</th>
                    <th className="text-end px-3">Gestión de Cuenta</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted">No hay otros usuarios registrados</td>
                    </tr>
                  ) : (
                    usuarios.map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 fw-semibold text-dark">{u.email}</td>
                        <td>
                          <button 
                            onClick={() => cambiarRol(u.id, u.rol)}
                            className={`badge border-0 p-2 text-white ${u.rol === 'admin' ? 'bg-danger' : 'bg-secondary'}`}
                            title="Haga clic para alternar el rol"
                            style={{ cursor: 'pointer' }}
                          >
                            <i className="bi bi-shield-lock-fill me-1"></i>
                            {u.rol.toUpperCase()}
                          </button>
                        </td>
                        <td className="text-muted">{u.ultimaConexion}</td>
                        <td className="text-end px-3">
                          <button 
                            onClick={() => restablecerPassword(u.id, u.email)}
                            className="btn btn-xs btn-outline-warning py-1 px-2 fw-semibold"
                            style={{ fontSize: '11px' }}
                          >
                            <i className="bi bi-key-fill me-1"></i> Reset Pass
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}