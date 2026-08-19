// app/api/admin/usuarios/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Email del administrador autenticado (para la auditoría). */
async function obtenerActor(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.email ?? 'Administrador';
  } catch {
    return 'Administrador';
  }
}

export async function GET() {
  try {
    const {
      data: { users },
      error,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (error) throw error;

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, role } = await request.json();
    // El enlace apunta directo a la página cliente, NO a /api/auth/callback:
    // inviteUserByEmail no admite PKCE (el navegador que invita suele no ser el
    // que acepta), así que Supabase devuelve la sesión en el fragmento de la URL
    // (#access_token=...), que nunca se envía al servidor. Solo el cliente puede
    // leerlo; supabase-js lo procesa solo al cargar la página.
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { force_password_change: true },
      redirectTo: `${new URL(request.url).origin}/actualizar-password`,
    });

    if (error) throw error;

    if (data.user) {
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { role: role || 'usuario' },
      });
    }

    // Registrar en Auditoría
    await supabaseAdmin.from('auditoria').insert({
      actor: await obtenerActor(),
      accion: 'INVITAR_USUARIO',
      detalles: `Se envió invitación de acceso al correo: ${email} con rol ${role}`,
    });

    return NextResponse.json({
      message: 'Invitación enviada exitosamente',
      user: data.user,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ACTUALIZAR ESTADO, ROL, CORREO, NOMBRE O RUT ASOCIADO
export async function PATCH(request: Request) {
  try {
    const { id, accion, role, email, fullName, rut } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Se parte del usuario actual para hacer merge de la metadata: asignar solo
    // { role } borraría el rut ya guardado (y viceversa).
    const { data: actual, error: errActual } = await supabaseAdmin.auth.admin.getUserById(id);
    if (errActual) throw errActual;
    if (!actual.user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const appMetadata: Record<string, unknown> = { ...(actual.user.app_metadata ?? {}) };
    const userMetadata: Record<string, unknown> = { ...(actual.user.user_metadata ?? {}) };
    const cambios: string[] = [];

    if (accion === 'suspender') {
      updateData.ban_duration = '87600h';
      cambios.push('acceso suspendido');
    } else if (accion === 'activar') {
      updateData.ban_duration = 'none';
      cambios.push('acceso reactivado');
    }

    if (role) {
      appMetadata.role = role;
      cambios.push(`rol → ${role}`);
    }

    if (email && email !== actual.user.email) {
      updateData.email = email;
      cambios.push(`correo → ${email}`);
    }

    if (fullName !== undefined) {
      userMetadata.full_name = fullName || null;
      cambios.push(`nombre → ${fullName || '(sin nombre)'}`);
    }

    // RUT asociado al trabajador. null/'' desasocia; si viene un valor, debe
    // existir en "trabajadores" y no estar tomado por otro usuario.
    if (rut !== undefined) {
      if (rut === null || rut === '') {
        delete appMetadata.rut;
        cambios.push('trabajador desasociado');
      } else {
        const rutNumero = parseInt(String(rut).replace(/\D/g, ''), 10);
        if (!rutNumero) {
          return NextResponse.json({ error: 'El RUT ingresado no es válido.' }, { status: 400 });
        }

        const { data: trabajador, error: errTrab } = await supabaseAdmin
          .from('trabajadores')
          .select('rut, dv, nombres, primer_apellido, segundo_apellido')
          .eq('rut', rutNumero)
          .maybeSingle();
        if (errTrab) throw errTrab;
        if (!trabajador) {
          return NextResponse.json(
            { error: `No existe un trabajador registrado con el RUT ${rutNumero}.` },
            { status: 400 },
          );
        }

        // Unicidad: ningún otro usuario puede tener asignado el mismo RUT.
        // listUsers() pagina de a 50 por defecto; suficiente para la cantidad de
        // usuarios de esta institución. Si creciera, habría que paginar aquí.
        const { data: listado, error: errLista } = await supabaseAdmin.auth.admin.listUsers();
        if (errLista) throw errLista;
        const ocupado = listado.users.find(
          (u) => u.id !== id && u.app_metadata?.rut === rutNumero,
        );
        if (ocupado) {
          return NextResponse.json(
            { error: `Ese RUT ya está asociado al usuario ${ocupado.email}.` },
            { status: 400 },
          );
        }

        appMetadata.rut = rutNumero;
        cambios.push(
          `trabajador → ${trabajador.nombres} ${trabajador.primer_apellido} (${rutNumero})`,
        );
      }
    }

    updateData.app_metadata = appMetadata;
    updateData.user_metadata = userMetadata;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);
    if (error) throw error;

    await supabaseAdmin.from('auditoria').insert({
      actor: await obtenerActor(),
      accion: accion ? accion.toUpperCase() : 'MODIFICAR_USUARIO',
      detalles: `Usuario ${actual.user.email}: ${cambios.join(', ') || 'sin cambios'}`,
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

    await supabaseAdmin.from('auditoria').insert({
      actor: await obtenerActor(),
      accion: 'ELIMINAR_USUARIO',
      detalles: `Se eliminó definitivamente el usuario con ID: ${id}`,
    });

    return NextResponse.json({ message: 'Usuario eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
