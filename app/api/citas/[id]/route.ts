import type { NextRequest } from "next/server";

import {
  handleError,
  invalidJson,
  ok,
  readJson,
  validationFail,
} from "@/lib/api/responses";
import { cancelarCita } from "@/lib/services/citas";
import { citaIdSchema, citaUpdateSchema } from "@/lib/validations/cita";

type Ctx = RouteContext<"/api/citas/[id]">;

/** PATCH /api/citas/{id} — cancelar una cita (único cambio permitido). */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const parsedId = citaIdSchema.safeParse(id);
    if (!parsedId.success) return validationFail(parsedId.error, "Id inválido");

    const body = await readJson(request);
    if (!body.ok) return invalidJson();

    const parsed = citaUpdateSchema.safeParse(body.value);
    if (!parsed.success) return validationFail(parsed.error);

    return ok(await cancelarCita(parsedId.data));
  } catch (err) {
    return handleError(err);
  }
}
