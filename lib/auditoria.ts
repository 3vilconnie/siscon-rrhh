// lib/auditoria.ts
// Registro de auditoría a nivel de aplicación: se llama después de cada
// operación que modifica datos, para dejar constancia en la tabla "auditoria"
// de QUÉ cambió y QUIÉN lo hizo (el usuario autenticado).
//
// Es "best-effort": si el registro falla, NO interrumpe la operación principal
// (solo deja un aviso en consola).

import { supabase } from './supabase';

/** Acciones auditadas del sistema (usar estas constantes para mantener consistencia). */
export const ACCIONES = {
  CREAR_TRABAJADOR: 'CREAR_TRABAJADOR',
  CREAR_CONTRATO: 'CREAR_CONTRATO',
  EDITAR_CONTRATO: 'EDITAR_CONTRATO',
  REGISTRAR_HORAS: 'REGISTRAR_HORAS',
  CARGA_MASIVA: 'CARGA_MASIVA',
  MODIFICAR_CONFIGURACION: 'MODIFICAR_CONFIGURACION',
} as const;

export type AccionAuditoria = (typeof ACCIONES)[keyof typeof ACCIONES] | string;

/**
 * Inserta un registro en la tabla "auditoria" con el usuario actual como actor.
 * Nunca lanza: los errores se registran en consola para no romper el flujo.
 *
 * Requisito: la tabla "auditoria" debe permitir INSERT a usuarios autenticados
 * (ver db/auditoria_rls.sql).
 */
export async function registrarAuditoria(
  accion: AccionAuditoria,
  detalles: string,
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const usuario = session?.user;
    const actor =
      usuario?.email ||
      (usuario?.user_metadata?.full_name as string | undefined) ||
      usuario?.id ||
      'desconocido';

    const { error } = await supabase.from('auditoria').insert({ actor, accion, detalles });
    if (error) console.error('No se pudo registrar la auditoría:', error.message);
  } catch (e) {
    console.error('No se pudo registrar la auditoría:', e);
  }
}
