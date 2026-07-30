// app/actualizar-password/page.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Card, Form, Button } from 'react-bootstrap';

export default function ActualizarPasswordPage() {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevaPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Actualizando credenciales...');

    // 1. Actualizamos la contraseña y removemos la bandera de fuerza
    const { error } = await supabase.auth.updateUser({
      password: nuevaPassword,
      data: { force_password_change: false } // Quitamos la restricción
    });

    setLoading(false);

    if (error) {
      toast.error('Error al actualizar: ' + error.message, { id: toastId });
    } else {
      toast.success('¡Contraseña actualizada! Redirigiendo...', { id: toastId });
      // 2. Lo mandamos al dashboard
      setTimeout(() => router.push('/dashboard/trabajadores'), 1500);
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center vh-100 bg-light">
      <Toaster position="top-right" />
      <Card className="shadow-sm border-0 p-4" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-4">
          <div className="bg-warning text-dark rounded-circle d-inline-flex justify-content-center align-items-center mb-3" style={{ width: '60px', height: '60px' }}>
            <i className="bi bi-shield-lock-fill fs-2"></i>
          </div>
          <h4 className="fw-bold text-dark m-0">Actualización Obligatoria</h4>
          <p className="text-muted small mt-2">
            Por motivos de seguridad, debes cambiar la contraseña provisoria antes de acceder a la plataforma.
          </p>
        </div>

        <Form onSubmit={handleUpdate}>
          <Form.Group className="mb-4">
            <Form.Label className="small fw-bold text-secondary">Nueva Contraseña Segura</Form.Label>
            <Form.Control
              type="password"
              placeholder="••••••••"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              required
            />
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100 fw-bold" disabled={loading}>
            {loading ? 'Guardando...' : 'Establecer y Continuar'}
          </Button>
        </Form>
      </Card>
    </div>
  );
}