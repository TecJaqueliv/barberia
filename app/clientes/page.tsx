import type { Metadata } from "next";
import Link from "next/link";

import { ClientesManager } from "./_components/clientes-manager";

export const metadata: Metadata = {
  title: "Clientes | edTeams",
};

export default function ClientesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm underline">
          ← Inicio
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">Clientes</h1>
      </header>
      <ClientesManager />
    </main>
  );
}
