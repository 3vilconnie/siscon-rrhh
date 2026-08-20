// lib/lotesRepo.ts
// Registra cada generación masiva (contratos, anexos o finiquitos) en las
// tablas `lotes` / `lote_items`. Ver db/lotes.sql.
//
// El registro es automático y "best-effort": si falla, NO interrumpe la
// generación de los documentos — el usuario ya tiene sus archivos y no tiene
// sentido bloquearlo por un problema de registro. El fallo queda en consola.
// Es el mismo criterio de lib/auditoria.ts.
//
// Solo escribe: consultar el historial es una operación de auditoría y va por
// /api/admin/lotes, reservada a administradores.

import { supabase } from '@/lib/supabase';
import type { LoteItem, TipoLote } from '@/types';

export interface NuevoLote {
  tipo: TipoLote;
  formato?: string;
  /** Configuración usada (programa, fechas, bonos…). Permite reproducirlo. */
  parametros: Record<string, unknown>;
  items: LoteItem[];
}

/** Email del usuario actual, para dejar constancia de quién generó el lote. */
async function actorActual(): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? 'desconocido';
  } catch {
    return 'desconocido';
  }
}

/**
 * Guarda el lote y sus filas. Devuelve el id del lote, o null si no se pudo
 * registrar (la generación de documentos continúa igual).
 */
export async function registrarLote(lote: NuevoLote): Promise<string | null> {
  // El id se genera aquí en vez de pedirle a Postgres que lo devuelva.
  // Un "insert ... returning" (que es lo que hace .select() encadenado) obliga
  // a Postgres a evaluar la política de SELECT sobre la fila insertada, y estas
  // tablas NO tienen política de SELECT a propósito: el historial solo se lee
  // desde /api/admin/lotes con service role. Pedir el id de vuelta hacía fallar
  // el registro completo por RLS.
  const id = crypto.randomUUID();

  try {
    const { error } = await supabase.from('lotes').insert({
      id,
      tipo: lote.tipo,
      cantidad: lote.items.length,
      formato: lote.formato ?? null,
      parametros: lote.parametros,
      generado_por: await actorActual(),
    });

    if (error) throw error;

    if (lote.items.length > 0) {
      const { error: errItems } = await supabase.from('lote_items').insert(
        lote.items.map((i) => ({
          lote_id: id,
          trabajador_rut: i.trabajador_rut,
          nombre_completo: i.nombre_completo,
          fecha_inicio: i.fecha_inicio ?? null,
          fecha_termino: i.fecha_termino ?? null,
          monto: i.monto ?? null,
          detalle: i.detalle ?? {},
        })),
      );
      if (errItems) throw errItems;
    }

    return id;
  } catch (e) {
    const mensaje =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: unknown }).message)
        : String(e);
    console.error('No se pudo registrar el lote:', mensaje);
    return null;
  }
}
