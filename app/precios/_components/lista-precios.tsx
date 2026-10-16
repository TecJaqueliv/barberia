import { connection } from "next/server";

import { listServiciosActivos } from "@/lib/services/servicios";
import type { Servicio } from "@/lib/types/servicio";

import { ButtonLink } from "../../_components/button";
import { Card } from "../../_components/card";
import { formatearDuracion, formatearPrecio } from "./formato";

function IconoReloj() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-muted"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export async function ListaPrecios() {
  await connection();

  let servicios: Servicio[] | null = null;
  try {
    servicios = await listServiciosActivos();
  } catch (error) {
    console.error("[precios] No se pudieron cargar los servicios", error);
  }

  if (servicios === null) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <div role="alert" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            Nuestros precios estarán disponibles muy pronto
          </h2>
          <p className="text-muted">
            Estamos actualizando la lista de servicios. Mientras tanto, puedes agendar tu cita y te
            confirmamos el valor en la barbería.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/citas" variant="primary">
            Agenda tu cita
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Volver al inicio
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (servicios.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Aún no hay servicios publicados</h2>
          <p className="text-muted">Vuelve pronto para conocer nuestros servicios y precios.</p>
        </div>
        <ButtonLink href="/" variant="secondary">
          Volver al inicio
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicios.map((s) => (
          <Card as="li" key={s.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">{s.nombre}</h2>
              <p className="shrink-0 text-xl font-bold text-accent">{formatearPrecio(s.precio)}</p>
            </div>
            {s.descripcion?.trim() ? (
              <p className="text-sm text-muted">{s.descripcion}</p>
            ) : null}
            <div className="mt-auto flex items-center justify-between gap-4">
              <p className="flex items-center gap-1.5">
                <IconoReloj />
                <span className="text-sm text-muted">
                  <span className="sr-only">Duración: </span>
                  {formatearDuracion(s.duracion_min)}
                </span>
              </p>
              <ButtonLink
                href={`/citas?servicio=${encodeURIComponent(s.id)}`}
                size="sm"
                variant="primary"
                aria-label={`Agendar ${s.nombre}`}
              >
                Agendar
              </ButtonLink>
            </div>
          </Card>
        ))}
      </ul>
      <p className="text-sm text-muted">Precios en COP</p>
    </div>
  );
}
