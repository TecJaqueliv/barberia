import type { Metadata } from "next";

import { ClientesManager } from "./_components/clientes-manager";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function ClientesPage() {
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted">Registra y gestiona la información de tus clientes.</p>
      </header>
      <ClientesManager />
    </main>
  );
}
