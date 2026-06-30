'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // <-- Importamos usePathname
import { supabase } from '@/lib/supabase';
import NavbarSuperior from '@/components/NavbarSuperior';
import AiChatSidebar from '@/components/AiChatSidebar';
import GuardiánInactividad from '@/components/GuardianInactividad';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); // <-- Instanciamos el hook para saber la ruta actual
  
  // Estados de control de usuario e interfaz
  const [nombreUsuario, setNombreUsuario] = useState<string>('Cargando...');
  const [ultimaConexion, setUltimaConexion] = useState<string>('');
  const [rolUsuario, setRolUsuario] = useState<string>('usuario');
  const [autorizando, setAutorizando] = useState<boolean>(true); 
  
  // <-- NUEVO: Estado para colapsar/expandir el menú lateral
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    let montado = true;

    async function obtenerDatosUsuario() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          console.log("Acceso no autorizado detectado en Layout, redirigiendo...");
          if (montado) {
            router.replace('/login'); 
          }
          return;
        }

        if (user.user_metadata?.force_password_change) {
          if (montado) router.replace('/actualizar-password');
          return;
        }

        if (montado) {
          const nombre = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuario';
          setNombreUsuario(nombre);
          setRolUsuario(user.user_metadata?.role || 'usuario');

          if (user.last_sign_in_at) {
            const fecha = new Date(user.last_sign_in_at);
            setUltimaConexion(fecha.toLocaleString('es-CL', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }));
          } else {
            setUltimaConexion('No registrada');
          }
          setAutorizando(false);
        }
      } catch (err) {
        console.error('Fallo en la verificación del layout:', err);
        if (montado) router.replace('/login');
      }
    }

    obtenerDatosUsuario();
    return () => { montado = false; };
  }, [router]);

  const handleCerrarSesion = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    try {
      await supabase.auth.signOut();
      document.cookie = "sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-refresh-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      document.cookie.split(";").forEach((c) => {
        if (c.trim().startsWith("sb-")) {
          const nombreCookie = c.split("=")[0].trim();
          document.cookie = `${nombreCookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });

      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
      window.location.href = '/login';
    } catch (err) {
      console.error('Error al procesar el cierre seguro de sesión:', err);
    }
  };

  // Función auxiliar para determinar si una ruta está activa
  const checkIsActive = (path: string) => {
    // Si estamos en la raíz del dashboard, que no marque nada erróneamente
    if (path === '/dashboard' && pathname !== '/dashboard') return false;
    // Si la ruta actual incluye el path del link, lo marca activo (ej. para subrutas de trabajadores)
    return pathname.includes(path);
  };

  if (autorizando) {
    return (
      <div className="vh-100 w-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white">
        <div className="spinner-border text-info mb-3" role="status"></div>
        <h5 className="fw-bold">Validando Credenciales Institucionales...</h5>
        <p className="text-muted small">siscon RRHH — Sistema Seguro de Control Contractual</p>
      </div>
    );
  }

  // Dimensiones dinámicas de la barra
  const sidebarWidth = isCollapsed ? '80px' : '260px';

  return (
    <GuardiánInactividad>
      <div className="d-flex min-vh-100">
        
        {/* MENÚ LATERAL IZQUIERDO */}
        <div 
          className="bg-dark text-white d-flex flex-column justify-content-between shadow-lg" 
          style={{ 
            width: sidebarWidth, 
            minWidth: sidebarWidth, 
            transition: 'width 0.3s ease',
            overflow: 'hidden'
          }}
        >
          
          <div className={`p-3 ${isCollapsed ? 'px-2' : ''}`}>
            {/* Cabecera del Menú / Botón Colapsar */}
            <div className={`mb-4 pt-2 d-flex align-items-center ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`}>
              {!isCollapsed && (
                <h5 className="text-info fw-bold d-flex align-items-center gap-2 m-0 text-truncate">
                  <i className="bi bi-cpu-fill"></i> siscon RRHH
                </h5>
              )}
              <button 
                className="btn btn-sm text-white-50 hover-white p-0 border-0" 
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expandir menú" : "Ocultar menú"}
              >
                <i className={`bi fs-4 ${isCollapsed ? 'bi-list' : 'bi-text-indent-right'}`}></i>
              </button>
            </div>
            
            <ul className="nav nav-pills flex-column gap-2 mt-4">
              <li className="nav-item">
                <Link 
                  href="/dashboard/trabajadores" 
                  className={`nav-link d-flex align-items-center rounded transition-colors ${
                    checkIsActive('/dashboard/trabajadores') 
                      ? 'bg-primary text-white fw-bold shadow-sm' 
                      : 'text-white-50'
                  } ${isCollapsed ? 'justify-content-center px-0 py-3' : 'gap-3 py-2 px-3'}`}
                  title={isCollapsed ? "Lista Trabajadores" : ""}
                >
                  <i className="bi bi-people fs-5"></i> 
                  {!isCollapsed && <span>Lista Trabajadores</span>}
                </Link>
              </li>
              <li className="nav-item">
                <Link 
                  href="/dashboard/formulario" 
                  className={`nav-link d-flex align-items-center rounded transition-colors ${
                    checkIsActive('/dashboard/formulario') 
                      ? 'bg-primary text-white fw-bold shadow-sm' 
                      : 'text-white-50'
                  } ${isCollapsed ? 'justify-content-center px-0 py-3' : 'gap-3 py-2 px-3'}`}
                  title={isCollapsed ? "Registrar Personal" : ""}
                >
                  <i className="bi bi-person-plus fs-5"></i> 
                  {!isCollapsed && <span>Registrar Personal</span>}
                </Link>
              </li>
              <li className="nav-item">
                <Link 
                  href="/dashboard/carga-masiva" 
                  className={`nav-link d-flex align-items-center rounded transition-colors ${
                    checkIsActive('/dashboard/carga-masiva') 
                      ? 'bg-primary text-white fw-bold shadow-sm' 
                      : 'text-white-50'
                  } ${isCollapsed ? 'justify-content-center px-0 py-3' : 'gap-3 py-2 px-3'}`}
                  title={isCollapsed ? "Carga Masiva (SIGPER)" : ""}
                >
                  <i className="bi bi-cloud-arrow-up fs-5"></i> 
                  {!isCollapsed && <span className="text-truncate">Carga Masiva</span>}
                </Link>
              </li>

              {/* ENLACE CONDICIONAL ADMINISTRADOR */}
              {rolUsuario === 'admin' && (
                <li className="nav-item border-top border-secondary pt-3 mt-2">
                  <Link 
                    href="/dashboard/admin" 
                    className={`nav-link d-flex align-items-center rounded transition-colors ${
                      checkIsActive('/dashboard/admin') 
                        ? 'bg-warning text-dark fw-bold shadow-sm' 
                        : 'text-warning'
                    } ${isCollapsed ? 'justify-content-center px-0 py-3' : 'gap-3 py-2 px-3'}`}
                    title={isCollapsed ? "Consola Administrador" : ""}
                  >
                    <i className="bi bi-gear-fill fs-5"></i> 
                    {!isCollapsed && <span>Admin Consola</span>}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* TARJETA DE USUARIO LOGUEADO */}
          <div className="p-3 border-top border-secondary">
            {isCollapsed ? (
              // Versión Colapsada del perfil
              <div className="d-flex flex-column align-items-center gap-3">
                <div 
                  className="bg-info text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" 
                  style={{ width: '42px', height: '42px' }}
                  title={nombreUsuario}
                >
                  {nombreUsuario.substring(0, 2).toUpperCase()}
                </div>
                <button
                  onClick={handleCerrarSesion}
                  className="btn btn-outline-danger border-0 p-2 rounded-circle"
                  title="Cerrar Sesión"
                >
                  <i className="bi bi-box-arrow-left fs-5"></i>
                </button>
              </div>
            ) : (
              // Versión Expandida del perfil
              <>
                <div className="d-flex align-items-center gap-3 mb-3 bg-secondary bg-opacity-25 p-2 rounded">
                  <div className="bg-info text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: '42px', height: '42px', minWidth: '42px' }}>
                    {nombreUsuario.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden" style={{ lineHeight: '1.2' }}>
                    <div className="fw-bold text-truncate small text-white" title={nombreUsuario}>
                      {nombreUsuario}
                    </div>
                    <span className="text-info" style={{ fontSize: '11px' }}>
                      Últ. conexión:<br />
                      <span className="text-white-50">{ultimaConexion || 'Cargando...'}</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCerrarSesion}
                  className="btn btn-sm btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
                >
                  <i className="bi bi-box-arrow-left"></i> Cerrar Sesión
                </button>
              </>
            )}
          </div>

        </div>

        {/* ÁREA DE CONTENIDO */}
        <div className="flex-grow-1 d-flex flex-column bg-light" style={{ minWidth: 0, transition: 'width 0.3s ease' }}>
          <NavbarSuperior />
          <div className="p-4 flex-grow-1 overflow-auto">
            {children}
          </div>
        </div>
        
      </div>
    </GuardiánInactividad>
  );
}