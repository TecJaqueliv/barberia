"use client";

import { useEffect, useRef, useState } from "react";

import {
  ApiClientError,
  deleteCliente,
  listClientes,
  mensajeAmigable,
} from "@/lib/client/clientes";
import type { Cliente } from "@/lib/types/cliente";
import { buttonClasses } from "@/app/_components/button";
import { cardClasses } from "@/app/_components/card";

import { ClienteForm } from "./cliente-form";
import { ClientesList } from "./clientes-list";

const LIMIT = 20;

type Status = "loading" | "ready" | "error";
type Notice = { tipo: "ok" | "error"; texto: string };

export function ClientesManager() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Se incrementa para forzar una recarga con los mismos filtros.
  const [reloadKey, setReloadKey] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);

  // Carga de la lista; las respuestas obsoletas se cancelan con AbortController.
  useEffect(() => {
    const controller = new AbortController();
    listClientes({ q: debouncedQuery, limit: LIMIT, offset }, { signal: controller.signal })
      .then((res) => {
        // Si la página quedó vacía (p. ej. tras eliminar), retrocede una página.
        if (res.data.length === 0 && offset > 0 && res.meta.total > 0) {
          setOffset(Math.max(0, offset - LIMIT));
          return;
        }
        setClientes(res.data);
        setTotal(res.meta.total);
        setLoadError(null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(mensajeAmigable(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [debouncedQuery, offset, reloadKey]);

  // Debounce de la búsqueda: aplica el texto y vuelve a la primera página.
  useEffect(() => {
    if (query === debouncedQuery) return;
    const t = setTimeout(() => {
      setStatus("loading");
      setDebouncedQuery(query);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query, debouncedQuery]);

  function cargar() {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }

  function irAOffset(nuevo: number) {
    setStatus("loading");
    setOffset(nuevo);
  }

  function handleSaved(_c: Cliente, modo: "crear" | "editar") {
    setEditing(null);
    setNotice({ tipo: "ok", texto: modo === "crear" ? "Cliente creado" : "Cliente actualizado" });
    cargar();
  }

  function handleCancel(aviso?: string) {
    setEditing(null);
    if (aviso) {
      setNotice({ tipo: "error", texto: aviso });
      cargar();
    }
  }

  function handleEdit(c: Cliente) {
    setNotice(null);
    setEditing(c);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete(c: Cliente) {
    if (!window.confirm(`¿Eliminar a ${c.nombre}? Esta acción no se puede deshacer.`)) return;
    setDeletingId(c.id);
    setNotice(null);
    try {
      await deleteCliente(c.id);
      if (editing?.id === c.id) setEditing(null);
      setNotice({ tipo: "ok", texto: "Cliente eliminado" });
      cargar();
    } catch (err) {
      setNotice({ tipo: "error", texto: mensajeAmigable(err) });
      if (err instanceof ApiClientError && err.code === "NOT_FOUND") cargar();
    } finally {
      setDeletingId(null);
    }
  }

  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + clientes.length, total);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar clientes"
          placeholder="Buscar por nombre, correo o teléfono"
          maxLength={100}
          className="w-full rounded-xl border border-border bg-surface py-2.5 pr-4 pl-10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-2/60"
        />
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <ClienteForm
          key={editing?.id ?? "nuevo"}
          ref={formRef}
          cliente={editing}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />

        <div className="flex flex-col gap-4">
          <div role="status" className="min-h-6 text-sm">
            {notice && (
              <p className={notice.tipo === "ok" ? "text-green-400" : "text-red-400"}>
                {notice.texto}
              </p>
            )}
          </div>

          <section aria-labelledby="clientes-lista-titulo" className="flex flex-col gap-4">
            <h2 id="clientes-lista-titulo" className="text-lg font-semibold">
              Listado
            </h2>

            {status === "loading" && (
              <p aria-busy="true" className={`${cardClasses} text-center text-muted`}>
                Cargando clientes…
              </p>
            )}

            {status === "error" && (
              <div
                role="alert"
                className="flex flex-col items-start gap-3 rounded-xl border border-red-400/40 bg-red-400/10 p-4"
              >
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={cargar}
                  className={buttonClasses({ variant: "secondary", size: "md" })}
                >
                  Reintentar
                </button>
              </div>
            )}

            {status === "ready" && clientes.length === 0 && (
              <p className={`${cardClasses} text-center text-muted`}>
                {debouncedQuery.trim()
                  ? `No hay clientes que coincidan con «${debouncedQuery.trim()}»`
                  : "Aún no hay clientes registrados."}
              </p>
            )}

            {status === "ready" && clientes.length > 0 && (
              <>
                <ClientesList
                  clientes={clientes}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
                <nav
                  aria-label="Paginación"
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <p className="text-muted">
                    Mostrando {desde}–{hasta} de {total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => irAOffset(Math.max(0, offset - LIMIT))}
                      disabled={offset === 0}
                      className={buttonClasses({ variant: "secondary", size: "sm" })}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => irAOffset(offset + LIMIT)}
                      disabled={offset + LIMIT >= total}
                      className={buttonClasses({ variant: "secondary", size: "sm" })}
                    >
                      Siguiente
                    </button>
                  </div>
                </nav>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
