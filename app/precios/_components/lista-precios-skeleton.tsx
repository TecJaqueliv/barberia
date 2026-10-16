import { Card } from "../../_components/card";

const PLACEHOLDERS = [0, 1, 2, 3, 4, 5];

export function ListaPreciosSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Cargando precios…
      </p>
      <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDERS.map((i) => (
          <Card as="li" key={i} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="h-6 w-2/3 animate-pulse rounded bg-surface-hover" />
              <div className="h-6 w-20 animate-pulse rounded bg-surface-hover" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-full animate-pulse rounded bg-surface-hover" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-surface-hover" />
            </div>
            <div className="mt-auto flex items-center justify-between gap-4">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-hover" />
              <div className="h-8 w-24 animate-pulse rounded-full bg-surface-hover" />
            </div>
          </Card>
        ))}
      </ul>
    </>
  );
}
