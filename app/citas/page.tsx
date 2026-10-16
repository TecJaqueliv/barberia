import type { Metadata } from "next";
import { Suspense } from "react";

import { AgendaCitas } from "./_components/agenda-citas";
import { AgendaFallback } from "./_components/agenda-fallback";

export const metadata: Metadata = {
  title: "Agenda tu cita",
  description: "Elige servicio, día y hora y reserva tu cita en la Barbería edTeams.",
};

export default function CitasPage() {
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Agenda tu cita</h1>
        <p className="text-muted">
          Elige el servicio, el día y la hora que prefieras. Te toma menos de un minuto.
        </p>
      </header>
      <Suspense fallback={<AgendaFallback />}>
        <AgendaCitas />
      </Suspense>
    </main>
  );
}
