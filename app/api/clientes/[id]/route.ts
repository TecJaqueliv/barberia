import { connection, type NextRequest } from "next/server";

import {
  handleError,
  invalidJson,
  noContent,
  ok,
  readJson,
  validationFail,
} from "@/lib/api/responses";
import {
  deleteCliente,
  getClienteById,
  updateCliente,
} from "@/lib/services/clientes";
import { clienteIdSchema, clienteUpdateSchema } from "@/lib/validations/cliente";

type Ctx = RouteContext<"/api/clientes/[id]">;

/** GET /api/clientes/{id} — obtener un cliente. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  await connection();
  try {
    const id = clienteIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return validationFail(id.error, "Id inválido");

    return ok(await getClienteById(id.data));
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/clientes/{id} — actualización parcial. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const id = clienteIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return validationFail(id.error, "Id inválido");

    const body = await readJson(request);
    if (!body.ok) return invalidJson();

    const parsed = clienteUpdateSchema.safeParse(body.value);
    if (!parsed.success) return validationFail(parsed.error);

    return ok(await updateCliente(id.data, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/clientes/{id} — eliminar (borrado físico). */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const id = clienteIdSchema.safeParse((await ctx.params).id);
    if (!id.success) return validationFail(id.error, "Id inválido");

    await deleteCliente(id.data);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
