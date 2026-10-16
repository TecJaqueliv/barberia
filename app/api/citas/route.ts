import { connection, type NextRequest } from "next/server";

import {
  handleError,
  invalidJson,
  ok,
  readJson,
  validationFail,
} from "@/lib/api/responses";
import { createCita, listCitas } from "@/lib/services/citas";
import { citaCreateSchema, citaListQuerySchema } from "@/lib/validations/cita";

/** GET /api/citas?desde=&hasta=&estado=&limit=&offset= — listado administrativo. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const params = request.nextUrl.searchParams;
    const parsed = citaListQuerySchema.safeParse({
      desde: params.get("desde") ?? undefined,
      hasta: params.get("hasta") ?? undefined,
      estado: params.get("estado") ?? undefined,
      limit: params.get("limit") ?? undefined,
      offset: params.get("offset") ?? undefined,
    });
    if (!parsed.success) return validationFail(parsed.error);

    const { desde, hasta, limit, offset } = parsed.data;
    const { data, total } = await listCitas(parsed.data);
    return ok(data, 200, { meta: { total, limit, offset, desde, hasta } });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/citas — reservar una cita (público). */
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body.ok) return invalidJson();

    const parsed = citaCreateSchema.safeParse(body.value);
    if (!parsed.success) return validationFail(parsed.error);

    const cita = await createCita(parsed.data);
    return ok(cita, 201, undefined, { Location: `/api/citas/${cita.id}` });
  } catch (err) {
    return handleError(err);
  }
}
