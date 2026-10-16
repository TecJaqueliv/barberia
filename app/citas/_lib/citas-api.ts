import type { ApiErrorCode, ApiErrorDetails } from "@/lib/api/responses";
import { ApiClientError, type RequestOptions } from "@/lib/client/clientes";
import { MAX_CITAS_FUTURAS_POR_TELEFONO } from "@/lib/config/agenda";
import type { CitaConServicio, Disponibilidad } from "@/lib/types/cita";
import type { Horario, Servicio } from "@/lib/types/servicio";

type ErrorBody = {
  error?: {
    code?: ApiErrorCode;
    message?: string;
    details?: Partial<ApiErrorDetails>;
  };
};

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

export async function getServicios(options?: RequestOptions): Promise<Servicio[]> {
  const body = await request<{ data: Servicio[] }>("/api/servicios", options);
  return body.data;
}

export async function getHorario(options?: RequestOptions): Promise<Horario> {
  const body = await request<{ data: Horario }>("/api/horario", options);
  return body.data;
}

export async function getDisponibilidad(
  params: { fecha: string; servicioId: string },
  options?: RequestOptions,
): Promise<Disponibilidad> {
  const search = new URLSearchParams({ fecha: params.fecha, servicio_id: params.servicioId });
  const body = await request<{ data: Disponibilidad }>(
    `/api/citas/disponibilidad?${search.toString()}`,
    options,
  );
  return body.data;
}

export type CitaNueva = {
  servicio_id: string;
  inicio: string;
  nombre: string;
  telefono: string;
  email?: string | null;
  notas?: string | null;
};

export async function crearCita(input: CitaNueva): Promise<CitaConServicio> {
  // La API es estricta: solo se envían las claves conocidas.
  const payload: CitaNueva = {
    servicio_id: input.servicio_id,
    inicio: input.inicio,
    nombre: input.nombre,
    telefono: input.telefono,
    email: input.email,
    notas: input.notas,
  };
  const body = await request<{ data: CitaConServicio }>("/api/citas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return body.data;
}

/** Traduce cualquier error de la agenda a un mensaje en español apto para la UI. */
export function mensajeCitas(err: unknown): string {
  if (!(err instanceof ApiClientError)) return "Ocurrió un error inesperado.";
  if (err.code === "NETWORK_ERROR") {
    return "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }
  if (err.status >= 500 || err.code === "INTERNAL_ERROR") {
    return "La agenda en línea no está disponible en este momento. Inténtalo más tarde.";
  }
  switch (err.code) {
    case "FRANJA_NO_DISPONIBLE":
      return "Ese horario acaba de ser reservado por otra persona. Elige otro, por favor.";
    case "LIMITE_CITAS_ALCANZADO":
      return `Ya tienes ${MAX_CITAS_FUTURAS_POR_TELEFONO} citas pendientes con este teléfono. No es posible reservar más por ahora.`;
    case "VALIDATION_ERROR":
    case "INVALID_JSON": {
      const primerCampo = Object.values(err.fieldErrors).find((m) => m.length > 0)?.[0];
      return err.formErrors[0] ?? primerCampo ?? err.message;
    }
    default:
      return err.message;
  }
}
