"use client";

import type { Cliente } from "@/lib/types/cliente";
import { buttonClasses } from "@/app/_components/button";
import { cardSurfaceClasses } from "@/app/_components/card";

type Props = {
  clientes: Cliente[];
  onEdit: (c: Cliente) => void;
  onDelete: (c: Cliente) => void;
  deletingId: string | null;
};

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function ClientesList({ clientes, onEdit, onDelete, deletingId }: Props) {
  return (
    <ul className={`flex flex-col divide-y divide-border overflow-hidden p-0 ${cardSurfaceClasses}`}>
      {clientes.map((c) => {
        const eliminando = deletingId === c.id;
        return (
          <li
            key={c.id}
            className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-hover sm:grid sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4"
          >
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
              >
                {iniciales(c.nombre)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-semibold break-words">{c.nombre}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
                  <dt className="text-muted">Correo:</dt>
                  <dd className="min-w-0 break-all">{c.correo ?? "—"}</dd>
                  <dt className="text-muted">Teléfono:</dt>
                  <dd className="min-w-0 break-all">{c.telefono ?? "—"}</dd>
                </dl>
                {c.detalle && (
                  <p className="line-clamp-2 text-sm break-words text-muted">{c.detalle}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(c)}
                aria-label={`Editar a ${c.nombre}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete(c)}
                disabled={eliminando}
                aria-label={`Eliminar a ${c.nombre}`}
                className={buttonClasses({ variant: "danger", size: "sm" })}
              >
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
