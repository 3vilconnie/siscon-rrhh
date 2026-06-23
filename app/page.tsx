'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function verificarSesion() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard/trabajadores');
      } else {
        router.push('/login');
      }
    }
    verificarSesion();
  }, [router]);

  return (
    <div className="vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando siscon RRHH...</span>
      </div>
    </div>
  );
}