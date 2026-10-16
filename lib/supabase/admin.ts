import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Error de configuración del servidor (variables de entorno ausentes). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

let adminClient: SupabaseClient | null = null;

/**
 * Cliente Supabase con service_role (omite RLS). Solo para uso en servidor.
 * Se crea de forma perezosa para no romper `next build` cuando faltan variables.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !url && "SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (!url || !serviceRoleKey) {
    throw new ConfigError(
      `Faltan variables de entorno de Supabase: ${missing.join(", ")}. ` +
        "Configúralas en .env.local (ver .env.example).",
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
