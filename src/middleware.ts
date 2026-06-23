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
  // Esto no solo lee la cookie, sino que verifica que sea válida en el servidor
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Definimos las rutas a proteger
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isApiAdminRoute = request.nextUrl.pathname.startsWith('/api/admin');

  // --- REGLAS DE PROTECCIÓN ---

  // Si intenta ir al dashboard sin estar logueado, lo mandamos al login
  if (isDashboardRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si intenta ir al login pero ya está logueado, lo mandamos al dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // (Opcional pero recomendado) Proteger las rutas de API de administración en el Middleware
  if (isApiAdminRoute && !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  return supabaseResponse;
}

// Configuramos en qué rutas debe ejecutarse este middleware
export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto:
     * - _next/static (archivos estáticos de Next.js)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (ícono del sitio)
     * - archivos con extensiones públicas (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};