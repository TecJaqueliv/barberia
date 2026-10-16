"use client";

import { useState, type FormEvent, type Ref } from "react";

import {
  ApiClientError,
  createCliente,
  mensajeAmigable,
  updateCliente,
} from "@/lib/client/clientes";
import type { Cliente } from "@/lib/types/cliente";
import { buttonClasses } from "@/app/_components/button";
import { cardClasses } from "@/app/_components/card";

type Campo = "nombre" | "correo" | "telefono" | "detalle";
type Values = Record<Campo, string>;

type Props = {
  cliente: Cliente | null;
  onSaved: (c: Cliente, modo: "crear" | "editar") => void;
  /** Sale del modo edición; `aviso` opcional para mostrar en la lista (p. ej. 404). */
  onCancel: (aviso?: string) => void;
  ref?: Ref<HTMLFormElement>;
};

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-2/60 aria-[invalid=true]:border-red-400";

function valoresIniciales(cliente: Cliente | null): Values {
  return {
    nombre: cliente?.nombre ?? "",
    correo: cliente?.correo ?? "",
    telefono: cliente?.telefono ?? "",
    detalle: cliente?.detalle ?? "",
  };
}

export function ClienteForm({ cliente, onSaved, onCancel, ref }: Props) {
  const [values, setValues] = useState<Values>(() => valoresIniciales(cliente));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const modo = cliente ? "editar" : "crear";

  function setCampo(campo: Campo, valor: string) {
    setValues((v) => ({ ...v, [campo]: valor }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const guardado = cliente
        ? await updateCliente(cliente.id, values)
        : await createCliente(values);
      if (!cliente) setValues(valoresIniciales(null));
      onSaved(guardado, modo);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        setFieldErrors(err.fieldErrors);
        setFormError(err.formErrors[0] ?? null);
      } else if (err instanceof ApiClientError && err.code === "CORREO_DUPLICADO") {
        setFieldErrors({ correo: [err.message] });
      } else if (err instanceof ApiClientError && err.code === "NOT_FOUND") {
        onCancel(mensajeAmigable(err));
      } else {
        setFormError(mensajeAmigable(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function campoProps(campo: Campo) {
    const error = fieldErrors[campo]?.[0];
    return {
      id: `cliente-${campo}`,
      name: campo,
      value: values[campo],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `cliente-${campo}-error` : undefined,
    };
  }

  function errorDe(campo: Campo) {
    const error = fieldErrors[campo]?.[0];
    if (!error) return null;
    return (
      <p id={`cliente-${campo}-error`} className="text-sm text-red-400">
        {error}
      </p>
    );
  }

  return (
    <form
      ref={ref}
      onSubmit={handleSubmit}
      className={`flex flex-col gap-4 ${cardClasses}`}
      aria-labelledby="cliente-form-titulo"
    >
      <h2 id="cliente-form-titulo" className="text-lg font-semibold">
        {cliente ? "Editar cliente" : "Nuevo cliente"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="cliente-nombre" className="text-sm font-medium">
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
          <label htmlFor="cliente-correo" className="text-sm font-medium">
            Correo
          </label>
          <input
            {...campoProps("correo")}
            type="email"
            maxLength={254}
            autoComplete="email"
            onChange={(e) => setCampo("correo", e.target.value)}
            className={inputClass}
          />
          {errorDe("correo")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cliente-telefono" className="text-sm font-medium">
            Teléfono
          </label>
          <input
            {...campoProps("telefono")}
            type="tel"
            maxLength={20}
            autoComplete="tel"
            onChange={(e) => setCampo("telefono", e.target.value)}
            className={inputClass}
          />
          {errorDe("telefono")}
        </div>

        <p className="self-end text-sm text-muted">Indica al menos correo o teléfono.</p>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="cliente-detalle" className="text-sm font-medium">
            Detalle
          </label>
          <textarea
            {...campoProps("detalle")}
            maxLength={1000}
            rows={3}
            onChange={(e) => setCampo("detalle", e.target.value)}
            className={inputClass}
          />
          {errorDe("detalle")}
        </div>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-400">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className={buttonClasses({ variant: "primary", size: "md" })}
        >
          {submitting ? "Guardando…" : cliente ? "Guardar cambios" : "Crear cliente"}
        </button>
        {cliente && (
          <button
            type="button"
            onClick={() => onCancel()}
            disabled={submitting}
            className={buttonClasses({ variant: "secondary", size: "md" })}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
