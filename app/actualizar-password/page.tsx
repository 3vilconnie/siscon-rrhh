// app/actualizar-password/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { Card, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import type { EmailOtpType, User } from '@supabase/supabase-js';

type Estado = 'verificando' | 'sin_sesion' | 'listo';

export default function ActualizarPasswordPage() {
  const [estado, setEstado] = useState<Estado>('verificando');
  const [esObligatorio, setEsObligatorio] = useState(false);
  const [mensajeError, setMensajeError] = useState('');

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Los enlaces de correo llegan en tres formatos distintos según el flujo:
  //  · recuperación (PKCE): la sesión ya viene establecida por /api/auth/callback
  //  · invitación: la sesión viene en el fragmento (#access_token=...), que
  //    supabase-js procesa de forma asíncrona al cargar la página
  //  · plantillas con token_hash: hay que canjearlo con verifyOtp
  // Se contemplan los tres para no rechazar un enlace válido.
  useEffect(() => {
    let activo = true;

    const marcarListo = (user: User) => {
      if (!activo) return;
      setEsObligatorio(!!user.user_metadata?.force_password_change);
      setEstado('listo');
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session?.user) marcarListo(session.user);
    });

    const iniciar = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      // Supabase informa los errores por query o por fragmento según el caso.
      const descripcionError = query.get('error_description') ?? hash.get('error_description');
      if (descripcionError) {
        if (activo) {
          setMensajeError(descripcionError);
          setEstado('sin_sesion');
        }
        return;
      }

      const tokenHash = query.get('token_hash');
      const tipo = query.get('type');
      if (tokenHash && tipo) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tipo as EmailOtpType,
        });
        if (!activo) return;
        if (error || !data.user) {
          setMensajeError(error?.message ?? '');
          setEstado('sin_sesion');
          return;
        }
        marcarListo(data.user);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) marcarListo(session.user);
      // Si aún no hay sesión, puede estar procesándose el fragmento: lo resuelve
      // onAuthStateChange, o el temporizador de abajo si el enlace no era válido.
    };

    iniciar();

    const tiempoLimite = setTimeout(() => {
      if (activo) setEstado((prev) => (prev === 'verificando' ? 'sin_sesion' : prev));
    }, 5000);

    return () => {
      activo = false;
      clearTimeout(tiempoLimite);
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nuevaPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Actualizando credenciales...');

    const { error } = await supabase.auth.updateUser({
      password: nuevaPassword,
      data: { force_password_change: false },
    });

    setLoading(false);

    if (error) {
      toast.error('Error al actualizar: ' + error.message, { id: toastId });
    } else {
      toast.success('¡Contraseña actualizada! Redirigiendo...', { id: toastId });
      setTimeout(() => router.push('/dashboard/trabajadores'), 1500);
    }
  };

  if (estado === 'verificando') {
    return (
      <div className="container d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center text-muted">
          <Spinner animation="border" size="sm" className="me-2" />
          Verificando enlace...
        </div>
      </div>
    );
  }

  if (estado === 'sin_sesion') {
    return (
      <div className="container d-flex align-items-center justify-content-center vh-100 bg-light">
        <Card className="shadow-sm border-0 p-4 text-center" style={{ maxWidth: '400px', width: '100%' }}>
          <div
            className="bg-danger-subtle text-danger rounded-circle d-inline-flex justify-content-center align-items-center mb-3 mx-auto"
            style={{ width: '60px', height: '60px' }}
          >
            <i className="bi bi-link-45deg fs-2"></i>
          </div>
          <h4 className="fw-bold text-dark m-0">Enlace inválido o expirado</h4>
          <p className="text-muted small mt-2">
            El enlace ya no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.
          </p>
          {mensajeError && (
            <p className="text-muted small fst-italic border-top pt-2 mt-2 mb-2">
              Detalle: {mensajeError}
            </p>
          )}
          <Link href="/login" className="btn btn-primary fw-semibold mt-2">
            Volver a Iniciar Sesión
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container d-flex align-items-center justify-content-center vh-100 bg-light">
      <Toaster position="top-right" />
      <Card className="shadow-sm border-0 p-4" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-4">
          <div
            className={`rounded-circle d-inline-flex justify-content-center align-items-center mb-3 ${
              esObligatorio ? 'bg-warning text-dark' : 'bg-primary-subtle text-primary'
            }`}
            style={{ width: '60px', height: '60px' }}
          >
            <i className="bi bi-shield-lock-fill fs-2"></i>
          </div>
          <h4 className="fw-bold text-dark m-0">
            {esObligatorio ? 'Actualización Obligatoria' : 'Restablece tu Contraseña'}
          </h4>
          <p className="text-muted small mt-2">
            {esObligatorio
              ? 'Por motivos de seguridad, debes cambiar la contraseña provisoria antes de acceder a la plataforma.'
              : 'Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.'}
          </p>
        </div>

        <Form onSubmit={handleUpdate}>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold text-secondary">Nueva Contraseña</Form.Label>
            <InputGroup>
              <Form.Control
                type={mostrarPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                required
                minLength={8}
              />
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                tabIndex={-1}
              >
                <i className={`bi ${mostrarPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </Button>
            </InputGroup>
            <Form.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
              Mínimo 8 caracteres.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="small fw-bold text-secondary">Confirmar Contraseña</Form.Label>
            <InputGroup>
              <Form.Control
                type={mostrarPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
                minLength={8}
              />
            </InputGroup>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100 fw-bold" disabled={loading}>
            {loading ? 'Guardando...' : 'Establecer y Continuar'}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
