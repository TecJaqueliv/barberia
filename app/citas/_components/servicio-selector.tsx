"use client";

import type { Servicio } from "@/lib/types/servicio";

import { formatearDuracion, formatearPrecio } from "../_lib/fechas";

type Props = {
  servicios: Servicio[];
  value: string | null;
  onChange: (id: string) => void;
};

export function ServicioSelector({ servicios, value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="sr-only">Servicio</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {servicios.map((s) => (
          <label key={s.id} className="cursor-pointer">
            <input
              type="radio"
              name="servicio"
              value={s.id}
              checked={value === s.id}
              onChange={() => onChange(s.id)}
              className="peer sr-only"
            />
            <span className="flex h-full flex-col gap-1 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-surface-hover peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-2">
              <span className="font-medium">{s.nombre}</span>
              <span className="text-sm text-muted">
                {formatearDuracion(s.duracion_min)} · {formatearPrecio(s.precio)}
              </span>
              {s.descripcion && <span className="text-sm text-muted">{s.descripcion}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
