import { cacheLife } from "next/cache";
import Link from "next/link";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Barbería edTeams</p>
          <p className="text-sm text-muted">Cortes clásicos y estilo moderno, con atención de siempre.</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Horario</p>
          <p className="text-sm text-muted">Lun–Sáb 9:00–20:00</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Enlaces</p>
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <Link href="/precios" className="text-muted transition-colors hover:text-foreground">
                Precios
              </Link>
            </li>
            <li>
              <Link href="/citas" className="text-muted transition-colors hover:text-foreground">
                Agendar cita
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-muted sm:px-6">
          © <CurrentYear /> Barbería edTeams
        </p>
      </div>
    </footer>
  );
}
