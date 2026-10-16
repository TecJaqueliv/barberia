"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import type { CitaConServicio, Disponibilidad, Franja } from "@/lib/types/cita";
import type { Horario, Servicio } from "@/lib/types/servicio";
import { buttonClasses } from "@/app/_components/button";
import { cardClasses } from "@/app/_components/card";

import { getDisponibilidad, getHorario, getServicios, mensajeCitas } from "../_lib/citas-api";
import { etiquetaFechaLarga } from "../_lib/fechas";
import { AgendaFallback } from "./agenda-fallback";
import { Calendario } from "./calendario";
import { CitaConfirmacion } from "./cita-confirmacion";
import { CitaForm } from "./cita-form";
import { FranjasHorarias } from "./franjas-horarias";
import { ServicioSelector } from "./servicio-selector";

type BaseStatus = "loading" | "ready" | "error";
type DispStatus = "idle" | "loading" | "ready" | "error";
type Aviso = { tipo: "info" | "error"; texto: string };

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`paso-${n}-titulo`} className={`flex flex-col gap-4 ${cardClasses}`}>
      <h2 id={`paso-${n}-titulo`} className="flex items-center gap-3 text-lg font-semibold">
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm text-accent"
        >
          {n}
        </span>
        <span>
          <span className="sr-only">{n}. </span>
          {titulo}
        </span>
      </h2>
      {children}
    </section>
  );
}

