"use client";

import type { Cliente } from "@/lib/types/cliente";

type Props = {
  clientes: Cliente[];
  onEdit: (c: Cliente) => void;
  onDelete: (c: Cliente) => void;
  deletingId: string | null;
};

export function ClientesList({ clientes, onEdit, onDelete, deletingId }: Props) {
  return (
    <ul className="flex flex-col divide-y divide-current/20 rounded border border-current/20">
      {clientes.map((c) => {
        const eliminando = deletingId === c.id;
        return (
          <li
            key={c.id}
            className="flex flex-col gap-3 p-4 sm:grid sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold break-words">{c.nombre}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
                <dt className="opacity-70">Correo:</dt>
                <dd className="min-w-0 break-all">{c.correo ?? "—"}</dd>
                <dt className="opacity-70">Teléfono:</dt>
                <dd className="min-w-0 break-all">{c.telefono ?? "—"}</dd>
              </dl>
              {c.detalle && (
                <p className="line-clamp-2 text-sm break-words opacity-80">{c.detalle}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(c)}
                aria-label={`Editar a ${c.nombre}`}
                className="rounded border border-current/20 px-3 py-1.5 text-sm hover:bg-foreground/5"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete(c)}
                disabled={eliminando}
                aria-label={`Eliminar a ${c.nombre}`}
                className="rounded border border-red-400/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-50"
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
