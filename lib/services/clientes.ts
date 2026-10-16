import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Cliente, ClientesListResult } from "@/lib/types/cliente";
import {
  CONTACTO_REQUERIDO_MSG,
  type ClienteCreateInput,
  type ClienteListQuery,
  type ClienteUpdateInput,
} from "@/lib/validations/cliente";

const TABLE = "clientes";
const NOT_FOUND_MSG = "Cliente no encontrado";

function table() {
  return getSupabaseAdmin().from(TABLE);
}

/** Traduce errores de Postgres/PostgREST a errores de dominio. */
function mapDbError(error: PostgrestError): Error {
  switch (error.code) {
    case "23505": // unique_violation (clientes_correo_unique_idx)
      return new ConflictError("CORREO_DUPLICADO", "Ya existe un cliente con ese correo");
    case "23514": // check_violation
      if (error.message.includes("clientes_contacto_chk")) {
        return new ValidationError(CONTACTO_REQUERIDO_MSG, "correo");
      }
      return new ValidationError("Los datos no cumplen las reglas de la base de datos");
    default:
      return Object.assign(new Error(`Supabase error ${error.code}: ${error.message}`), {
        cause: error,
      });
  }
}

/**
 * Prepara el término de búsqueda para el filtro `.or()` de PostgREST:
 * - sustituye por espacio los caracteres reservados de la sintaxis del filtro
 *   (`,` `(` `)` `"`) y `*` (PostgREST lo interpreta como comodín);
 * - escapa la barra invertida y los comodines LIKE (`%`, `_`).
 */
function escapeSearch(q: string): string {
  return q
    .replace(/[,()"*]/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, (c) => `\\${c}`);
}

function orFilter(term: string): string {
  const pattern = `%${term}%`;
  return `nombre.ilike.${pattern},correo.ilike.${pattern},telefono.ilike.${pattern}`;
}

export async function listClientes(query: ClienteListQuery): Promise<ClientesListResult> {
  const { q, limit, offset } = query;

  let builder = table()
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const term = q ? escapeSearch(q) : "";
  if (term) {
    builder = builder.or(orFilter(term));
  }

  const { data, error, count } = await builder;
  if (error?.code === "PGRST103") {
    // offset fuera de rango: página vacía, pero se informa el total real.
    let countQuery = table().select("id", { count: "exact", head: true });
    if (term) countQuery = countQuery.or(orFilter(term));
    const res = await countQuery;
    if (res.error) throw mapDbError(res.error);
    return { data: [], total: res.count ?? 0 };
  }
  if (error) throw mapDbError(error);
  return { data: (data ?? []) as Cliente[], total: count ?? 0 };
}

export async function getClienteById(id: string): Promise<Cliente> {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new NotFoundError(NOT_FOUND_MSG);
  return data as Cliente;
}

export async function createCliente(input: ClienteCreateInput): Promise<Cliente> {
  const { data, error } = await table().insert(input).select().single();
  if (error) throw mapDbError(error);
  return data as Cliente;
}

export async function updateCliente(id: string, patch: ClienteUpdateInput): Promise<Cliente> {
  // Regla de negocio: el estado resultante debe conservar correo o teléfono.
  const actual = await getClienteById(id);
  const correo = patch.correo !== undefined ? patch.correo : actual.correo;
  const telefono = patch.telefono !== undefined ? patch.telefono : actual.telefono;
  if (correo === null && telefono === null) {
    throw new ValidationError(CONTACTO_REQUERIDO_MSG, "correo");
  }

  // Solo se envían los campos presentes; updated_at lo pone el trigger.
  const changes = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );

  const { data, error } = await table().update(changes).eq("id", id).select().maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new NotFoundError(NOT_FOUND_MSG);
  return data as Cliente;
}

export async function deleteCliente(id: string): Promise<void> {
  const { data, error } = await table().delete().eq("id", id).select("id");
  if (error) throw mapDbError(error);
  if (!data || data.length === 0) throw new NotFoundError(NOT_FOUND_MSG);
}
