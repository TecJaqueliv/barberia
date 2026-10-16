import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { SiteNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          aria-label="Barbería - ir al inicio"
          className="inline-flex items-center rounded"
        >
          <Image
            src="/logo.svg"
            alt="Logo de Barbería"
            width={200}
            height={48}
            unoptimized
            preload
            className="h-8 w-auto sm:h-10"
          />
        </Link>
        <Suspense fallback={null}>
          <SiteNav />
        </Suspense>
      </div>
    </header>
  );
}
