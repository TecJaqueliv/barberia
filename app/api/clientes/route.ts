import { connection, type NextRequest } from "next/server";

import {
  handleError,
  invalidJson,
  ok,
  readJson,
  validationFail,
} from "@/lib/api/responses";
import { createCliente, listClientes } from "@/lib/services/clientes";
import { clienteCreateSchema, clienteListQuerySchema } from "@/lib/validations/cliente";

/** GET /api/clientes?q=&limit=20&offset=0 — listar clientes. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const params = request.nextUrl.searchParams;
    const parsed = clienteListQuerySchema.safeParse({
      q: params.get("q") ?? undefined,
      limit: params.get("limit") ?? undefined,
      offset: params.get("offset") ?? undefined,
    });
    if (!parsed.success) return validationFail(parsed.error);

    const { limit, offset } = parsed.data;
    const { data, total } = await listClientes(parsed.data);
    return ok(data, 200, { meta: { total, limit, offset } });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/clientes — crear cliente. */
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body.ok) return invalidJson();

    const parsed = clienteCreateSchema.safeParse(body.value);
    if (!parsed.success) return validationFail(parsed.error);

    const cliente = await createCliente(parsed.data);
    return ok(cliente, 201, undefined, { Location: `/api/clientes/${cliente.id}` });
  } catch (err) {
    return handleError(err);
  }
}
