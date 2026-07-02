// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  
  // Si no hay parámetro "next", enviamos al usuario a la raíz por defecto
  const next = searchParams.get('next') || '/';

  if (code) {
    const cookieStore = await cookies();

    // 1. Inicializamos el cliente de servidor usando @supabase/ssr
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              // Supabase seteará automáticamente las cookies con el formato correcto
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('Error seteando cookies en el callback:', error);
            }
          },
        },
      }
    );

    // 2. Intercambiamos el código de la URL por una sesión real
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 3. ¡Éxito! Redirigimos a la ruta protegida (ej: /dashboard/actualizar-password)
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error('Error en el intercambio de código Auth:', error.message);
    }
  }

  // Si algo falla o no hay código en la URL, se devuelve al login con un error
  return NextResponse.redirect(`${new URL(req.url).origin}/login?error=Enlace de recuperación inválido o expirado`);
}