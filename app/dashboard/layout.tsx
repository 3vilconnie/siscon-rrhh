// app/dashboard/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Spinner } from 'react-bootstrap';
import NavbarSuperior from '@/components/NavbarSuperior';
import GuardiánInactividad from '@/components/GuardianInactividad';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [nombreUsuario, setNombreUsuario] = useState<string>('Cargando...');
  const [ultimaConexion, setUltimaConexion] = useState<string>('');
  const [rolUsuario, setRolUsuario] = useState<string>('usuario');
  const [autorizando, setAutorizando] = useState<boolean>(true);

  useEffect(() => {
    let montado = true;

    async function obtenerDatosUsuario() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          if (montado) router.replace('/login');
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
      window.location.href = '/login';
    } catch (err) {
      console.error('Error al procesar el cierre seguro de sesión:', err);
    }
  };

  if (autorizando) {
    return (
      <div className="vh-100 w-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white">
        <Spinner animation="border" className="text-info mb-3" role="status" />
        <h5 className="fw-bold">Validando Credenciales Institucionales...</h5>
        <p className="text-muted small">siscon RRHH — Sistema Seguro de Control Contractual</p>
      </div>
    );
  }

  return (
    <GuardiánInactividad>
      <div className="d-flex flex-column min-vh-100 bg-light">
        {/* BARRA SUPERIOR CON NAVEGACIÓN Y USUARIO */}
        <NavbarSuperior
          nombreUsuario={nombreUsuario}
          ultimaConexion={ultimaConexion}
          rolUsuario={rolUsuario}
          onCerrarSesion={handleCerrarSesion}
        />

        {/* ÁREA DE CONTENIDO */}
        <div className="p-4 flex-grow-1 overflow-auto">
          {children}
        </div>
      </div>
    </GuardiánInactividad>
  );
}
