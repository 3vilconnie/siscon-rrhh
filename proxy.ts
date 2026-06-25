// proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 🚨 Fíjate que aquí ahora dice "proxy" en lugar de "middleware"
export async function proxy(request: NextRequest) {
  // 1. Creamos una respuesta inicial
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Inicializamos el cliente SSR de Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
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

  // 3. Obtenemos el usuario de forma segura
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Definimos las rutas a proteger
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  
  // 🔒 RUTAS CRÍTICAS DE ADMINISTRACIÓN
  const isAdminPageRoute = request.nextUrl.pathname.startsWith('/dashboard/admin');
  const isApiAdminRoute = request.nextUrl.pathname.startsWith('/api/admin');

  // --- REGLAS DE PROTECCIÓN ---

  // Si intenta ir al dashboard sin estar logueado, lo mandamos al login
  if (isDashboardRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si intenta ir al login pero ya está logueado, lo mandamos al dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard/trabajadores', request.url));
  }

  // 🛡️ Verificación de Rol para Rutas de Administración
  if (isAdminPageRoute || isApiAdminRoute) {
    // Obtenemos el rol de los metadatos. Si no existe, asumimos que es 'user'
    const userRole = user?.user_metadata?.role || 'user';

    // Si el usuario NO es admin, le bloqueamos el paso
    if (userRole !== 'admin') {
      if (isApiAdminRoute) {
        return NextResponse.json(
          { error: 'Acceso denegado. Se requieren privilegios de administrador.' }, 
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/dashboard/trabajadores', request.url));
    }
  }

  return supabaseResponse;
}

// El objeto config se mantiene exactamente igual
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};