"use client";

import type { Disponibilidad, Franja } from "@/lib/types/cita";
import { buttonClasses } from "@/app/_components/button";

import { etiquetaFechaLarga, formatearDuracion } from "../_lib/fechas";

type Props = {
  fecha: string | null;
  servicioElegido: boolean;
  status: "idle" | "loading" | "ready" | "error";
  disp: Disponibilidad | null;
  error: string | null;
  value: Franja | null;
  onChange: (f: Franja) => void;
  onReintentar: () => void;
};

const placeholder = "h-11 rounded-xl bg-surface-hover animate-pulse motion-reduce:animate-none";

export function FranjasHorarias({
  fecha,
  servicioElegido,
  status,
  disp,
  error,
  value,
  onChange,
  onReintentar,
}: Props) {
  if (!servicioElegido || !fecha) {
    return (
      <p className="text-muted">Elige un servicio y un día para ver los horarios disponibles.</p>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <p className="text-muted">Buscando horarios…</p>
        <div aria-hidden="true" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={placeholder} />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-red-400/40 bg-red-400/10 p-4"
      >
        <p>{error ?? "Ocurrió un error inesperado."}</p>
        <button
          type="button"
          onClick={onReintentar}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!disp) return null;

  if (disp.cerrado) {
    return <p className="text-muted">La barbería no atiende este día. Elige otra fecha.</p>;
  }

  const libres = disp.franjas.filter((f) => f.disponible);
  if (libres.length === 0) {
    return (
      <p className="text-muted">No quedan horarios libres para este día. Prueba con otra fecha.</p>
    );
  }

  const grupos = [
    { titulo: "Mañana", franjas: libres.filter((f) => f.hora < "12:00") },
    { titulo: "Tarde", franjas: libres.filter((f) => f.hora >= "12:00") },
  ].filter((g) => g.franjas.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {etiquetaFechaLarga(fecha)} · {disp.servicio.nombre} (
        {formatearDuracion(disp.servicio.duracion_min)})
      </p>
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Horario</legend>
        {grupos.map((g) => (
          <div key={g.titulo} className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">{g.titulo}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {g.franjas.map((f) => (
                <label key={f.inicio} className="cursor-pointer">
                  <input
                    type="radio"
                    name="franja"
                    value={f.inicio}
                    checked={value?.inicio === f.inicio}
                    onChange={() => onChange(f)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-background text-sm font-medium tabular-nums transition-colors hover:bg-surface-hover peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-2">
                    {f.hora}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
