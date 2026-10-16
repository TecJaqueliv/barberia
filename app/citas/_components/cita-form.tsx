"use client";

import { useState, type FormEvent } from "react";

import { ApiClientError } from "@/lib/client/clientes";
import type { CitaConServicio, Franja } from "@/lib/types/cita";
import type { Servicio } from "@/lib/types/servicio";
import { buttonClasses } from "@/app/_components/button";

import { crearCita, mensajeCitas } from "../_lib/citas-api";
import { etiquetaFechaLarga, formatearPrecio } from "../_lib/fechas";

type Campo = "nombre" | "telefono" | "email" | "notas";
type Values = Record<Campo, string>;

type Props = {
  servicio: Servicio | null;
  /** Fecha civil elegida (solo para el resumen). */
  fecha: string | null;
  franja: Franja | null;
  onCreada: (c: CitaConServicio) => void;
  onFranjaPerdida: (mensaje: string) => void;
};

const CAMPOS: Campo[] = ["nombre", "telefono", "email", "notas"];

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-2/60 aria-[invalid=true]:border-red-400";

const VACIO: Values = { nombre: "", telefono: "", email: "", notas: "" };

export function CitaForm({ servicio, fecha, franja, onCreada, onFranjaPerdida }: Props) {
  const [values, setValues] = useState<Values>(VACIO);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const listo = Boolean(servicio && franja);

  function setCampo(campo: Campo, valor: string) {
    setValues((v) => ({ ...v, [campo]: valor }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!servicio || !franja || submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const cita = await crearCita({
        servicio_id: servicio.id,
        inicio: franja.inicio,
        nombre: values.nombre,
        telefono: values.telefono,
        email: values.email || null,
        notas: values.notas || null,
      });
      setValues(VACIO);
      onCreada(cita);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "FRANJA_NO_DISPONIBLE") {
        onFranjaPerdida(mensajeCitas(err));
      } else if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        const errorFranja = err.fieldErrors.inicio?.[0] ?? err.fieldErrors.servicio_id?.[0];
        if (errorFranja) {
          onFranjaPerdida(errorFranja);
        } else {
          setFieldErrors(err.fieldErrors);
          setFormError(err.formErrors[0] ?? null);
          const primero = CAMPOS.find((c) => err.fieldErrors[c]?.length);
          if (primero) document.getElementById(`cita-${primero}`)?.focus();
        }
      } else if (err instanceof ApiClientError && err.code === "LIMITE_CITAS_ALCANZADO") {
        setFieldErrors({ telefono: [mensajeCitas(err)] });
        document.getElementById("cita-telefono")?.focus();
      } else {
        setFormError(mensajeCitas(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function campoProps(campo: Campo, ayuda?: string) {
    const error = fieldErrors[campo]?.[0];
    const describedBy = [ayuda, error ? `cita-${campo}-error` : null].filter(Boolean).join(" ");
    return {
      id: `cita-${campo}`,
      name: campo,
      value: values[campo],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy || undefined,
    };
  }

  function errorDe(campo: Campo) {
    const error = fieldErrors[campo]?.[0];
    if (!error) return null;
    return (
      <p id={`cita-${campo}-error`} className="text-sm text-red-400">
        {error}
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="paso-4-titulo"
      aria-busy={submitting || undefined}
      className="flex flex-col gap-4"
    >
      {listo && servicio && franja ? (
        <p className="rounded-xl border border-border bg-background p-3 text-sm">
          {[
            servicio.nombre,
            fecha ? etiquetaFechaLarga(fecha).replace(/ de \d{4}$/, "") : null,
            franja.hora,
            formatearPrecio(servicio.precio),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : (
        <p id="cita-form-ayuda" className="text-sm text-muted">
          Elige un horario para continuar.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="cita-nombre" className="text-sm font-medium">
            Nombre
          </label>
          <input
            {...campoProps("nombre")}
            type="text"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            onChange={(e) => setCampo("nombre", e.target.value)}
            className={inputClass}
          />
          {errorDe("nombre")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cita-telefono" className="text-sm font-medium">
            Teléfono
          </label>
          <input
            {...campoProps("telefono", "cita-telefono-ayuda")}
            type="tel"
            required
            inputMode="tel"
            pattern="[0-9+\(\)\s\-]{7,20}"
            maxLength={20}
            autoComplete="tel"
            onChange={(e) => setCampo("telefono", e.target.value)}
            className={inputClass}
          />
          <p id="cita-telefono-ayuda" className="text-xs text-muted">
            Ej.: 300 123 4567
          </p>
          {errorDe("telefono")}
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="cita-email" className="text-sm font-medium">
            Correo (opcional)
          </label>
          <input
            {...campoProps("email")}
            type="email"
            maxLength={254}
            autoComplete="email"
            onChange={(e) => setCampo("email", e.target.value)}
            className={inputClass}
          />
          {errorDe("email")}
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="cita-notas" className="text-sm font-medium">
            Notas (opcional)
          </label>
          <textarea
            {...campoProps("notas", "cita-notas-contador")}
            rows={3}
            maxLength={500}
            onChange={(e) => setCampo("notas", e.target.value)}
            className={inputClass}
          />
          <p id="cita-notas-contador" className="self-end text-xs text-muted">
            {values.notas.length}/500
          </p>
          {errorDe("notas")}
        </div>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-400">
          {formError}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={submitting || !listo}
          aria-describedby={listo ? undefined : "cita-form-ayuda"}
          className={buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })}
        >
          {submitting ? "Reservando…" : "Confirmar cita"}
        </button>
      </div>
    </form>
  );
}
