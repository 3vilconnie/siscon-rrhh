'use client';
import { useState, useEffect } from 'react'; // 👈 Corregido con ambas importaciones nativas
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import NavbarSuperior from '../../components/NavbarSuperior';
import AiChatSidebar from '../../components/AiChatSidebar';
import GuardiánInactividad from '../../components/GuardianInactividad';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  // Estados de control de usuario e interfaz
  const [nombreUsuario, setNombreUsuario] = useState<string>('Cargando...');
  const [ultimaConexion, setUltimaConexion] = useState<string>('');
  const [rolUsuario, setRolUsuario] = useState<string>('usuario');
  const [autorizando, setAutorizando] = useState<boolean>(true); // Cortina de protección visual

  useEffect(() => {
    let montado = true;

    async function obtenerDatosUsuario() {
      try {
        // 1. Validar la sesión real contra los servidores de Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser();

        // 🚨 CONTROL CRÍTICO: Si hay error o no hay usuario, expulsión inmediata sin excepciones
        if (error || !user) {
          console.log("Acceso no autorizado detectado en Layout, redirigiendo...");
          if (montado) {
            setNombreUsuario('Invitado');
            router.replace('/login'); // Redirección limpia destruyendo el historial temporal
          }
          return;
        }

        // Si el usuario existe y está validado por el servidor:
        if (montado) {
          const nombre = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuario';
          setNombreUsuario(nombre);

          const rol = user.user_metadata?.role || 'usuario';
          setRolUsuario(rol);

          if (user.last_sign_in_at) {
            const fecha = new Date(user.last_sign_in_at);
            setUltimaConexion(fecha.toLocaleString('es-CL', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }));
          } else {
            setUltimaConexion('No registrada');
          }

          // Desactivamos la cortina de carga: es un operador válido
          setAutorizando(false);
        }

      } catch (err) {
        console.error('Fallo en la verificación del layout:', err);
        if (montado) {
          router.replace('/login');
        }
      }
    }

    obtenerDatosUsuario();

    // Limpieza al desmontar el componente para evitar fugas de memoria
    return () => {
      montado = false;
    };
  }, [router]);

  // 🛡️ FUNCIÓN DE CIERRE DE SESIÓN SEGURO Y DESTRUCCIÓN DE COOKIES
  const handleCerrarSesion = async (e: React.MouseEvent) => {
    e.preventDefault(); // Evitamos que el navegador procese la etiqueta como enlace directo
    
    try {
      // 1. Notificar salida a Supabase
      await supabase.auth.signOut();

      // 2. Destruir físicamente los tokens del navegador expirándolos al año 1970
      document.cookie = "sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-refresh-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Limpieza iterativa para cualquier cookie residual con prefijo "sb-" de Supabase SSR
      document.cookie.split(";").forEach((c) => {
        if (c.trim().startsWith("sb-")) {
          const nombreCookie = c.split("=")[0].trim();
          document.cookie = `${nombreCookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });

      // 3. Purgar almacenamiento local del cliente
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');

      // 4. Redirección dura forzando la recarga completa para romper la memoria de React
      window.location.href = '/login';
    } catch (err) {
      console.error('Error al procesar el cierre seguro de sesión:', err);
    }
  };

  // CORTINA DE PROTECCIÓN INMEDIATA ANTI-INVITADOS:
  if (autorizando) {
    return (
      <div className="vh-100 w-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white">
        <div className="spinner-border text-info mb-3" role="status"></div>
        <h5 className="fw-bold">Validando Credenciales Institucionales...</h5>
        <p className="text-muted small">siscon RRHH — Sistema Seguro de Control Contractual</p>
      </div>
    );
  }

  return (
    <GuardiánInactividad>
      <div className="d-flex min-vh-100">
        
        {/* MENÚ LATERAL IZQUIERDO */}
        <div className="bg-dark text-white p-3 d-flex flex-column justify-content-between" style={{ width: '260px', minWidth: '260px' }}>
          
          <div>
            <div className="mb-4 pt-2">
              <h4 className="text-info fw-bold d-flex align-items-center gap-2 m-0">
                <i className="bi bi-cpu-fill"></i> siscon RRHH
              </h4>
            </div>
            
            <ul className="nav nav-pills flex-column gap-2">
              <li className="nav-item">
                <Link href="/dashboard/trabajadores" className="nav-link text-white d-flex align-items-center gap-2 py-2">
                  <i className="bi bi-people"></i> Lista Trabajadores
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/dashboard/formulario" className="nav-link text-white d-flex align-items-center gap-2 py-2">
                  <i className="bi bi-person-plus"></i> Registrar Personal
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/dashboard/carga-masiva" className="nav-link text-white d-flex align-items-center gap-2 py-2">
                  <i className="bi bi-cloud-arrow-up"></i> Carga Masiva (SIGPER)
                </Link>
              </li>

              {/* ENLACE CONDICIONAL ADMINISTRADOR */}
              {rolUsuario === 'admin' && (
                <li className="nav-item border-top border-secondary pt-2 mt-2">
                  <Link href="/dashboard/admin" className="nav-link text-warning d-flex align-items-center gap-2 py-2 fw-semibold">
                    <i className="bi bi-gear-fill"></i> Consola Administrador
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* TARJETA DE USUARIO LOGUEADO */}
          <div className="pt-3 border-top">
            <div className="d-flex align-items-center gap-2 mb-3 bg-secondary bg-opacity-25 p-2 rounded">
              <div className="bg-info text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '38px', height: '38px', minWidth: '38px' }}>
                {nombreUsuario.substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden" style={{ lineHeight: '1.2' }}>
                <div className="fw-bold text-truncate small" title={nombreUsuario}>
                  {nombreUsuario}
                </div>
                <span className="text-info" style={{ fontSize: '10px' }}>
                  Últ. conexión:<br />
                  <span className="text-info">{ultimaConexion || 'Cargando...'}</span>
                </span>
              </div>
            </div>

            <button
              onClick={handleCerrarSesion}
              className="btn btn-sm btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
            >
              <i className="bi bi-box-arrow-left"></i> Cerrar Sesión
            </button>
          </div>

        </div>

        {/* ÁREA DE CONTENIDO */}
        <div className="flex-grow-1 d-flex flex-column bg-light" style={{ minWidth: 0 }}>
          <NavbarSuperior />
          <div className="p-4 flex-grow-1">
            {children}
          </div>
        </div>

        <AiChatSidebar />
        
      </div>
    </GuardiánInactividad>
  );
}