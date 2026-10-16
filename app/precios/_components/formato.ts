const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Formatea un precio en pesos colombianos sin decimales (ej. "$ 25.000"). */
export function formatearPrecio(valor: number | string): string {
  return cop.format(Number(valor));
}

/** Duración legible: "30 min", "1 h", "1 h 15 min". */
export function formatearDuracion(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
