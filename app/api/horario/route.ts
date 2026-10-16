import { connection } from "next/server";

import { handleError, ok } from "@/lib/api/responses";
import { getHorario } from "@/lib/services/horario";

/** GET /api/horario — horario semanal y parámetros del calendario. */
export async function GET() {
  await connection();
  try {
    return ok(await getHorario());
  } catch (err) {
    return handleError(err);
  }
}
