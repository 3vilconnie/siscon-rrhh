// app/api/admin/usuarios/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializamos el cliente de Supabase con permisos de Service Role (Admin)
// NUNCA expongas la SUPABASE_SERVICE_ROLE_KEY en el cliente
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OBTENER LISTA DE USUARIOS
export async function GET() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) throw error;
    
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// app/api/admin/usuarios/route.ts

// CREAR NUEVO USUARIO (Vía Invitación Segura)
export async function POST(request: Request) {
  try {
    const { email, role } = await request.json();

    // Utilizamos inviteUserByEmail en lugar de createUser
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { 
        role: role || 'usuario',
        force_password_change: true // Mantenemos la bandera para obligarlo a cambiar la clave
      }
      // Opcional: redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/actualizar-password`
    });

    if (error) throw error;

    // Registrar en Auditoría
    await supabaseAdmin.from('auditoria').insert({
      actor: 'Administrador', 
      accion: 'INVITAR_USUARIO',
      detalles: `Se envió invitación de acceso al correo: ${email} con rol ${role}`
    });

    return NextResponse.json({ 
      message: 'Invitación enviada exitosamente', 
      user: data.user
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ACTUALIZAR ESTADO O ROL
export async function PATCH(request: Request) {
  try {
    const { id, accion, role, password } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    let updateData: any = {};
    let detalleAccion = '';

    if (accion === 'suspender') {
      updateData.ban_duration = '87600h';
      detalleAccion = `Se suspendió el acceso al ID: ${id}`;
    } else if (accion === 'activar') {
      updateData.ban_duration = 'none';
      detalleAccion = `Se reactivó el acceso al ID: ${id}`;
    }

    if (role) {
      updateData.user_metadata = { role };
      detalleAccion = `Se cambió el rol del ID: ${id} a ${role}`;
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);
    if (error) throw error;

    // 🔴 NUEVO: Registrar en Auditoría
    await supabaseAdmin.from('auditoria').insert({
      actor: 'Administrador',
      accion: accion ? accion.toUpperCase() : 'MODIFICAR_USUARIO',
      detalles: detalleAccion
    });

    return NextResponse.json({ message: 'Actualizado exitosamente', user: data.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ELIMINAR USUARIO
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    // 🔴 NUEVO: Registrar en Auditoría
    await supabaseAdmin.from('auditoria').insert({
      actor: 'Administrador',
      accion: 'ELIMINAR_USUARIO',
      detalles: `Se eliminó definitivamente el usuario con ID: ${id}`
    });

    return NextResponse.json({ message: 'Usuario eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}