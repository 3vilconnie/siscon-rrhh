import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const { searchParams, origin } = new URL(req.url);
    // Supabase envía un parámetro '?code=...' en el flujo PKCE seguro
    const code = searchParams.get('code');
    const next = searchParams.get('next') || '/dashboard/trabajadores';

    if (code) {
      // 1. Inicializamos el cliente oficial de Supabase
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      // 2. Intercambiamos el código de la URL por una sesión real
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        const response = NextResponse.redirect(`${origin}${next}`);

        // 3. Opcional: Si manejas almacenamiento manual de cookies en tu Server Router, 
        // inyectamos los tokens de forma segura con propiedades HttpOnly / Secure
        const cookieStore = await cookies();
        cookieStore.set('sb-access-token', data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: data.session.expires_in,
          path: '/',
        });

        return response;
      } else if (error) {
        console.error('Error en el intercambio de código Auth:', error.message);
      }
    }
  } catch (err) {
    console.error('Fallo crítico en el callback de autenticación:', err);
  }

  // Si algo falla o no hay código válido, redirige al login con bandera de error
  return NextResponse.redirect(`${new URL(req.url).origin}/login?error=callback-failed`);
}