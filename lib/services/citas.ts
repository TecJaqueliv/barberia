import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import {
  diaLocalDe,
  fechaEnVentana,
  generarFranjas,
  validarInicio,
  type Intervalo,
} from "@/lib/agenda/franjas";
import { diaSemana, hoyEnZona, localAUtc, sumarDias, sumarMinutos } from "@/lib/agenda/tiempo";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import {
  ANTELACION_MIN_MINUTOS,
  DIAS_MAX_ANTICIPACION,
  INTERVALO_FRANJA_MIN,
  MAX_CITAS_FUTURAS_POR_TELEFONO,
  ZONA_HORARIA,
} from "@/lib/config/agenda";
import { getHorarioDia } from "@/lib/services/horario";
import { getServicioActivo } from "@/lib/services/servicios";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CitaConServicio, CitasListResult, Disponibilidad } from "@/lib/types/cita";
import type { Servicio } from "@/lib/types/servicio";
import type {
  CitaCreateInput,
  CitaListQuery,
  DisponibilidadQuery,
} from "@/lib/validations/cita";

const SELECT_CON_SERVICIO = "*, servicio:servicios(id, nombre)";
const SERVICIO_NO_DISPONIBLE = "Servicio no disponible";

function table() {
  return getSupabaseAdmin().from("citas");
}

/** Traduce errores de Postgres/PostgREST a errores de dominio. */
export function mapDbError(error: PostgrestError): Error {
  switch (error.code) {
    case "23P01": // exclusion_violation (citas_sin_solapamiento_excl)
      return new ConflictError(
        "FRANJA_NO_DISPONIBLE",
        "La franja seleccionada ya no está disponible",
      );
    case "23503": // foreign_key_violation (citas_servicio_id_fkey)
      return new ValidationError("El servicio no existe", "servicio_id");
    case "23514": // check_violation
      return new ValidationError("Los datos no cumplen las reglas de la base de datos");
    case "22P02": // invalid_text_representation (uuid/enum)
      return new ValidationError("Valor inválido");
    default:
      return Object.assign(new Error(`Supabase error ${error.code}: ${error.message}`), {
        cause: error,
      });
  }
}

async function requireServicioActivo(id: string): Promise<Servicio> {
  const servicio = await getServicioActivo(id);
  if (!servicio) throw new ValidationError(SERVICIO_NO_DISPONIBLE, "servicio_id");
  return servicio;
}

/** Franjas de un día para un servicio (sin datos de otras citas). */
export async function getDisponibilidad(
  query: DisponibilidadQuery,
  ahora: Date = new Date(),
): Promise<Disponibilidad> {
  const { fecha, servicio_id } = query;

  const hoy = hoyEnZona(ZONA_HORARIA, ahora);
  if (!fechaEnVentana(fecha, hoy, DIAS_MAX_ANTICIPACION)) {
    throw new ValidationError(
      `Solo se puede consultar desde hoy hasta ${DIAS_MAX_ANTICIPACION} días`,
      "fecha",
    );
  }

  const servicio = await requireServicioActivo(servicio_id);
  const servicioResumen = {
    id: servicio.id,
    nombre: servicio.nombre,
    duracion_min: servicio.duracion_min,
    precio: servicio.precio,
  };

  const horario = await getHorarioDia(diaSemana(fecha));
  if (!horario) {
    return {
      fecha,
      zona_horaria: ZONA_HORARIA,
      cerrado: true,
      horario: null,
      servicio: servicioResumen,
      franjas: [],
    };
  }

  const diaInicio = localAUtc(fecha, horario.apertura, ZONA_HORARIA);
  const diaFin = localAUtc(fecha, horario.cierre, ZONA_HORARIA);

  const { data, error } = await table()
    .select("inicio, fin")
    .eq("estado", "confirmada")
    .lt("inicio", diaFin.toISOString())
    .gt("fin", diaInicio.toISOString());
  if (error) throw mapDbError(error);

  const ocupadas: Intervalo[] = ((data ?? []) as { inicio: string; fin: string }[]).map(
    (c) => ({ inicio: new Date(c.inicio), fin: new Date(c.fin) }),
  );

  const franjas = generarFranjas({
    fecha,
    apertura: horario.apertura,
    cierre: horario.cierre,
    duracionMin: servicio.duracion_min,
    intervaloMin: INTERVALO_FRANJA_MIN,
    tz: ZONA_HORARIA,
    ocupadas,
    ahora,
    antelacionMin: ANTELACION_MIN_MINUTOS,
  });

  return {
    fecha,
    zona_horaria: ZONA_HORARIA,
    cerrado: false,
    horario,
    servicio: servicioResumen,
    franjas,
  };
}

