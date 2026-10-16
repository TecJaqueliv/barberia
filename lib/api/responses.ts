import { z } from "zod";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "NOT_FOUND"
  | "CORREO_DUPLICADO"
  | "FRANJA_NO_DISPONIBLE"
  | "LIMITE_CITAS_ALCANZADO"
  | "CITA_YA_CANCELADA"
  | "INTERNAL_ERROR";

export type ApiErrorDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

export function ok<T>(
  data: T,
  status = 200,
  extra?: Record<string, unknown>,
  headers?: HeadersInit,
): Response {
  return Response.json({ data, ...extra }, { status, headers });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetails,
): Response {
  return Response.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function validationFail(error: z.ZodError, message = "Datos inválidos"): Response {
  const flat = z.flattenError(error) as ApiErrorDetails;
  return fail(400, "VALIDATION_ERROR", flat.formErrors[0] ?? message, flat);
}

/** Lee el body JSON; `ok: false` si no es parseable. */
export async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export function invalidJson(): Response {
  return fail(400, "INVALID_JSON", "El cuerpo de la petición no es JSON válido");
}

/** Traduce errores de dominio a respuestas; el resto -> 500 genérico. */
export function handleError(err: unknown): Response {
  if (err instanceof NotFoundError) {
    return fail(404, "NOT_FOUND", err.message);
  }
  if (err instanceof ConflictError) {
    return fail(409, err.code, err.message);
  }
  if (err instanceof ValidationError) {
    return fail(400, "VALIDATION_ERROR", err.message, {
      formErrors: err.field ? [] : [err.message],
      fieldErrors: err.field ? { [err.field]: [err.message] } : {},
    });
  }
  console.error("[api] Error inesperado:", err);
  return fail(500, "INTERNAL_ERROR", "Error interno del servidor");
}
