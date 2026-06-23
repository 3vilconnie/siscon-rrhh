'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function GuardiánInactividad({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 2 horas en milisegundos = 2 * 60 * 60 * 1000
  const TIEMPO_INACTIVIDAD = 2 * 60 * 60 * 1000; 

  const cerrarSesionPorInactividad = async () => {
    console.log('Sesión expirada por inactividad de 2 horas.');
    
    // 1. Destruir la sesión en Supabase Auth
    await supabase.auth.signOut();
    
    // 2. Redirigir al login institucional
    router.push('/login');
    router.refresh();
  };

  const reiniciarTemporizador = () => {
    // Si ya había un temporizador corriendo, lo limpiamos
    if (timerRef.current) clearTimeout(timerRef.current);

    // Creamos el nuevo temporizador de 2 horas
    timerRef.current = setTimeout(cerrarSesionPorInactividad, TIEMPO_INACTIVIDAD);
  };

  useEffect(() => {
    // Eventos del sistema operativo que determinan que el usuario está "activo"
    const eventos = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // Inicializar el primer temporizador apenas carga la app
    reiniciarTemporizador();

    // Escuchar cada interacción del usuario para resetear el reloj a 0
    eventos.forEach((evento) => {
      window.addEventListener(evento, reiniciarTemporizador);
    });

    // Limpieza al desmontar el componente
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      eventos.forEach((evento) => {
        window.removeEventListener(evento, reiniciarTemporizador);
      });
    };
  }, []);

  return <>{children}</>;
}