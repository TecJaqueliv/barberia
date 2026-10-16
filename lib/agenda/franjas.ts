/**
 * Reglas puras del calendario (sin BD): generación de franjas y validación de
 * un inicio de cita. Disponibilidad (GET) y reserva (POST) usan estas mismas
 * funciones para no duplicar reglas.
 */
import {
  diaSemana,
  horaDeMinutos,
  localAUtc,
  minutosDeHora,
  sumarDias,
  sumarMinutos,
  utcALocal,
} from "@/lib/agenda/tiempo";
import type { Franja } from "@/lib/types/cita";

export type Intervalo = { inicio: Date; fin: Date };

/** Horario de un día en "HH:MM" (hora local). */
export type TramoHorario = { apertura: string; cierre: string };

/** Solapamiento con rango semiabierto [inicio, fin). */
export function seSolapa(a: Intervalo, b: Intervalo): boolean {
  return a.inicio.getTime() < b.fin.getTime() && a.fin.getTime() > b.inicio.getTime();
}

/** `fecha` dentro de [hoy, hoy + diasMax] (comparación lexicográfica YYYY-MM-DD). */
export function fechaEnVentana(fecha: string, hoy: string, diasMax: number): boolean {
  return fecha >= hoy && fecha <= sumarDias(hoy, diasMax);
}

/** Primer instante reservable: ahora + antelación mínima. */
export function limiteAntelacion(ahora: Date, antelacionMin: number): Date {
  return sumarMinutos(ahora, antelacionMin);
}

export type GenerarFranjasParams = {
  fecha: string;
  apertura: string;
  cierre: string;
  duracionMin: number;
  intervaloMin: number;
  tz: string;
  ocupadas: Intervalo[];
  ahora: Date;
  antelacionMin: number;
};

/**
 * Candidatos `apertura + k·intervalo` mientras `inicio + duración <= cierre`.
 * `disponible = false` si se solapa con una cita ocupada o empieza antes de
 * `ahora + antelación`.
 */
export function generarFranjas(p: GenerarFranjasParams): Franja[] {
  const aperturaMin = minutosDeHora(p.apertura);
  const cierreMin = minutosDeHora(p.cierre);
  const limite = limiteAntelacion(p.ahora, p.antelacionMin).getTime();
  const franjas: Franja[] = [];

  for (let m = aperturaMin; m + p.duracionMin <= cierreMin; m += p.intervaloMin) {
    const hora = horaDeMinutos(m);
    const inicio = localAUtc(p.fecha, hora, p.tz);
    const fin = sumarMinutos(inicio, p.duracionMin);
    const ocupada = p.ocupadas.some((c) => seSolapa({ inicio, fin }, c));
    franjas.push({
      hora,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      disponible: !ocupada && inicio.getTime() >= limite,
    });
  }
  return franjas;
}

export type ValidarInicioParams = {
  inicio: Date;
  duracionMin: number;
  /** Horario del día local de `inicio`; `null` = día cerrado. */
  horario: TramoHorario | null;
  hoy: string;
  ahora: Date;
  tz: string;
  intervaloMin: number;
  antelacionMin: number;
  diasMaxAnticipacion: number;
};

/** Día local (y su día de la semana) al que pertenece un instante. */
export function diaLocalDe(inicio: Date, tz: string): { fecha: string; hora: string; dia: number } {
  const { fecha, hora } = utcALocal(inicio, tz);
  return { fecha, hora, dia: diaSemana(fecha) };
}

/**
 * Valida que `inicio` sea una franja reservable. Devuelve el motivo del
 * rechazo (mensaje para el cliente) o `null` si es válida.
 */
export function validarInicio(p: ValidarInicioParams): string | null {
  if (p.inicio.getUTCSeconds() !== 0 || p.inicio.getUTCMilliseconds() !== 0) {
    return "La hora de inicio no puede tener segundos";
  }

  const { fecha, hora } = utcALocal(p.inicio, p.tz);
  if (!fechaEnVentana(fecha, p.hoy, p.diasMaxAnticipacion)) {
    return `Solo se puede reservar desde hoy hasta ${p.diasMaxAnticipacion} días`;
  }

  if (p.inicio.getTime() < limiteAntelacion(p.ahora, p.antelacionMin).getTime()) {
    return "La franja ya pasó o está demasiado próxima";
  }

  if (!p.horario) {
    return "La barbería no atiende ese día";
  }

  const horaMin = minutosDeHora(hora);
  const aperturaMin = minutosDeHora(p.horario.apertura);
  const cierreMin = minutosDeHora(p.horario.cierre);
  if (horaMin < aperturaMin || horaMin + p.duracionMin > cierreMin) {
    return "Fuera del horario de atención";
  }

  if ((horaMin - aperturaMin) % p.intervaloMin !== 0) {
    return "Hora no válida para el calendario";
  }

  return null;
}
