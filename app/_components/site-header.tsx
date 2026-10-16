import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-current/20">
      <div className="mx-auto flex w-full max-w-4xl items-center p-4 sm:px-6">
        <Link
          href="/"
          aria-label="Barbería - ir al inicio"
          className="inline-flex items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
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
      </div>
    </header>
  );
}
