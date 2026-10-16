import type { Metadata } from "next";
import { Suspense } from "react";

import { ListaPrecios } from "./_components/lista-precios";
import { ListaPreciosSkeleton } from "./_components/lista-precios-skeleton";

export const metadata: Metadata = {
  title: "Precios",
  description: "Lista de precios de cortes, barba y afeitado. Agenda tu cita en línea.",
};

export default function PreciosPage() {
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Lista de precios</h1>
        <p className="text-muted">Elige tu servicio y reserva tu turno en línea.</p>
      </header>
      <Suspense fallback={<ListaPreciosSkeleton />}>
        <ListaPrecios />
      </Suspense>
    </main>
  );
}
