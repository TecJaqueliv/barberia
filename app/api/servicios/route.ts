import { connection } from "next/server";

import { handleError, ok } from "@/lib/api/responses";
import { MONEDA } from "@/lib/config/agenda";
import { listServiciosActivos } from "@/lib/services/servicios";

/** GET /api/servicios — catálogo de servicios activos (también lista de precios). */
export async function GET() {
  await connection();
  try {
    const servicios = await listServiciosActivos();
    return ok(servicios, 200, { meta: { moneda: MONEDA } });
  } catch (err) {
    return handleError(err);
  }
}