/**
 * Reserva una cita. La exclusion constraint `citas_sin_solapamiento_excl` es la
 * única garantía contra solapamientos (23P01 -> 409 FRANJA_NO_DISPONIBLE).
 */
export async function createCita(input: CitaCreateInput): Promise<CitaConServicio> {
  const ahora = new Date();
  const servicio = await requireServicioActivo(input.servicio_id);

  // Reglas de calendario (mismas funciones que la disponibilidad).
  const { dia } = diaLocalDe(input.inicio, ZONA_HORARIA);
  const horario = await getHorarioDia(dia);
  const motivo = validarInicio({
    inicio: input.inicio,
    duracionMin: servicio.duracion_min,
    horario,
    hoy: hoyEnZona(ZONA_HORARIA, ahora),
    ahora,
    tz: ZONA_HORARIA,
    intervaloMin: INTERVALO_FRANJA_MIN,
    antelacionMin: ANTELACION_MIN_MINUTOS,
    diasMaxAnticipacion: DIAS_MAX_ANTICIPACION,
  });
  if (motivo) throw new ValidationError(motivo, "inicio");

  // Antispam: citas confirmadas futuras del mismo teléfono (no atómico; aceptado).
  const conteo = await table()
    .select("id", { count: "exact", head: true })
    .eq("estado", "confirmada")
    .eq("telefono", input.telefono)
    .gt("inicio", ahora.toISOString());
  if (conteo.error) throw mapDbError(conteo.error);
  if ((conteo.count ?? 0) >= MAX_CITAS_FUTURAS_POR_TELEFONO) {
    throw new ConflictError(
      "LIMITE_CITAS_ALCANZADO",
      `Ya tienes ${MAX_CITAS_FUTURAS_POR_TELEFONO} citas futuras confirmadas con este teléfono`,
    );
  }

  // fin, duración y precio se calculan en servidor (snapshot del servicio).
  const fin = sumarMinutos(input.inicio, servicio.duracion_min);
  const { data, error } = await table()
    .insert({
      servicio_id: servicio.id,
      inicio: input.inicio.toISOString(),
      fin: fin.toISOString(),
      duracion_min: servicio.duracion_min,
      precio: servicio.precio,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email,
      notas: input.notas,
    })
    .select(SELECT_CON_SERVICIO)
    .single();
  if (error) throw mapDbError(error);
  return data as CitaConServicio;
}

/** Listado administrativo por rango de fechas locales [desde, hasta]. */
export async function listCitas(query: CitaListQuery): Promise<CitasListResult> {
  const { desde, hasta, estado, limit, offset } = query;
  const rangoInicio = localAUtc(desde, "00:00", ZONA_HORARIA).toISOString();
  const rangoFin = localAUtc(sumarDias(hasta, 1), "00:00", ZONA_HORARIA).toISOString();

  let builder = table()
    .select(SELECT_CON_SERVICIO, { count: "exact" })
    .gte("inicio", rangoInicio)
    .lt("inicio", rangoFin);
  if (estado) builder = builder.eq("estado", estado);

  const { data, error, count } = await builder
    .order("inicio", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error?.code === "PGRST103") {
    // offset fuera de rango: página vacía, pero se informa el total real.
    let countQuery = table()
      .select("id", { count: "exact", head: true })
      .gte("inicio", rangoInicio)
      .lt("inicio", rangoFin);
    if (estado) countQuery = countQuery.eq("estado", estado);
    const res = await countQuery;
    if (res.error) throw mapDbError(res.error);
    return { data: [], total: res.count ?? 0 };
  }
  if (error) throw mapDbError(error);
  return { data: (data ?? []) as CitaConServicio[], total: count ?? 0 };
}

/** Cancela una cita confirmada (update atómico condicionado al estado). */
export async function cancelarCita(id: string): Promise<CitaConServicio> {
  const { data, error } = await table()
    .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "confirmada")
    .select(SELECT_CON_SERVICIO)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (data) return data as CitaConServicio;

  const existe = await table().select("id").eq("id", id).maybeSingle();
  if (existe.error) throw mapDbError(existe.error);
  if (!existe.data) throw new NotFoundError("Cita no encontrada");
  throw new ConflictError("CITA_YA_CANCELADA", "La cita ya está cancelada");
}
