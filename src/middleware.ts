// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. Creamos una respuesta inicial
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Inicializamos el cliente SSR de Supabase para leer/escribir cookies de forma segura
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Actualizamos la petición actual
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          // Actualizamos la respuesta que se le enviará al navegador
          supabaseResponse = NextResponse.next({
            request,
          });
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Obtenemos el usuario de forma segura llamando a la API de Supabase
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Definimos las rutas a proteger
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/dashboard/admin'); // <-- NUEVA: Detectar la ruta web de admin
  const isApiAdminRoute = request.nextUrl.pathname.startsWith('/api/admin');     // Detectar endpoints de la API de admin

  // --- REGLAS DE PROTECCIÓN ---

  // REGLA 1: Si intenta ir al dashboard sin estar logueado, lo mandamos al login
  if (isDashboardRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // REGLA 2: Si intenta ir al login pero ya está logueado, lo mandamos al dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard/trabajadores', request.url));
  }

  // REGLA 3: RESTRICCIÓN DE ACCESO POR ROL ADMINISTRADOR (Servidor Seguro)
  const userRole = user?.user_metadata?.role; // Extraemos el rol guardado de forma segura en los metadatos

  if ((isAdminRoute || isApiAdminRoute) && userRole !== 'admin') {
    // Si es una petición a la API (Backend), respondemos con un error HTTP 403 Forbidden (Prohibido)
    if (isApiAdminRoute) {
      return NextResponse.json(
        { error: 'No autorizado — Se requieren permisos de administrador' }, 
        { status: 403 }
      );
    }
    
    // Si es un usuario común intentando entrar por URL a /dashboard/admin, lo expulsamos al listado general de trabajadores
    return NextResponse.redirect(new URL('/dashboard/trabajadores', request.url));
  }

  return supabaseResponse;
}

// Configuramos en qué rutas debe ejecutarse este middleware
export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos o públicos
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};