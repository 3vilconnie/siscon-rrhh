// app/dashboard/layout.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Spinner } from 'react-bootstrap';
import NavbarSuperior from '@/components/NavbarSuperior';
import GuardiánInactividad from '@/components/GuardianInactividad';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [nombreUsuario, setNombreUsuario] = useState<string>('Cargando...');
  const [emailUsuario, setEmailUsuario] = useState<string>('');
  const [ultimaConexion, setUltimaConexion] = useState<string>('');
  const [rolUsuario, setRolUsuario] = useState<string>('usuario');
  const [rutAsociado, setRutAsociado] = useState<number | null>(null);
  const [autorizando, setAutorizando] = useState<boolean>(true);

  // Se expone como callback para poder recargar los datos después de que el
  // usuario edite su propio perfil desde el navbar.
  const cargarDatosUsuario = useCallback(async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace('/login');
        return;
      }

      if (user.user_metadata?.force_password_change) {
        router.replace('/actualizar-password');
        return;
      }

      const nombre =
        user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuario';
      setNombreUsuario(nombre);
      setEmailUsuario(user.email ?? '');
      setRolUsuario(user.app_metadata?.role || 'usuario');
      setRutAsociado(typeof user.app_metadata?.rut === 'number' ? user.app_metadata.rut : null);

      if (user.last_sign_in_at) {
        const fecha = new Date(user.last_sign_in_at);
        setUltimaConexion(
          fecha.toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
      } else {
        setUltimaConexion('No registrada');
      }
      setAutorizando(false);
    } catch (err) {
      console.error('Fallo en la verificación del layout:', err);
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    cargarDatosUsuario();
  }, [cargarDatosUsuario]);

  const handleCerrarSesion = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await supabase.auth.signOut();
      document.cookie = 'sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'sb-refresh-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
          emailUsuario={emailUsuario}
          ultimaConexion={ultimaConexion}
          rolUsuario={rolUsuario}
          rutAsociado={rutAsociado}
          onCerrarSesion={handleCerrarSesion}
          onPerfilActualizado={cargarDatosUsuario}
        />

        {/* ÁREA DE CONTENIDO */}
        <div className="p-4 flex-grow-1 overflow-auto">{children}</div>
      </div>
    </GuardiánInactividad>
  );
}
