import type { ApiErrorCode, ApiErrorDetails } from "@/lib/api/responses";
import type { Cliente } from "@/lib/types/cliente";

export type ClienteInput = {
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  detalle?: string | null;
};

export type ClienteUpdate = Partial<ClienteInput>;

export type ListClientesParams = { q?: string; limit?: number; offset?: number };

export type ListClientesResponse = {
  data: Cliente[];
  meta: { total: number; limit: number; offset: number };
};

/** Opciones extra de la petición (p. ej. `signal` para cancelar). */
export type RequestOptions = Pick<RequestInit, "signal">;

export type ApiClientErrorCode = ApiErrorCode | "NETWORK_ERROR";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiClientErrorCode;
  readonly fieldErrors: Record<string, string[]>;
  readonly formErrors: string[];

  constructor(
    status: number,
    code: ApiClientErrorCode,
    message: string,
    details?: Partial<ApiErrorDetails>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors ?? {};
    this.formErrors = details?.formErrors ?? [];
  }
}

type ErrorBody = {
  error?: {
    code?: ApiErrorCode;
    message?: string;
    details?: Partial<ApiErrorDetails>;
  };
};

const BASE = "/api/clientes";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    // Una cancelación no es un fallo de red: se propaga tal cual.
    if (init?.signal?.aborted) throw err;
    throw new ApiClientError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor");
  }

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiClientError(
      res.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Error interno del servidor",
      error?.details,
    );
  }

  return body as T;
}

const clientePath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export function listClientes(
  params: ListClientesParams = {},
  options?: RequestOptions,
): Promise<ListClientesResponse> {
  const search = new URLSearchParams();
  const q = params.q?.trim();
  if (q) search.set("q", q);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const qs = search.toString();
  return request<ListClientesResponse>(qs ? `${BASE}?${qs}` : BASE, options);
}

export async function getCliente(id: string, options?: RequestOptions): Promise<Cliente> {
  const body = await request<{ data: Cliente }>(clientePath(id), options);
  return body.data;
}

export async function createCliente(input: ClienteInput): Promise<Cliente> {
  const body = await request<{ data: Cliente }>(BASE, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function updateCliente(id: string, input: ClienteUpdate): Promise<Cliente> {
  const body = await request<{ data: Cliente }>(clientePath(id), {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function deleteCliente(id: string): Promise<void> {
  await request<void>(clientePath(id), { method: "DELETE" });
}

/** Traduce cualquier error a un mensaje en español apto para la UI. */
export function mensajeAmigable(err: unknown): string {
  if (!(err instanceof ApiClientError)) return "Ocurrió un error inesperado.";
  if (err.code === "NETWORK_ERROR") return "Sin conexión con el servidor.";
  if (err.code === "INTERNAL_ERROR" || err.status >= 500) {
    return "No pudimos completar la operación. El servidor no está disponible en este momento; inténtalo más tarde.";
  }
  switch (err.code) {
    case "NOT_FOUND":
      return "El cliente ya no existe.";
    case "CORREO_DUPLICADO":
      return err.message;
    case "VALIDATION_ERROR":
    case "INVALID_JSON":
      return err.formErrors[0] ?? err.message;
    default:
      return "Ocurrió un error inesperado.";
  }
}
