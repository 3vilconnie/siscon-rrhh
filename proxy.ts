// proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');

  const isAdminPageRoute = request.nextUrl.pathname.startsWith('/dashboard/admin');
  const isApiAdminRoute = request.nextUrl.pathname.startsWith('/api/admin');

  if (isDashboardRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard/trabajadores', request.url));
  }

  if (isAdminPageRoute || isApiAdminRoute) {
    // El rol vive en app_metadata: solo el service role puede escribirlo, así
    // un usuario no puede auto-asignarse "admin" desde el cliente.
    const userRole = user?.app_metadata?.role || 'user';

    if (userRole !== 'admin') {
      if (isApiAdminRoute) {
        return NextResponse.json(
          { error: 'Acceso denegado. Se requieren privilegios de administrador.' },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL('/dashboard/trabajadores', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
