import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // 1. Capturar las cookies de autenticación de Supabase
  const cookieStore = request.cookies;
  const authCookie = cookieStore.getAll().find(c => c.name.includes('auth-token') || c.name.includes('access-token'));
  let token = authCookie ? authCookie.value : null;

  // 2. Si un usuario sin cookie intenta entrar a cualquier ruta del dashboard, REBOTE INMEDIATO
  if (!token) {
    url.pathname = '/login';
    url.searchParams.set('error', 'sesion-expirada');
    return NextResponse.redirect(url);
  }

  try {
    // Limpiamos el token si viene envuelto en formato de arreglo por Supabase SSR
    if (token.startsWith('%5B%22')) {
      const decoded = decodeURIComponent(token);
      const parsed = JSON.parse(decoded);
      token = parsed[0];
    }

    // 3. Inicializamos un cliente rápido para verificar la identidad real del token con Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    // Si el token es inválido, viejo o fue manipulado: REBOTE
    if (error || !user) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 4. BLOQUEO ESTRICTO DE ADMINISTRADOR:
    // Si intenta entrar a /dashboard/admin, verificamos obligatoriamente sus metadatos
    if (url.pathname.startsWith('/dashboard/admin')) {
      const rolUsuario = user.user_metadata?.role;
      if (rolUsuario !== 'admin') {
        // Si no es admin, lo expulsamos a la nómina normal con una alerta en los parámetros
        url.pathname = '/dashboard/trabajadores';
        url.searchParams.set('alerta', 'no-autorizado');
        return NextResponse.redirect(url);
      }
    }

  } catch (err) {
    console.error('Error crítico en el middleware de seguridad:', err);
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Si pasa todas las validaciones, se le permite continuar a la página
  return NextResponse.next();
}

// 5. CONFIGURACIÓN DEL FILTRO (Matcher):
// Aquí le decimos al Middleware qué rutas exactas debe proteger obligatoriamente.
// ... Todo tu código superior del middleware se mantiene exactamente igual

export const config = {
  matcher: [
    '/dashboard',       // 👈 Protege la raíz exacta (Evita la entrada a intrusos como "Invitado")
    '/dashboard/:path*' // Protege todo el árbol de carpetas internas de la nómina
  ],
};