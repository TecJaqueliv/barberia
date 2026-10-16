import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Servicio } from "@/lib/types/servicio";

const COLUMNS = "id, slug, nombre, descripcion, duracion_min, precio, orden";

function table() {
  return getSupabaseAdmin().from("servicios");
}

function dbError(code: string, message: string, cause: unknown): Error {
  return Object.assign(new Error(`Supabase error ${code}: ${message}`), { cause });
}

/** Servicios activos ordenados por `orden`, `nombre`. */
export async function listServiciosActivos(): Promise<Servicio[]> {
  const { data, error } = await table()
    .select(COLUMNS)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw dbError(error.code, error.message, error);
  return (data ?? []) as Servicio[];
}

/** Servicio activo por id; `null` si no existe o está inactivo. */
export async function getServicioActivo(id: string): Promise<Servicio | null> {
  const { data, error } = await table()
    .select(COLUMNS)
    .eq("id", id)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw dbError(error.code, error.message, error);
  return (data as Servicio | null) ?? null;
}
