import { connection, type NextRequest } from "next/server";

import { handleError, ok, validationFail } from "@/lib/api/responses";
import { getDisponibilidad } from "@/lib/services/citas";
import { disponibilidadQuerySchema } from "@/lib/validations/cita";

/** GET /api/citas/disponibilidad?fecha=YYYY-MM-DD&servicio_id=<uuid> — franjas de un día. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const params = request.nextUrl.searchParams;
    const parsed = disponibilidadQuerySchema.safeParse({
      fecha: params.get("fecha") ?? undefined,
      servicio_id: params.get("servicio_id") ?? undefined,
    });
    if (!parsed.success) return validationFail(parsed.error);

    return ok(await getDisponibilidad(parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
