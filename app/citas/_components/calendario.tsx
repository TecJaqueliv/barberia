"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { diaSemana, sumarDias } from "@/lib/agenda/tiempo";
import type { Horario } from "@/lib/types/servicio";
import { buttonClasses } from "@/app/_components/button";

import {
  DIAS_CORTOS,
  DIAS_LARGOS,
  clampFecha,
  etiquetaFechaLarga,
  etiquetaMes,
  finSemana,
  inicioSemana,
  mesDe,
  moverFechaMismoDia,
  primerDiaMes,
  semanasDelMes,
  sumarMeses,
  ultimoDiaMes,
} from "../_lib/fechas";

type Props = {
  horario: Horario;
  value: string | null;
  onChange: (fecha: string) => void;
  /** Sin servicio elegido: el calendario se ve, pero no permite seleccionar. */
  disabled?: boolean;
};

function primeraHabil(horario: Horario, esHabil: (f: string) => boolean): string | null {
  for (let f = horario.hoy; f <= horario.fecha_max; f = sumarDias(f, 1)) {
    if (esHabil(f)) return f;
  }
  return null;
}

export function Calendario({ horario, value, onChange, disabled = false }: Props) {
  const { hoy, fecha_max } = horario;

  function esHabil(f: string): boolean {
    if (f < hoy || f > fecha_max) return false;
    const dia = horario.dias.find((d) => d.dia_semana === diaSemana(f));
    return dia ? !dia.cerrado : false;
  }

  const mesMin = mesDe(hoy);
  const mesMax = mesDe(fecha_max);
  const min = primerDiaMes(mesMin);
  const max = ultimoDiaMes(mesMax);

  const [foco, setFoco] = useState<string>(() => value ?? primeraHabil(horario, esHabil) ?? hoy);
  const [mes, setMes] = useState<string>(() => mesDe(foco));

  const refs = useRef(new Map<string, HTMLButtonElement>());
  const debeEnfocar = useRef(false);

  useEffect(() => {
    if (!debeEnfocar.current) return;
    debeEnfocar.current = false;
    refs.current.get(foco)?.focus();
  }, [foco]);

  function irA(nueva: string, enfocar: boolean) {
    const f = clampFecha(nueva, min, max);
    if (mesDe(f) !== mes) setMes(mesDe(f));
    debeEnfocar.current = enfocar;
    setFoco(f);
  }

  function cambiarMes(delta: number) {
    const nuevoMes = sumarMeses(mes, delta);
    if (nuevoMes < mesMin || nuevoMes > mesMax) return;
    setMes(nuevoMes);
    const base = mesDe(foco) === mes ? foco : primerDiaMes(mes);
    setFoco(clampFecha(moverFechaMismoDia(base, delta), min, max));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTableSectionElement>) {
    let nueva: string | null = null;
    switch (e.key) {
      case "ArrowLeft":
        nueva = sumarDias(foco, -1);
        break;
      case "ArrowRight":
        nueva = sumarDias(foco, 1);
        break;
      case "ArrowUp":
        nueva = sumarDias(foco, -7);
        break;
      case "ArrowDown":
        nueva = sumarDias(foco, 7);
        break;
      case "Home":
        nueva = inicioSemana(foco);
        break;
      case "End":
        nueva = finSemana(foco);
        break;
      case "PageUp":
        nueva = moverFechaMismoDia(foco, e.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        nueva = moverFechaMismoDia(foco, e.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    irA(nueva, true);
  }

  function seleccionar(f: string) {
    if (disabled || !esHabil(f)) return;
    setFoco(f);
    onChange(f);
  }

  const chevron = (d: string) => (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d={d} />
    </svg>
  );

  return (
    <div className="flex flex-col gap-4">
      {disabled && <p className="text-sm text-muted">Primero elige un servicio.</p>}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => cambiarMes(-1)}
          disabled={mes <= mesMin}
          aria-label="Mes anterior"
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          {chevron("M15 18l-6-6 6-6")}
        </button>
        <h3 id="cal-mes" aria-live="polite" className="font-semibold">
          {etiquetaMes(mes)}
        </h3>
        <button
          type="button"
          onClick={() => cambiarMes(1)}
          disabled={mes >= mesMax}
          aria-label="Mes siguiente"
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          {chevron("M9 18l6-6-6-6")}
        </button>
      </div>

      <p id="cal-ayuda" className="sr-only">
        Usa las flechas para moverte entre días, Inicio y Fin para ir al comienzo o fin de semana,
        Re Pág y Av Pág para cambiar de mes.
      </p>

      <table
        role="grid"
        aria-labelledby="cal-mes"
        aria-describedby="cal-ayuda"
        className="w-full table-fixed border-collapse"
      >
        <thead>
          <tr>
            {DIAS_CORTOS.map((corto, i) => (
              <th
                key={corto}
                scope="col"
                abbr={DIAS_LARGOS[i]}
                className="pb-2 text-xs font-medium text-muted"
              >
                {corto}
              </th>
            ))}
          </tr>
        </thead>
        <tbody onKeyDown={handleKeyDown}>
          {semanasDelMes(mes).map((semana, i) => (
            <tr key={i}>
              {semana.map((f, j) => {
                if (!f) return <td key={`v-${j}`} aria-hidden="true" />;
                const habil = esHabil(f);
                const seleccionado = f === value;
                const esHoy = f === hoy;
                const estado = seleccionado
                  ? "bg-accent font-semibold text-white hover:bg-accent-hover"
                  : !habil
                    ? "cursor-not-allowed text-muted/50 line-through"
                    : "hover:bg-surface-hover";
                const anilloHoy = esHoy && !seleccionado ? "ring-1 ring-accent-2/60" : "";
                let label = etiquetaFechaLarga(f);
                if (esHoy) label += ", hoy";
                if (!habil) label += ", no disponible";
                return (
                  <td key={f} role="gridcell" aria-selected={seleccionado} className="p-0.5">
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) refs.current.set(f, el);
                        else refs.current.delete(f);
                      }}
                      tabIndex={f === foco ? 0 : -1}
                      aria-label={label}
                      aria-disabled={!habil || disabled ? true : undefined}
                      aria-current={esHoy ? "date" : undefined}
                      onClick={() => seleccionar(f)}
                      className={`mx-auto flex h-10 w-full max-w-12 items-center justify-center rounded-xl text-sm transition-colors sm:h-12 ${estado} ${anilloHoy} ${disabled && habil && !seleccionado ? "cursor-not-allowed" : ""}`}
                    >
                      {Number(f.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 rounded bg-accent" />
          Seleccionado
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 rounded ring-1 ring-accent-2/60" />
          Hoy
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-muted/50 line-through">
            12
          </span>
          No disponible
        </span>
      </div>
    </div>
  );
}
