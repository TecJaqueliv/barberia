import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">hola edteams</h1>
      <Link
        href="/clientes"
        className="rounded border border-current/20 px-4 py-2 hover:bg-foreground/5"
      >
        Gestionar clientes
      </Link>
    </main>
  );
}