export function AgendaCitas() {
  const searchParams = useSearchParams();
  // Solo se usa el parámetro inicial para preseleccionar; luego la URL la sincroniza la UI.
  const servicioParamRef = useRef(searchParams.get("servicio"));

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [horario, setHorario] = useState<Horario | null>(null);
  const [baseStatus, setBaseStatus] = useState<BaseStatus>("loading");
  const [baseError, setBaseError] = useState<string | null>(null);
  const [baseReload, setBaseReload] = useState(0);

  const [servicioId, setServicioId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [franja, setFranja] = useState<Franja | null>(null);

  const [disp, setDisp] = useState<Disponibilidad | null>(null);
  const [dispStatus, setDispStatus] = useState<DispStatus>("idle");
  const [dispError, setDispError] = useState<string | null>(null);
  const [dispReload, setDispReload] = useState(0);

  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [citaCreada, setCitaCreada] = useState<CitaConServicio | null>(null);

  // Carga base: servicios y horario.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([getServicios({ signal }), getHorario({ signal })])
      .then(([listaServicios, horarioApi]) => {
        setServicios(listaServicios);
        setHorario(horarioApi);
        setBaseError(null);
        setBaseStatus("ready");

        const param = servicioParamRef.current;
        const coincide = param
          ? (listaServicios.find((s) => s.id === param) ??
            listaServicios.find((s) => s.slug === param))
          : undefined;
        const preseleccion =
          coincide ?? (listaServicios.length === 1 ? listaServicios[0] : undefined);
        setServicioId((actual) => {
          if (actual && listaServicios.some((s) => s.id === actual)) return actual;
          return preseleccion?.id ?? null;
        });
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        setBaseError(mensajeCitas(err));
        setBaseStatus("error");
      });
    return () => controller.abort();
  }, [baseReload]);

  // Disponibilidad del día y servicio elegidos.
  useEffect(() => {
    if (!servicioId || !fecha) return;
    const controller = new AbortController();
    getDisponibilidad({ fecha, servicioId }, { signal: controller.signal })
      .then((res) => {
        setDisp(res);
        setDispError(null);
        setDispStatus("ready");
        const libres = res.cerrado ? 0 : res.franjas.filter((f) => f.disponible).length;
        setAviso((previo) => {
          // Se conserva un aviso de conflicto reciente (p. ej. 409) y se añade el recuento.
          const texto =
            libres === 0
              ? "No quedan horarios para este día. Prueba con otra fecha."
              : `${libres} ${libres === 1 ? "horario disponible" : "horarios disponibles"} para ${etiquetaFechaLarga(res.fecha)}.`;
          if (previo?.tipo === "error") return { tipo: "error", texto: `${previo.texto} ${texto}` };
          return { tipo: "info", texto };
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setDispError(mensajeCitas(err));
        setDispStatus("error");
      });
    return () => controller.abort();
  }, [servicioId, fecha, dispReload]);

  function recargarBase() {
    setBaseStatus("loading");
    setBaseReload((k) => k + 1);
  }

  function elegirServicio(id: string) {
    if (id === servicioId) return;
    setServicioId(id);
    setFranja(null);
    setDisp(null);
    setAviso(null);
    if (fecha) setDispStatus("loading");
    window.history.replaceState(null, "", `?servicio=${encodeURIComponent(id)}`);
  }

  function elegirFecha(f: string) {
    if (f === fecha) return;
    setFecha(f);
    setFranja(null);
    setDisp(null);
    setAviso(null);
    if (servicioId) setDispStatus("loading");
  }

  function elegirFranja(fr: Franja) {
    setFranja(fr);
    setAviso({ tipo: "info", texto: `Horario ${fr.hora} seleccionado. Completa tus datos.` });
  }

  function reintentarFranjas() {
    setDispStatus("loading");
    setDispReload((k) => k + 1);
  }

  function refrescarFranjas(texto: string) {
    setFranja(null);
    setAviso({ tipo: "error", texto });
    setDispStatus("loading");
    setDispReload((k) => k + 1);
  }

  function onCreada(cita: CitaConServicio) {
    setCitaCreada(cita);
    setAviso(null);
  }

  function nuevaCita() {
    setFecha(null);
    setFranja(null);
    setDisp(null);
    setCitaCreada(null);
    setAviso(null);
    setDispStatus("idle");
    recargarBase();
  }

  const servicio = servicios.find((s) => s.id === servicioId) ?? null;

  let contenido: ReactNode;
  if (baseStatus === "loading") {
    contenido = <AgendaFallback />;
  } else if (baseStatus === "error" || !horario) {
    contenido = (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-red-400/40 bg-red-400/10 p-4"
      >
        <p>{baseError ?? "Ocurrió un error inesperado."}</p>
        <p className="text-sm text-muted">
          Si el problema continúa, llámanos o acércate a la barbería.
        </p>
        <button
          type="button"
          onClick={recargarBase}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (servicios.length === 0) {
    contenido = (
      <p className={`${cardClasses} text-center text-muted`}>
        Por ahora no hay servicios disponibles para reservar en línea.
      </p>
    );
  } else if (citaCreada) {
    contenido = (
      <CitaConfirmacion cita={citaCreada} zonaHoraria={horario.zona_horaria} onNueva={nuevaCita} />
    );
  } else {
    contenido = (
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <Paso n={1} titulo="Elige el servicio">
            <ServicioSelector servicios={servicios} value={servicioId} onChange={elegirServicio} />
          </Paso>
          <Paso n={2} titulo="Elige el día">
            <Calendario
              horario={horario}
              value={fecha}
              onChange={elegirFecha}
              disabled={!servicioId}
            />
          </Paso>
        </div>
        <div className="flex flex-col gap-6">
          <Paso n={3} titulo="Elige la hora">
            <FranjasHorarias
              fecha={fecha}
              servicioElegido={Boolean(servicioId)}
              status={dispStatus}
              disp={disp}
              error={dispError}
              value={franja}
              onChange={elegirFranja}
              onReintentar={reintentarFranjas}
            />
          </Paso>
          <Paso n={4} titulo="Tus datos">
            <CitaForm
              servicio={servicio}
              fecha={fecha}
              franja={franja}
              onCreada={onCreada}
              onFranjaPerdida={refrescarFranjas}
            />
          </Paso>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="polite" className="min-h-6 text-sm">
        {aviso &&
          (aviso.tipo === "error" ? (
            <p className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-red-400">
              {aviso.texto}
            </p>
          ) : (
            <p className="text-muted">{aviso.texto}</p>
          ))}
      </div>
      {contenido}
    </div>
  );
}
