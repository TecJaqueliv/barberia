import { z } from "zod";

export const TELEFONO_REGEX = /^[0-9+()\s-]{7,20}$/;
const CONTACTO_MSG = "Debe indicar correo o teléfono";

/** trim + cadena vacía -> null (para campos opcionales). */
const emptyToNull = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? null : t;
};

/** Mensajes en español para objeto no válido / campos desconocidos. */
const objectParams = {
  error: (iss: { code?: string; keys?: string[] }) =>
    iss.code === "unrecognized_keys"
      ? `Campos no permitidos: ${(iss.keys ?? []).join(", ")}`
      : "Se esperaba un objeto JSON",
};

const nombre = z
  .string({ error: "El nombre es obligatorio" })
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(120, "El nombre no puede superar 120 caracteres");

const correo = z.preprocess(
  emptyToNull,
  z
    .email("Correo inválido")
    .max(254, "El correo no puede superar 254 caracteres")
    .transform((v) => v.toLowerCase())
    .nullable(),
);

const telefono = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(
      TELEFONO_REGEX,
      "Teléfono inválido (7-20 caracteres: dígitos, espacios, +, -, paréntesis)",
    )
    .nullable(),
);

const detalle = z.preprocess(
  emptyToNull,
  z
    .string()
    .max(1000, "El detalle no puede superar 1000 caracteres")
    .nullable(),
);

export const clienteCreateSchema = z
  .strictObject({
    nombre,
    correo: correo.optional(),
    telefono: telefono.optional(),
    detalle: detalle.optional(),
  }, objectParams)
  .transform((v) => ({
    nombre: v.nombre,
    correo: v.correo ?? null,
    telefono: v.telefono ?? null,
    detalle: v.detalle ?? null,
  }))
  .refine((v) => v.correo !== null || v.telefono !== null, {
    message: CONTACTO_MSG,
    path: ["correo"],
  });

export const clienteUpdateSchema = z
  .strictObject({
    nombre: nombre.optional(),
    correo: correo.optional(),
    telefono: telefono.optional(),
    detalle: detalle.optional(),
  }, objectParams)
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "No hay campos para actualizar",
  });

export const clienteIdSchema = z.uuid("El id debe ser un UUID válido");

/** Query string vacía -> undefined para que apliquen los defaults. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const clienteListQuerySchema = z.object({
  q: z.preprocess(
    emptyToNull,
    z.string().max(100, "La búsqueda no puede superar 100 caracteres").nullable(),
  ).optional(),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce
    .number({ error: "limit debe ser un número" })
    .int("limit debe ser entero")
    .min(1, "limit mínimo 1")
    .max(100, "limit máximo 100")
    .default(20),
  ),
  offset: z.preprocess(
    emptyToUndefined,
    z.coerce
    .number({ error: "offset debe ser un número" })
    .int("offset debe ser entero")
    .min(0, "offset no puede ser negativo")
    .default(0),
  ),
});

export const CONTACTO_REQUERIDO_MSG = CONTACTO_MSG;

export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;
export type ClienteListQuery = z.infer<typeof clienteListQuerySchema>;
