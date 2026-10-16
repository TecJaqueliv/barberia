import { diaSemana, sumarDias } from "@/lib/agenda/tiempo";
import { MONEDA } from "@/lib/config/agenda";

/**
 * Utilidades puras de calendario sobre fechas civiles "YYYY-MM-DD".
 * Los `Date` se construyen con `Date.UTC` y se formatean con `timeZone: "UTC"`
 * para que la zona del navegador nunca desplace el día.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

function partes(fecha: string): { y: number; m: number; d: number } {
  const [y, m, d] = fecha.split("-").map(Number);
  return { y, m, d: d ?? 1 };
}

function diasEnMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "YYYY-MM-DD" -> "YYYY-MM". */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

export function primerDiaMes(mes: string): string {
  return `${mes}-01`;
}

export function ultimoDiaMes(mes: string): string {
  const { y, m } = partes(mes);
  return `${mes}-${pad2(diasEnMes(y, m))}`;
}

/** Suma `n` meses a un "YYYY-MM". */
export function sumarMeses(mes: string, n: number): string {
  const { y, m } = partes(mes);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

/** Filas de 7 celdas (lunes a domingo); las celdas fuera del mes son `null`. */
export function semanasDelMes(mes: string): (string | null)[][] {
  const primero = primerDiaMes(mes);
  const ultimo = ultimoDiaMes(mes);
  const semanas: (string | null)[][] = [];
  let fila: (string | null)[] = Array.from({ length: (diaSemana(primero) + 6) % 7 }, () => null);
  for (let f = primero; f <= ultimo; f = sumarDias(f, 1)) {
    fila.push(f);
    if (fila.length === 7) {
      semanas.push(fila);
      fila = [];
    }
  }
  if (fila.length > 0) {
    while (fila.length < 7) fila.push(null);
    semanas.push(fila);
  }
  return semanas;
}

/** Lunes de la semana de `fecha`. */
export function inicioSemana(fecha: string): string {
  return sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
}

/** Domingo de la semana de `fecha`. */
export function finSemana(fecha: string): string {
  return sumarDias(inicioSemana(fecha), 6);
}

/** Mismo día del mes desplazado `meses`, recortado al último día si no existe. */
export function moverFechaMismoDia(fecha: string, meses: number): string {
  const { d } = partes(fecha);
  const mes = sumarMeses(mesDe(fecha), meses);
  const { y, m } = partes(mes);
  return `${mes}-${pad2(Math.min(d, diasEnMes(y, m)))}`;
}

export function clampFecha(fecha: string, min: string, max: string): string {
  if (fecha < min) return min;
  if (fecha > max) return max;
  return fecha;
}

const fmtMes = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const fmtFechaLarga = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function aDate(fecha: string): Date {
  const { y, m, d } = partes(fecha);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-10" -> "Octubre de 2026". */
export function etiquetaMes(mes: string): string {
  const texto = fmtMes.format(aDate(primerDiaMes(mes)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-10-20" -> "martes, 20 de octubre de 2026". */
export function etiquetaFechaLarga(fecha: string): string {
  return fmtFechaLarga.format(aDate(fecha));
}

export const DIAS_CORTOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"] as const;
export const DIAS_LARGOS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

const fmtPrecio = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: MONEDA,
  maximumFractionDigits: 0,
});

export function formatearPrecio(valor: number): string {
  return fmtPrecio.format(valor);
}

/** 30 -> "30 min"; 75 -> "1 h 15 min"; 60 -> "1 h". */
export function formatearDuracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
