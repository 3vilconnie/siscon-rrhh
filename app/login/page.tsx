'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  // Controles del formulario estándar
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Controles de estados nuevos
  const [vista, setVista] = useState<'login' | 'recuperar'>('login'); // Controla qué formulario se muestra
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); // Mensaje cuando el correo se envía con éxito

  const router = useRouter();

  // Handler 1: Manejar el Inicio de Sesión Estándar
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
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
      router.refresh();
    }
  };

  // Handler 2: Manejar la Solicitud de Correo de Restablecimiento
  const handleRecuperarPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Esta es la URL a la que Supabase enviará al usuario cuando haga clic en el correo.
      // Next.js capturará ese token y le permitirá al operador cambiar la contraseña.
      redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard/actualizar-password`,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(`Error: ${error.message}`);
    } else {
      setSuccessMsg('📨 Enlace enviado. Revisa tu correo electrónico para restablecer tu contraseña.');
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
      <div className="card shadow-sm border-0 p-4" style={{ maxWidth: '400px', width: '100%' }}>
        
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
          <div className="alert alert-danger py-2 small text-center" role="alert">
            <i className="bi bi-exclamation-circle-fill me-2"></i>{errorMsg}
          </div>
        )}

        {/* Alertas de Éxito (Para cuando se manda el email) */}
        {successMsg && (
          <div className="alert alert-success py-2 small text-center" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>{successMsg}
          </div>
        )}

        {/* --- FORMULARIO VISTA: LOGIN --- */}
        {vista === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Correo Electrónico</label>
              <input
                type="email"
                className="form-control"
                placeholder="nombre@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-semibold text-secondary">Contraseña</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Enlace para ir a la sección de olvidar contraseña */}
            <div className="text-end mb-4">
              <button 
                type="button" 
                className="btn btn-link p-0 small text-decoration-none"
                style={{ fontSize: '0.82rem' }}
                onClick={() => cambiarVista('recuperar')}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button type="submit" className="btn btn-primary w-100 fw-semibold" disabled={loading}>
              {loading ? 'Autenticando...' : 'Iniciar Sesión'}
            </button>
          </form>
        ) : (
          /* --- FORMULARIO VISTA: RECUPERAR CONTRASEÑA --- */
          <form onSubmit={handleRecuperarPassword}>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary">Ingresa tu Correo Institucional</label>
              <input
                type="email"
                className="form-control"
                placeholder="nombre@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="form-text text-muted" style={{ fontSize: '0.75rem' }}>
                Te enviaremos un correo electrónico seguro con un enlace temporal para actualizar tus credenciales.
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100 fw-semibold mb-3" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
            </button>

            {/* Botón para regresar al login */}
            <div className="text-center">
              <button 
                type="button" 
                className="btn btn-link small text-decoration-none text-secondary"
                style={{ fontSize: '0.82rem' }}
                onClick={() => cambiarVista('login')}
              >
                <i className="bi bi-arrow-left me-1"></i> Volver al Inicio de Sesión
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}