/**
 * Utilidades puras de fechas y zonas horarias (sin dependencias, sin BD).
 *
 * Convenciones:
 * - `fecha`: fecha civil "YYYY-MM-DD" en la zona indicada.
 * - `hora`:  hora civil "HH:MM" (24 h) en la zona indicada.
 * - Los instantes son `Date` (UTC).
 * No se asume ningún offset fijo: se calcula con `Intl.DateTimeFormat`.
 */

type PartesLocales = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

function partesEnZona(date: Date, tz: string): PartesLocales {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    // Algunos motores devuelven "24" para medianoche aun con h23.
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatFecha(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

function parseFecha(fecha: string): { y: number; m: number; d: number } {
  const [y, m, d] = fecha.split("-").map(Number);
  return { y, m, d };
}

/** "HH:MM" o "HH:MM:SS" -> minutos desde medianoche. */
export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde medianoche -> "HH:MM". */
export function horaDeMinutos(minutos: number): string {
  return `${pad2(Math.floor(minutos / 60))}:${pad2(minutos % 60)}`;
}

/** Recorta un `time` de Postgres ("HH:MM:SS") a "HH:MM". */
export function recortarHora(hora: string): string {
  return hora.slice(0, 5);
}

/** Fecha civil actual en la zona. */
export function hoyEnZona(tz: string, ahora: Date = new Date()): string {
  const p = partesEnZona(ahora, tz);
  return formatFecha(p.year, p.month, p.day);
}

/** Suma `n` días (puede ser negativo) a una fecha civil. */
export function sumarDias(fecha: string, n: number): string {
  const { y, m, d } = parseFecha(fecha);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return formatFecha(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Días entre dos fechas civiles (`hasta - desde`). */
export function diferenciaDias(desde: string, hasta: string): number {
  const a = parseFecha(desde);
  const b = parseFecha(hasta);
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000,
  );
}

/** Día de la semana de una fecha civil: 0 = domingo ... 6 = sábado. */
export function diaSemana(fecha: string): number {
  const { y, m, d } = parseFecha(fecha);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Offset (minutos) de la zona en el instante dado: local - UTC. */
function offsetMinutos(instante: Date, tz: string): number {
  const p = partesEnZona(instante, tz);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncado = Math.floor(instante.getTime() / 1000) * 1000;
  return Math.round((comoUtc - truncado) / 60_000);
}

/** Fecha y hora civiles en la zona -> instante UTC. */
export function localAUtc(fecha: string, hora: string, tz: string): Date {
  const { y, m, d } = parseFecha(fecha);
  const [h, mi] = hora.split(":").map(Number);
  const comoUtc = Date.UTC(y, m - 1, d, h, mi);

  // Primera aproximación con el offset en ese instante y re-verificación
  // (cubre cambios de horario de verano en zonas que los tengan).
  const off1 = offsetMinutos(new Date(comoUtc), tz);
  let t = comoUtc - off1 * 60_000;
  const off2 = offsetMinutos(new Date(t), tz);
  if (off2 !== off1) t = comoUtc - off2 * 60_000;
  return new Date(t);
}

/** Instante UTC -> fecha y hora civiles en la zona. */
export function utcALocal(date: Date, tz: string): { fecha: string; hora: string } {
  const p = partesEnZona(date, tz);
  return {
    fecha: formatFecha(p.year, p.month, p.day),
    hora: `${pad2(p.hour)}:${pad2(p.minute)}`,
  };
}

/** Suma minutos a un instante. */
export function sumarMinutos(date: Date, minutos: number): Date {
  return new Date(date.getTime() + minutos * 60_000);
}
