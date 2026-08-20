// app/api/admin/importar-personales/route.ts
// Importa datos personales de trabajadores desde una planilla Excel.
//
// Modifica datos maestros de 300+ trabajadores, así que vive bajo /api/admin/*
// (proxy.ts exige rol admin ahí) y usa service role. Siempre se puede pedir
// primero una SIMULACIÓN: sin `aplicar=true` no escribe nada y solo devuelve el
// detalle de lo que cambiaría, para revisarlo antes de confirmar.
//
// Por defecto solo RELLENA campos vacíos. Sobrescribir un dato que ya está en
// la base requiere marcarlo explícitamente, porque la planilla no es
// necesariamente más confiable que la base.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import {
  interpretarFilas,
  CAMPOS_TRABAJADOR,
  type CampoTrabajador,
} from '@/lib/importarPersonales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface CambioCampo {
  campo: CampoTrabajador;
  antes: string;
  despues: string;
}

interface ResumenTrabajador {
  rut: number;
  nombre: string;
  cambios: CambioCampo[];
  programa?: string;
}

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

function vacio(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const archivo = form.get('archivo');
    const hojaPedida = String(form.get('hoja') ?? '').trim();
    const sobrescribir = form.get('sobrescribir') === 'true';
    const aplicar = form.get('aplicar') === 'true';

    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'Adjunta la planilla.' }, { status: 400 });
    }

    const libro = XLSX.read(Buffer.from(await archivo.arrayBuffer()), { type: 'buffer' });
    const hoja = hojaPedida || libro.SheetNames[0];
    if (!libro.Sheets[hoja]) {
      return NextResponse.json(
        { error: `La planilla no tiene una hoja llamada "${hoja}".`, hojas: libro.SheetNames },
        { status: 400 },
      );
    }

    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[hoja], {
      defval: '',
    });
    const { cambios, errores } = interpretarFilas(filas);

    if (cambios.length === 0) {
      return NextResponse.json(
        { error: 'No se encontró ninguna fila con RUT válido.', errores, hojas: libro.SheetNames },
        { status: 400 },
      );
    }

    // Estado actual de esos trabajadores.
    const ruts = cambios.map((c) => c.rut);
    const { data: existentes, error: errLectura } = await supabaseAdmin
      .from('trabajadores')
      .select('*')
      .in('rut', ruts);
    if (errLectura) throw errLectura;

    const porRut = new Map<number, Record<string, unknown>>(
      (existentes ?? []).map((t) => [t.rut as number, t as Record<string, unknown>]),
    );

    const resumen: ResumenTrabajador[] = [];
    const noEncontrados: number[] = [];

    for (const fila of cambios) {
      const actual = porRut.get(fila.rut);
      if (!actual) {
        noEncontrados.push(fila.rut);
        continue;
      }

      const cambiosCampo: CambioCampo[] = [];
      for (const campo of CAMPOS_TRABAJADOR) {
        const nuevo = fila.valores[campo];
        if (nuevo === undefined) continue;

        const antes = actual[campo];
        // Se rellena siempre que esté vacío; se pisa solo si lo pidieron.
        if (!vacio(antes) && !sobrescribir) continue;
        if (String(antes ?? '').trim() === nuevo) continue;

        cambiosCampo.push({ campo, antes: vacio(antes) ? '' : String(antes), despues: nuevo });
      }

      if (cambiosCampo.length > 0 || fila.programa) {
        const entrada: ResumenTrabajador = {
          rut: fila.rut,
          nombre: `${actual.nombres ?? ''} ${actual.primer_apellido ?? ''}`.trim(),
          cambios: cambiosCampo,
        };
        if (fila.programa) entrada.programa = fila.programa;
        resumen.push(entrada);
      }
    }

    if (!aplicar) {
      return NextResponse.json({
        simulacion: true,
        hoja,
        hojas: libro.SheetNames,
        filasLeidas: filas.length,
        trabajadoresEnPlanilla: cambios.length,
        noEncontrados,
        errores,
        resumen,
      });
    }

    // --- Aplicar ---
    let actualizados = 0;
    let contratosMarcados = 0;
    const fallos: { rut: number; motivo: string }[] = [];

    for (const t of resumen) {
      if (t.cambios.length > 0) {
        const parche: Record<string, string> = {};
        for (const c of t.cambios) parche[c.campo] = c.despues;

        const { error } = await supabaseAdmin.from('trabajadores').update(parche).eq('rut', t.rut);
        if (error) {
          fallos.push({ rut: t.rut, motivo: error.message });
          continue;
        }
        actualizados++;
      }

      // El programa no vive en `trabajadores` sino en el contrato: se marca el
      // más reciente, que es el vigente para efectos de este módulo.
      if (t.programa) {
        const { data: contrato } = await supabaseAdmin
          .from('contratos')
          .select('id')
          .eq('trabajador_rut', t.rut)
          .order('fecha_inicio', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (contrato) {
          const { error } = await supabaseAdmin
            .from('contratos')
            .update({ programa: t.programa })
            .eq('id', contrato.id);
          if (error) fallos.push({ rut: t.rut, motivo: `programa: ${error.message}` });
          else contratosMarcados++;
        } else {
          fallos.push({ rut: t.rut, motivo: 'No tiene contratos donde marcar el programa.' });
        }
      }
    }

    const actor = await obtenerActor();
    await supabaseAdmin.from('auditoria').insert({
      actor,
      accion: 'IMPORTAR_DATOS_PERSONALES',
      detalles:
        `Planilla "${archivo.name}" (hoja ${hoja}): ${actualizados} trabajador(es) actualizado(s), ` +
        `${contratosMarcados} contrato(s) marcados con programa` +
        `${sobrescribir ? ', sobrescribiendo datos existentes' : ''}.`,
    });

    return NextResponse.json({
      simulacion: false,
      actualizados,
      contratosMarcados,
      noEncontrados,
      errores,
      fallos,
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo importar: ${mensaje}` }, { status: 500 });
  }
}
