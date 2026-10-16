import { z } from "zod";

import { diferenciaDias, hoyEnZona, sumarDias } from "@/lib/agenda/tiempo";
import {
  LISTADO_DIAS_POR_DEFECTO,
  LISTADO_RANGO_MAX_DIAS,
  ZONA_HORARIA,
} from "@/lib/config/agenda";
import { CITA_ESTADOS } from "@/lib/types/cita";
import { TELEFONO_REGEX } from "@/lib/validations/cliente";

/** trim + cadena vacía -> null (para campos opcionales). */
const emptyToNull = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? null : t;
};

/** Query string vacía -> undefined para que apliquen los defaults. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** Mensajes en español para objeto no válido / campos desconocidos. */
const objectParams = {
  error: (iss: { code?: string; keys?: string[] }) =>
    iss.code === "unrecognized_keys"
      ? `Campos no permitidos: ${(iss.keys ?? []).join(", ")}`
      : "Se esperaba un objeto JSON",
};

export const fechaSchema = z.iso.date({ error: "Fecha inválida (formato YYYY-MM-DD)" });
export const servicioIdSchema = z.uuid({ error: "El servicio_id debe ser un UUID válido" });
export const citaIdSchema = z.uuid({ error: "El id debe ser un UUID válido" });

export const disponibilidadQuerySchema = z.object({
  fecha: fechaSchema,
  servicio_id: servicioIdSchema,
});

export const citaCreateSchema = z.strictObject(
  {
    servicio_id: servicioIdSchema,
    inicio: z.iso
      .datetime({
        offset: true,
        error: "Inicio inválido (ISO 8601 con zona, p. ej. 2026-10-20T14:00:00.000Z)",
      })
      .transform((v) => new Date(v)),
    nombre: z
      .string({ error: "El nombre es obligatorio" })
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(120, "El nombre no puede superar 120 caracteres"),
    telefono: z
      .string({ error: "El teléfono es obligatorio" })
      .trim()
      .regex(
        TELEFONO_REGEX,
        "Teléfono inválido (7-20 caracteres: dígitos, espacios, +, -, paréntesis)",
      ),
    email: z
      .preprocess(
        emptyToNull,
        z
          .email("Correo inválido")
          .max(254, "El correo no puede superar 254 caracteres")
          .transform((v) => v.toLowerCase())
          .nullable(),
      )
      .optional()
      .transform((v) => v ?? null),
    notas: z
      .preprocess(
        emptyToNull,
        z.string().max(500, "Las notas no pueden superar 500 caracteres").nullable(),
      )
      .optional()
      .transform((v) => v ?? null),
  },
  objectParams,
);

export const citaListQuerySchema = z
  .object({
    desde: z.preprocess(emptyToUndefined, fechaSchema.optional()),
    hasta: z.preprocess(emptyToUndefined, fechaSchema.optional()),
    estado: z.preprocess(
      emptyToUndefined,
      z.enum(CITA_ESTADOS, { error: "estado debe ser confirmada o cancelada" }).optional(),
    ),
    limit: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "limit debe ser un número" })
        .int("limit debe ser entero")
        .min(1, "limit mínimo 1")
        .max(200, "limit máximo 200")
        .default(50),
    ),
    offset: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "offset debe ser un número" })
        .int("offset debe ser entero")
        .min(0, "offset no puede ser negativo")
        .default(0),
    ),
  })
  .transform((v) => {
    const desde = v.desde ?? hoyEnZona(ZONA_HORARIA);
    const hasta = v.hasta ?? sumarDias(desde, LISTADO_DIAS_POR_DEFECTO);
    return { ...v, desde, hasta };
  })
  .refine((v) => v.hasta >= v.desde, {
    message: "hasta debe ser igual o posterior a desde",
    path: ["hasta"],
  })
  .refine((v) => diferenciaDias(v.desde, v.hasta) <= LISTADO_RANGO_MAX_DIAS, {
    message: `El rango no puede superar ${LISTADO_RANGO_MAX_DIAS} días`,
    path: ["hasta"],
  });

export const citaUpdateSchema = z.strictObject(
  {
    estado: z.literal("cancelada", { error: 'Solo se permite { "estado": "cancelada" }' }),
  },
  objectParams,
);

export type DisponibilidadQuery = z.infer<typeof disponibilidadQuerySchema>;
export type CitaCreateInput = z.infer<typeof citaCreateSchema>;
export type CitaListQuery = z.infer<typeof citaListQuerySchema>;
export type CitaUpdateInput = z.infer<typeof citaUpdateSchema>;
