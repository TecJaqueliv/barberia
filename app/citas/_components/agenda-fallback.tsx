import { cardClasses } from "@/app/_components/card";

const placeholder = "rounded-xl bg-surface-hover animate-pulse motion-reduce:animate-none";

/** Esqueleto mientras se carga la agenda. */
export function AgendaFallback() {
  return (
    <div aria-busy="true" className={`flex flex-col gap-4 ${cardClasses}`}>
      <p className="text-muted">Cargando agenda…</p>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
        <div className={`h-20 ${placeholder}`} />
        <div className={`h-20 ${placeholder}`} />
      </div>
      <div aria-hidden="true" className={`h-64 ${placeholder}`} />
    </div>
  );
}
