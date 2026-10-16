import type { ReactNode } from "react";

import { ButtonLink } from "./_components/button";
import { Card } from "./_components/card";

function Icon({ children, className }: { children: ReactNode; className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-7 w-7 ${className}`}
    >
      {children}
    </svg>
  );
}

const SERVICIOS = [
  {
    titulo: "Corte clásico",
    descripcion: "Tijera y máquina, adaptado a tu estilo y tipo de cabello.",
    icono: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
      </>
    ),
    color: "text-accent",
  },
  {
    titulo: "Arreglo de barba",
    descripcion: "Perfilado y recorte para una barba definida y cuidada.",
    icono: (
      <>
        <path d="M5 8c0 7 3 12 7 12s7-5 7-12" />
        <path d="M9 13c1 .7 2 1 3 1s2-.3 3-1" />
      </>
    ),
    color: "text-accent-2",
  },
  {
    titulo: "Afeitado con toalla caliente",
    descripcion: "El ritual clásico: toalla caliente, navaja y bálsamo.",
    icono: (
      <>
        <path d="M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4M16 3c-1 1.5 1 2.5 0 4" />
        <rect x="4" y="10" width="16" height="10" rx="2" />
      </>
    ),
    color: "text-accent",
  },
  {
    titulo: "Corte + barba",
    descripcion: "El combo completo para salir renovado de pies a cabeza.",
    icono: (
      <>
        <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
      </>
    ),
    color: "text-accent-2",
  },
];

const RAZONES = [
  {
    titulo: "Barberos expertos",
    texto: "Años de oficio y formación constante en técnicas clásicas y actuales.",
    icono: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
  },
  {
    titulo: "Reserva en minutos",
    texto: "Elige servicio, día y hora en línea, sin llamadas ni esperas.",
    icono: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18M9 16l2 2 4-4" />
      </>
    ),
  },
  {
    titulo: "Ambiente cómodo",
    texto: "Un espacio relajado para desconectar mientras te atendemos.",
    icono: (
      <>
        <path d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4" />
        <path d="M3 13a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3z" />
        <path d="M6 18v2M18 18v2" />
      </>
    ),
  },
];

export default function Home() {
  return (
    <main id="contenido" className="flex-1">
      <section aria-labelledby="hero-titulo" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.14),transparent_55%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-24">
          <p className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted">
            Barbería clásica · estilo moderno
          </p>
          <h1
            id="hero-titulo"
            className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Tu mejor versión empieza en nuestra silla
          </h1>
          <p className="max-w-2xl text-lg text-muted">
            Cortes, barba y afeitado clásico con el cuidado que mereces. Reserva tu turno en línea
            y llega directo a la silla.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/citas" variant="primary" size="lg" className="w-full sm:w-auto">
              Agenda tu cita
            </ButtonLink>
            <ButtonLink href="/precios" variant="secondary" size="lg" className="w-full sm:w-auto">
              Ver precios
            </ButtonLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="servicios-titulo" className="py-16 sm:py-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
          <div className="flex flex-col gap-2">
            <h2 id="servicios-titulo" className="text-3xl font-bold tracking-tight">
              Nuestros servicios
            </h2>
            <p className="text-muted">Todo lo que necesitas para lucir impecable.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map((s) => (
              <Card as="li" key={s.titulo} className="flex flex-col gap-3">
                <Icon className={s.color}>{s.icono}</Icon>
                <h3 className="text-lg font-semibold">{s.titulo}</h3>
                <p className="text-sm text-muted">{s.descripcion}</p>
              </Card>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="porque-titulo" className="border-y border-border bg-surface/50 py-16 sm:py-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
          <h2 id="porque-titulo" className="text-3xl font-bold tracking-tight">
            Por qué elegirnos
          </h2>
          <ul className="grid gap-8 sm:grid-cols-3">
            {RAZONES.map((r) => (
              <li key={r.titulo} className="flex flex-col gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
                  <Icon className="text-accent">{r.icono}</Icon>
                </span>
                <h3 className="text-lg font-semibold">{r.titulo}</h3>
                <p className="text-muted">{r.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="cta-titulo" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Card className="flex flex-col items-start gap-6 border-accent/40! sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <h2 id="cta-titulo" className="text-2xl font-bold tracking-tight sm:text-3xl">
                ¿Listo para tu próximo corte?
              </h2>
              <p className="text-muted">Reserva en menos de un minuto y te esperamos.</p>
            </div>
            <ButtonLink href="/citas" variant="primary" size="lg" className="w-full sm:w-auto">
              Agenda tu cita
            </ButtonLink>
          </Card>
        </div>
      </section>
    </main>
  );
}
