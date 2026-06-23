import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers'; // 👈 Importamos el helper nativo de Next.js

// Inicializamos el cliente administrador con la clave secreta Service Role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '', //
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Función de validación adaptada para evitar bloqueos en localhost
async function comprobarPermisosAdmin(req: Request) {
  try {
    // 🛡️ BYPASS DE SEGURIDAD PARA DESARROLLO LOCAL:
    // Si estás en localhost, permitimos el paso para evitar que las cookies encriptadas rompan la grilla
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return true; 
    }

    // --- CÓDIGO DE VALIDACIÓN ESTRICTA PARA PRODUCCIÓN ---
    const cookieStore = await cookies();
    
    // Intentamos buscar cualquier cookie que contenga el token de autenticación de Supabase
    const todasLasCookies = cookieStore.getAll();
    const cookieAuth = todasLasCookies.find(c => c.name.includes('auth-token') || c.name.includes('access-token'));
    let token = cookieAuth ? cookieAuth.value : null;

    if (token) {
      if (token.startsWith('%5B%22')) {
        const decoded = decodeURIComponent(token);
        const parsed = JSON.parse(decoded);
        token = parsed[0]; // Extraemos el token puro
      }

      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      return user?.user_metadata?.role === 'admin';
    }

    // Alternativa por cabecera Authorization (Postman/Móviles)
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(bearerToken);
      return user?.user_metadata?.role === 'admin';
    }

    return false;
  } catch (error) {
    console.error('Error al validar permisos en el backend:', error);
    return false;
  }
}

// Handler POST: Gestionar creación, cambio de roles y reseteo de contraseñas
export async function POST(req: Request) {
  try {
    const esAdmin = await comprobarPermisosAdmin(req);
    if (!esAdmin) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { accion, email, password, userId, nuevoRol } = body;

    if (accion === 'CREAR') {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: nuevoRol || 'usuario', full_name: email.split('@')[0] }
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ mensaje: 'Usuario creado exitosamente', usuario: data.user });
    }

    if (accion === 'MODIFICAR_ROL') {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { role: nuevoRol }
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ mensaje: 'Privilegios actualizados correctamente', usuario: data.user });
    }

    if (accion === 'RESETEAR_PASSWORD') {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ mensaje: 'Contraseña restablecida con éxito' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handler GET: Listar todos los usuarios en la consola administrativa
export async function GET(req: Request) {
  try {
    const esAdmin = await comprobarPermisosAdmin(req);
    if (!esAdmin) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    
    const listaUsuarios = users.map((u) => ({
      id: u.id,
      email: u.email,
      rol: u.user_metadata?.role || 'usuario',
      ultimaConexion: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-CL') : 'Nunca'
    }));

    return NextResponse.json({ usuarios: listaUsuarios });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}