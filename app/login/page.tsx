'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';

export default function LoginPage() {
  const router = useRouter();

  // Controles del formulario estándar
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Controles de estados nuevos
  const [vista, setVista] = useState<'login' | 'recuperar'>('login'); // Controla qué formulario se muestra
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); // Mensaje cuando el correo se envía con éxito

  // Handler 1: Manejar el Inicio de Sesión Estándar
  const handleLogin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg('Credenciales inválidas. Inténtalo de nuevo.');
      setLoading(false);
    } else {
      router.push('/dashboard/trabajadores');
    }
  };

  // Handler 2: Manejar la Solicitud de Correo de Restablecimiento
  const handleRecuperarPassword = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/actualizar-password`,
    });

    setLoading(false);

    if (error) {
      setErrorMsg('No se pudo enviar el enlace. Intenta nuevamente en unos minutos.');
    } else {
      setSuccessMsg(
        '📨 Enlace enviado. Revisa tu correo electrónico para restablecer tu contraseña.',
      );
    }
  };

  // Función para alternar vistas limpiando alertas previas
  const cambiarVista = (nuevaVista: 'login' | 'recuperar') => {
    setErrorMsg('');
    setSuccessMsg('');
    setVista(nuevaVista);
  };

  return (
    <div className="container d-flex align-items-center justify-content-center vh-100 bg-light">
      <Card className="shadow-sm border-0 p-4" style={{ maxWidth: '400px', width: '100%' }}>
        {/* Encabezado Común */}
        <div className="text-center mb-4">
          <h2 className="fw-bold text-primary m-0">
            <i className="bi bi-sliders me-2"></i>siscon RRHH
          </h2>
          <p className="text-muted small mt-1">
            {vista === 'login' ? 'Ingresa al panel de control' : 'Recuperación de credenciales'}
          </p>
        </div>

        {/* Alertas de Error */}
        {errorMsg && (
          <Alert variant="danger" className="py-2 small text-center">
            <i className="bi bi-exclamation-circle-fill me-2"></i>
            {errorMsg}
          </Alert>
        )}

        {/* Alertas de Éxito (Para cuando se manda el email) */}
        {successMsg && (
          <Alert variant="success" className="py-2 small text-center">
            <i className="bi bi-check-circle-fill me-2"></i>
            {successMsg}
          </Alert>
        )}

        {/* --- FORMULARIO VISTA: LOGIN --- */}
        {vista === 'login' ? (
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold text-secondary">
                Correo Electrónico
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="nombre@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold text-secondary">Contraseña</Form.Label>
              <InputGroup>
                <Form.Control
                  type={mostrarPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  <i className={`bi ${mostrarPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Enlace para ir a la sección de olvidar contraseña */}
            <div className="text-end mb-4">
              <Button
                type="button"
                variant="link"
                className="p-0 small text-decoration-none"
                style={{ fontSize: '0.82rem' }}
                onClick={() => cambiarVista('recuperar')}
              >
                ¿Olvidaste tu contraseña?
              </Button>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-100 fw-semibold"
              disabled={loading}
            >
              {loading ? 'Autenticando...' : 'Iniciar Sesión'}
            </Button>
          </Form>
        ) : (
          /* --- FORMULARIO VISTA: RECUPERAR CONTRASEÑA --- */
          <Form onSubmit={handleRecuperarPassword}>
            <Form.Group className="mb-4">
              <Form.Label className="small fw-semibold text-secondary">
                Ingresa tu Correo Institucional
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="nombre@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Form.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
                Te enviaremos un correo electrónico seguro con un enlace temporal para actualizar
                tus credenciales.
              </Form.Text>
            </Form.Group>

            <Button
              type="submit"
              variant="primary"
              className="w-100 fw-semibold mb-3"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
            </Button>

            {/* Botón para regresar al login */}
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                className="small text-decoration-none text-secondary"
                style={{ fontSize: '0.82rem' }}
                onClick={() => cambiarVista('login')}
              >
                <i className="bi bi-arrow-left me-1"></i> Volver al Inicio de Sesión
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
}
