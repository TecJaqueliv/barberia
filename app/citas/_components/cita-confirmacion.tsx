"use client";

import { useEffect, useRef } from "react";

import { utcALocal } from "@/lib/agenda/tiempo";
import type { CitaConServicio } from "@/lib/types/cita";
import { ButtonLink, buttonClasses } from "@/app/_components/button";
import { cardClasses } from "@/app/_components/card";

import { etiquetaFechaLarga, formatearDuracion, formatearPrecio } from "../_lib/fechas";

type Props = {
  cita: CitaConServicio;
  zonaHoraria: string;
  onNueva: () => void;
};

export function CitaConfirmacion({ cita, zonaHoraria, onNueva }: Props) {
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  const { fecha, hora } = utcALocal(new Date(cita.inicio), zonaHoraria);
  const horaFin = utcALocal(new Date(cita.fin), zonaHoraria).hora;

  const filas: [string, string][] = [
    ["Servicio", cita.servicio.nombre],
    ["Fecha", etiquetaFechaLarga(fecha)],
    ["Hora", `${hora} – ${horaFin}`],
    ["Duración", formatearDuracion(cita.duracion_min)],
    ["Precio", formatearPrecio(cita.precio)],
    ["Nombre", cita.nombre],
    ["Teléfono", cita.telefono],
  ];
  if (cita.email) filas.push(["Correo", cita.email]);
  if (cita.notas) filas.push(["Notas", cita.notas]);

  return (
    <section
      aria-labelledby="confirmacion-titulo"
      className={`flex flex-col gap-5 ${cardClasses} border-accent/40`}
    >
      <div className="flex items-center gap-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 shrink-0 text-accent"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12.5l2.5 2.5L16 9.5" />
        </svg>
        <h2
          id="confirmacion-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight"
        >
          ¡Tu cita está confirmada!
        </h2>
      </div>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        {filas.map(([dt, dd]) => (
          <div key={dt} className="contents">
            <dt className="text-muted">{dt}</dt>
            <dd className="break-words">{dd}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted">
        Te esperamos. Si necesitas cambiar o cancelar tu cita, comunícate con la barbería.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onNueva}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          Agendar otra cita
        </button>
        <ButtonLink href="/" variant="ghost">
          Volver al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
