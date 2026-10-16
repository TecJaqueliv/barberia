import "server-only";

import type { TramoHorario } from "@/lib/agenda/franjas";
import { hoyEnZona, recortarHora, sumarDias } from "@/lib/agenda/tiempo";
import {
  DIAS_MAX_ANTICIPACION,
  INTERVALO_FRANJA_MIN,
  ZONA_HORARIA,
} from "@/lib/config/agenda";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DiaSemana, Horario, HorarioDia } from "@/lib/types/servicio";

type HorarioRow = { dia_semana: number; apertura: string; cierre: string };

function table() {
  return getSupabaseAdmin().from("horario_atencion");
}

function dbError(code: string, message: string, cause: unknown): Error {
  return Object.assign(new Error(`Supabase error ${code}: ${message}`), { cause });
}

/** Los 7 días (0 = domingo ... 6 = sábado); sin fila = cerrado. */
export async function getHorarioSemanal(): Promise<HorarioDia[]> {
  const { data, error } = await table()
    .select("dia_semana, apertura, cierre")
    .order("dia_semana", { ascending: true });
  if (error) throw dbError(error.code, error.message, error);

  const filas = new Map(((data ?? []) as HorarioRow[]).map((r) => [r.dia_semana, r]));
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((dia: DiaSemana): HorarioDia => {
    const fila = filas.get(dia);
    return fila
      ? {
          dia_semana: dia,
          cerrado: false,
          apertura: recortarHora(fila.apertura),
          cierre: recortarHora(fila.cierre),
        }
      : { dia_semana: dia, cerrado: true, apertura: null, cierre: null };
  });
}

/** Horario semanal + parámetros del calendario (GET /api/horario). */
export async function getHorario(): Promise<Horario> {
  const dias = await getHorarioSemanal();
  const hoy = hoyEnZona(ZONA_HORARIA);
  return {
    zona_horaria: ZONA_HORARIA,
    intervalo_min: INTERVALO_FRANJA_MIN,
    hoy,
    fecha_max: sumarDias(hoy, DIAS_MAX_ANTICIPACION),
    dias,
  };
}

/** Tramo de un día de la semana ("HH:MM"); `null` = cerrado. */
export async function getHorarioDia(diaSemana: number): Promise<TramoHorario | null> {
  const { data, error } = await table()
    .select("dia_semana, apertura, cierre")
    .eq("dia_semana", diaSemana)
    .maybeSingle();
  if (error) throw dbError(error.code, error.message, error);
  if (!data) return null;
  const fila = data as HorarioRow;
  return { apertura: recortarHora(fila.apertura), cierre: recortarHora(fila.cierre) };
}
