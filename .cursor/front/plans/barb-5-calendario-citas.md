# BARB-5 — Calendario para autoagendar la cita (frontend)

## Objetivo
Crear la página pública `/citas` donde un cliente, sin ayuda del personal, elige servicio, día (calendario mensual propio y accesible), horario libre y deja sus datos para reservar, y ve una confirmación con el resumen. Consume la API ya implementada (`/api/servicios`, `/api/horario`, `/api/citas/disponibilidad`, `POST /api/citas`) con el diseño de BARB-4 (modo oscuro, acento rojo).

## Supuestos / dudas
- Sin dudas bloqueantes. Supuestos tomados:
- **Contrato**: el de `planifications/2026-10-16-citas-autoagendamiento.md` §4.6 y los tipos `lib/types/cita.ts` (`Franja`, `Disponibilidad`, `CitaConServicio`) y `lib/types/servicio.ts` (`Servicio`, `Horario`, `HorarioDia`). Éxito `{ data }`, error `{ error: { code, message, details?: { formErrors, fieldErrors } } }`.
- **"Tabla aún no existe"**: si falta la migración, Supabase falla y la API responde **500 `INTERNAL_ERROR`** genérico (no hay un código específico). El front trata cualquier 5xx de `/api/servicios` o `/api/horario` como "La agenda en línea no está disponible en este momento" + botón Reintentar. No se intenta distinguir más.
- **`?servicio=`**: se acepta el `id` (uuid) y, por tolerancia, también el `slug` (útil si `/precios` enlaza por slug). Si no coincide con ningún servicio activo se ignora (sin error) y no se preselecciona nada. Coordinación con el agente de `/precios`: puede enlazar `"/citas?servicio=" + servicio.id`.
- **Fechas**: "hoy" y `fecha_max` se toman SIEMPRE de `GET /api/horario` (`hoy`, `fecha_max`), nunca del reloj del navegador (la zona es `America/Bogota`). Días cerrados según `horario.dias[diaSemana(fecha)].cerrado`.
- **Semana**: el calendario empieza en **lunes** (convención es-CO). `dia_semana` de la API usa 0 = domingo; convertir con cuidado.
- **Franjas**: solo se muestran las `disponible: true`, agrupadas en "Mañana" (< 12:00) y "Tarde" (≥ 12:00), en formato 24 h `HH:MM` tal como llega en `hora`. El `inicio` que se envía en el POST es exactamente `franja.inicio` (ISO UTC recibido).
- **Moneda**: precio entero COP formateado con `Intl.NumberFormat("es-CO", { style: "currency", currency: MONEDA, maximumFractionDigits: 0 })`, `MONEDA` importado de `lib/config/agenda.ts` (archivo puro, apto para cliente).
- **Carga de datos en cliente** (mismo patrón que `app/clientes/_components/clientes-manager.tsx`: `fetch` a la API desde un Client Component con `AbortController`). No se usan `lib/services/*` ni `lib/supabase/*` (son `server-only`).
- **Helpers reutilizables de `lib/` (solo importar, no modificar)**: `ApiClientError` de `lib/client/clientes.ts`; `sumarDias`, `diaSemana`, `utcALocal` de `lib/agenda/tiempo.ts` (sin imports, puro); `MONEDA`, `MAX_CITAS_FUTURAS_POR_TELEFONO` de `lib/config/agenda.ts`; tipos de `lib/types/*` y `ApiErrorCode` (type-only) de `lib/api/responses.ts`. No importar `lib/validations/cita.ts` en cliente (arrastra zod y lógica de servidor sin necesidad); la validación del formulario es la nativa de HTML + la del servidor.
- **No se crea** helper de API en `lib/` (restricción: no tocar `lib`). El cliente HTTP de citas vive en `app/citas/_lib/`.
- **Restricciones**: no tocar `app/precios`, `app/api`, `lib`, `supabase`, `app/_components/*`, `app/globals.css`, `app/layout.tsx`, `next.config.ts`, `package.json`. No añadir dependencias. No hacer commit ni push. El header (`site-nav.tsx`) y la home ya enlazan a `/citas`: no cambian.
- **Next 16 + Cache Components** (verificado en `node_modules/next/dist/docs/01-app/`):
  - `03-api-reference/04-functions/use-search-params.md`: en una ruta prerenderizada, `useSearchParams` en un Client Component **debe** ir dentro de un `<Suspense>`; si no, `next build` falla ("Missing Suspense boundary with useSearchParams" / `blocking-prerender-client-hook`). Se usa `useSearchParams` dentro de `<Suspense>` en `page.tsx` (la cabecera de la página queda en el shell estático).
  - `03-api-reference/03-file-conventions/page.md`: `searchParams` del page es una `Promise` (Request-time API). NO se usa en `page.tsx` para no volver dinámico todo el page; se lee en cliente con `useSearchParams`.
  - Metadata estática con `export const metadata: Metadata` en Server Component (`title` usa el template `"%s | Barbería edTeams"` del layout).
  - No llamar `new Date()` / `Date.now()` durante el render de Server Components (con `cacheComponents` rompe el prerender). En cliente, tampoco depender del reloj para la lógica de fechas.
  - Sincronizar `?servicio` en la URL con `window.history.replaceState` (Next integra el History API nativo con `useSearchParams`; ver `01-getting-started/04-linking-and-navigating.md`, sección "Native History API").
- **ESLint (react-hooks de eslint-config-next 16)**: no llamar `setState` de forma síncrona dentro de `useEffect` (regla `set-state-in-effect`); poner `setStatus("loading")` en los handlers que cambian las dependencias, como hace `clientes-manager.tsx`. No leer `ref.current` durante el render.

## Archivos
- Crear: `app/citas/page.tsx` — **Server Component**. Metadata, `<main id="contenido">`, encabezado y `<Suspense>` que envuelve el flujo.
- Crear: `app/citas/_lib/citas-api.ts` — módulo cliente-seguro (sin `"use client"`, sin `server-only`): `fetch` tipados a la API y `mensajeCitas(err)`.
- Crear: `app/citas/_lib/fechas.ts` — utilidades puras de calendario y formato (matriz del mes, etiquetas en español, formato de precio).
- Crear: `app/citas/_components/agenda-citas.tsx` — **Client Component** (`"use client"`). Orquesta estado, carga de datos, avisos `aria-live` y pasos.
- Crear: `app/citas/_components/servicio-selector.tsx` — **Client Component**. Paso 1, radios nativos.
- Crear: `app/citas/_components/calendario.tsx` — **Client Component**. Paso 2, calendario mensual con patrón ARIA grid y teclado.
- Crear: `app/citas/_components/franjas-horarias.tsx` — **Client Component**. Paso 3, radios nativos de horas.
- Crear: `app/citas/_components/cita-form.tsx` — **Client Component**. Paso 4, formulario y `POST /api/citas`.
- Crear: `app/citas/_components/cita-confirmacion.tsx` — **Client Component**. Paso 5, resumen de la cita creada.
- Crear: `app/citas/_components/agenda-fallback.tsx` — **Server Component** (sin `"use client"`). Esqueleto para el `fallback` de `<Suspense>`.
- Modificar: ninguno.

## Pasos de implementación

### 1. Cliente HTTP (`app/citas/_lib/citas-api.ts`)
1. Importar `ApiClientError` y `type RequestOptions` de `@/lib/client/clientes`; `type ApiErrorCode, ApiErrorDetails` de `@/lib/api/responses` (type-only); tipos `Servicio`, `Horario` de `@/lib/types/servicio` y `Disponibilidad`, `CitaConServicio` de `@/lib/types/cita`.
2. Función interna `request<T>(path, init?)` con el mismo comportamiento que `request` de `lib/client/clientes.ts` (copiar la lógica, ~30 líneas): headers JSON, `cache: "no-store"`, error de red → `ApiClientError(0, "NETWORK_ERROR", …)` salvo si `signal.aborted` (relanzar), body no JSON → `null`, `!res.ok` → `ApiClientError(status, error.code ?? "INTERNAL_ERROR", error.message ?? "Error interno del servidor", error.details)`.
3. Exportar:
   - `getServicios(options?: RequestOptions): Promise<Servicio[]>` → `GET /api/servicios`, devuelve `body.data`.
   - `getHorario(options?: RequestOptions): Promise<Horario>` → `GET /api/horario`.
   - `getDisponibilidad(params: { fecha: string; servicioId: string }, options?: RequestOptions): Promise<Disponibilidad>` → `GET /api/citas/disponibilidad?fecha=…&servicio_id=…` (con `URLSearchParams`).
   - `type CitaNueva = { servicio_id: string; inicio: string; nombre: string; telefono: string; email?: string | null; notas?: string | null }`.
   - `crearCita(input: CitaNueva): Promise<CitaConServicio>` → `POST /api/citas` con `JSON.stringify(input)`; enviar solo esas claves (la API es `strictObject`: claves extra → 400).
   - `mensajeCitas(err: unknown): string`:
     - no `ApiClientError` → "Ocurrió un error inesperado."
     - `NETWORK_ERROR` → "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo."
     - `status >= 500` / `INTERNAL_ERROR` → "La agenda en línea no está disponible en este momento. Inténtalo más tarde."
     - `FRANJA_NO_DISPONIBLE` → "Ese horario acaba de ser reservado por otra persona. Elige otro, por favor."
     - `LIMITE_CITAS_ALCANZADO` → `` `Ya tienes ${MAX_CITAS_FUTURAS_POR_TELEFONO} citas pendientes con este teléfono. No es posible reservar más por ahora.` `` (importar la constante de `@/lib/config/agenda`).
     - `VALIDATION_ERROR` / `INVALID_JSON` → `formErrors[0] ?? primer mensaje de fieldErrors ?? message`.
     - resto → `err.message`.

### 2. Utilidades de fechas y formato (`app/citas/_lib/fechas.ts`)
Funciones puras sobre cadenas `YYYY-MM-DD` (fecha civil); para construir `Date` usar siempre `new Date(Date.UTC(y, m - 1, d))` y formatear con `timeZone: "UTC"` para evitar desfases por la zona del navegador. Importar `sumarDias`, `diaSemana` de `@/lib/agenda/tiempo` y `MONEDA` de `@/lib/config/agenda`.
1. `mesDe(fecha: string): string` → `"YYYY-MM"`.
2. `primerDiaMes(mes: string): string` y `ultimoDiaMes(mes: string): string`.
3. `sumarMeses(mes: string, n: number): string` → `"YYYY-MM"`.
4. `semanasDelMes(mes: string): (string | null)[][]` → filas de 7 celdas **lunes→domingo**; celdas fuera del mes = `null`. Índice de columna = `(diaSemana(fecha) + 6) % 7`.
5. `inicioSemana(fecha)` / `finSemana(fecha)` → lunes / domingo de la semana de `fecha` (para Home/End).
6. `moverFechaMismoDia(fecha: string, meses: number): string` → mismo día en el mes destino, recortado al último día si no existe (31 → 30/28) (para PageUp/PageDown).
7. `clampFecha(fecha, min, max): string` (comparación lexicográfica de `YYYY-MM-DD`).
8. `etiquetaMes(mes)` → "octubre de 2026" (capitalizar primera letra: "Octubre de 2026") con `Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" })`.
9. `etiquetaFechaLarga(fecha)` → "martes, 20 de octubre de 2026" (`weekday: "long", day: "numeric", month: "long", year: "numeric"`).
10. `DIAS_CORTOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]` y `DIAS_LARGOS = ["lunes", …, "domingo"]` (para `<th abbr>`/`aria-label`).
11. `formatearPrecio(valor: number): string` con `Intl.NumberFormat("es-CO", { style: "currency", currency: MONEDA, maximumFractionDigits: 0 })`.
12. `formatearDuracion(min: number): string` → "30 min", "1 h 15 min".

### 3. Página (`app/citas/page.tsx`, Server Component)
1. `export const metadata: Metadata = { title: "Agenda tu cita", description: "Elige servicio, día y hora y reserva tu cita en la Barbería edTeams." }`.
2. Render (sin `async`, sin `searchParams`):
   - `<main id="contenido" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">` (mismo contenedor que `/clientes`).
   - `<header className="flex flex-col gap-2">` con `<h1 className="text-3xl font-bold tracking-tight">Agenda tu cita</h1>` y `<p className="text-muted">Elige el servicio, el día y la hora que prefieras. Te toma menos de un minuto.</p>`.
   - `<Suspense fallback={<AgendaFallback />}><AgendaCitas /></Suspense>` (`Suspense` de `react`).
3. `AgendaFallback` (`agenda-fallback.tsx`): bloque con `cardClasses`, `aria-busy="true"`, texto "Cargando agenda…" en `text-muted` y unos placeholders `animate-pulse motion-reduce:animate-none` (`bg-surface-hover rounded-xl`).

### 4. Orquestador (`app/citas/_components/agenda-citas.tsx`, Client Component)
1. `"use client"`; `export function AgendaCitas()`.
2. Estado:
   - `servicios: Servicio[]`, `horario: Horario | null`, `baseStatus: "loading" | "ready" | "error"`, `baseError: string | null`, `baseReload: number`.
   - `servicioId: string | null` — inicial vía inicializador de `useState` NO (los servicios aún no están): se resuelve al terminar la carga base (paso 4.3).
   - `fecha: string | null` (seleccionada), `franja: Franja | null`.
   - `disp: Disponibilidad | null`, `dispStatus: "idle" | "loading" | "ready" | "error"`, `dispError: string | null`, `dispReload: number`.
   - `aviso: { tipo: "info" | "error"; texto: string } | null` (región `aria-live`).
   - `citaCreada: CitaConServicio | null`.
3. Carga base (`useEffect` con deps `[baseReload]` y `AbortController`): `Promise.all([getServicios, getHorario])`. En `.then`: guardar datos, `baseStatus = "ready"`; resolver preselección leyendo `useSearchParams().get("servicio")` (capturado en una variable del render y usado dentro del `.then`): buscar por `id` y, si no, por `slug`; si coincide → `setServicioId(s.id)`. Si solo hay un servicio, preseleccionarlo. En `.catch` (ignorar si `aborted`): `baseError = mensajeCitas(err)`, `baseStatus = "error"`. El botón Reintentar hace `setBaseStatus("loading"); setBaseReload(k => k + 1)` en el handler.
   - Nota: incluir `servicioParam` en el cuerpo del efecto vía `useRef`/variable estable o añadirlo a deps; lo más simple: guardar `const servicioParam = searchParams.get("servicio")` y añadirlo a las deps del efecto (cambia solo si cambia la URL).
4. Carga de disponibilidad (`useEffect` con deps `[servicioId, fecha, dispReload]`): si falta `servicioId` o `fecha` → `return` (sin setState). Si no: `getDisponibilidad({ fecha, servicioId }, { signal })` → `.then` `setDisp`, `setDispStatus("ready")`, y `setAviso({ tipo: "info", texto: … })` con "N horarios disponibles para <etiquetaFechaLarga>" o "No quedan horarios para este día. Prueba con otra fecha." (también si `disp.cerrado`). `.catch` → `dispError = mensajeCitas(err)`, `dispStatus = "error"`. `setDispStatus("loading")` se hace en los handlers que cambian `servicioId`/`fecha`/`dispReload`, nunca dentro del efecto.
5. Handlers:
   - `elegirServicio(id)`: `setServicioId(id)`, `setFranja(null)`; si hay `fecha` → `setDispStatus("loading")`; sincronizar URL: `window.history.replaceState(null, "", "?servicio=" + encodeURIComponent(id))`.
   - `elegirFecha(f)`: `setFecha(f)`, `setFranja(null)`, `setDisp(null)`; si hay `servicioId` → `setDispStatus("loading")`.
   - `elegirFranja(fr)`: `setFranja(fr)`; aviso info "Horario <hora> seleccionado. Completa tus datos."
   - `refrescarFranjas(texto: string)` (usado ante 409 o error de `inicio`): `setFranja(null)`, `setAviso({ tipo: "error", texto })`, `setDispStatus("loading")`, `setDispReload(k => k + 1)`.
   - `onCreada(cita)`: `setCitaCreada(cita)`, `setAviso(null)`.
   - `nuevaCita()`: limpiar `fecha`, `franja`, `disp`, `citaCreada`, `aviso`; `dispStatus = "idle"`; mantener `servicioId`, `servicios`, `horario`. Hacer además `setBaseReload` para refrescar `hoy`/`fecha_max` (con `baseStatus = "loading"`).
6. Render:
   - Región de avisos SIEMPRE montada (antes de los pasos): `<div role="status" aria-live="polite" className="min-h-6 text-sm">` con `aviso.texto`; si `tipo === "error"` envolver el texto en `<p className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-red-400">` (como el error de `/clientes`). Los mensajes info van con `text-muted`.
   - `baseStatus === "loading"` → `<AgendaFallback />`.
   - `baseStatus === "error"` → bloque `role="alert"` (mismo estilo que el error de `clientes-manager.tsx`) con `baseError`, texto auxiliar "Si el problema continúa, llámanos o acércate a la barbería." y botón "Reintentar" (`buttonClasses({ variant: "secondary", size: "md" })`).
   - `ready` y `servicios.length === 0` → `cardClasses` + `text-center text-muted`: "Por ahora no hay servicios disponibles para reservar en línea."
   - `citaCreada` → `<CitaConfirmacion cita={citaCreada} zonaHoraria={horario.zona_horaria} onNueva={nuevaCita} />` en lugar de los pasos.
   - Si no, layout de pasos: `<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">`:
     - Columna izquierda (`flex flex-col gap-6`): `<ServicioSelector …/>` y `<Calendario …/>`.
     - Columna derecha (`flex flex-col gap-6`): `<FranjasHorarias …/>` y `<CitaForm …/>`.
   - Cada paso es una `<section aria-labelledby="paso-N-titulo" className={cardClasses}>` con `<h2 id="paso-N-titulo" className="text-lg font-semibold">` precedido de un indicador numérico decorativo (`<span aria-hidden="true" className="… rounded-full bg-accent/15 text-accent h-7 w-7 …">N</span>`). Títulos: "1. Elige el servicio", "2. Elige el día", "3. Elige la hora", "4. Tus datos" (el número va dentro del texto del `h2` en `sr-only` o visible; no duplicar lectura).

### 5. Paso 1 — `ServicioSelector` (`servicio-selector.tsx`)
1. Props: `{ servicios: Servicio[]; value: string | null; onChange: (id: string) => void }`.
2. `<fieldset>` con `<legend className="sr-only">Servicio</legend>` dentro de la sección; lista `grid gap-3 sm:grid-cols-2`.
3. Cada opción: `<label>` que contiene `<input type="radio" name="servicio" value={s.id} checked={value === s.id} onChange={() => onChange(s.id)} className="peer sr-only" />` y un bloque visual (`rounded-xl border border-border bg-background p-4 transition-colors hover:bg-surface-hover peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:outline-2 peer-focus-visible:outline-accent-2 peer-focus-visible:outline-offset-2`) con nombre (`font-medium`), `formatearDuracion(duracion_min)` · `formatearPrecio(precio)` (`text-sm text-muted`) y `descripcion` si existe.
4. Teclado: el grupo de radios nativo da flechas/Tab sin código extra.

### 6. Paso 2 — `Calendario` (`calendario.tsx`) — patrón ARIA "Date Picker Dialog / grid" (sin diálogo, en línea)
1. Props: `{ horario: Horario; value: string | null; onChange: (fecha: string) => void; disabled?: boolean }` (`disabled` cuando aún no hay servicio elegido: mostrar texto "Primero elige un servicio" y no permitir seleccionar, pero el calendario sí se ve).
2. Función `esHabil(f)`: `f >= horario.hoy && f <= horario.fecha_max && !horario.dias.find(d => d.dia_semana === diaSemana(f))?.cerrado` (si no hay entrada para ese día → no hábil).
3. Rango navegable: `min = primerDiaMes(mesDe(hoy))`, `max = ultimoDiaMes(mesDe(fecha_max))`. Estado interno: `mes` (`"YYYY-MM"`) y `foco` (`YYYY-MM-DD`). Inicial: `foco = value ?? primera fecha hábil ≥ hoy ?? hoy`, `mes = mesDe(foco)` (inicializadores de `useState`).
4. Cabecera: `<div className="flex items-center justify-between">` con botón "Mes anterior" y "Mes siguiente" (`buttonClasses({ variant: "ghost", size: "sm" })`, icono chevron SVG `aria-hidden`, `aria-label` en español), deshabilitados si `mes` ya es el mínimo/máximo; título `<h3 id="cal-mes" aria-live="polite" className="font-semibold">{etiquetaMes(mes)}</h3>`. Al cambiar de mes con botones, mover `foco` al mismo día del mes (clamp a `[min, max]`) sin quitar el foco del botón.
5. Tabla: `<table role="grid" aria-labelledby="cal-mes" className="w-full table-fixed border-collapse">`:
   - `<thead>`: `<tr>` con 7 `<th scope="col" abbr={DIAS_LARGOS[i]} className="pb-2 text-xs font-medium text-muted">{DIAS_CORTOS[i]}</th>`.
   - `<tbody>`: por cada semana de `semanasDelMes(mes)` un `<tr>`; celdas `null` → `<td aria-hidden="true" />` (o `<td />` vacío); celdas con fecha → `<td role="gridcell" aria-selected={f === value}>` con `<button type="button">`.
6. Botón de día:
   - `tabIndex={f === foco ? 0 : -1}` (roving tabindex: el grid es una sola parada de Tab).
   - `aria-label`: `etiquetaFechaLarga(f)` + `", hoy"` si `f === hoy` + `", no disponible"` si no hábil.
   - `aria-disabled={!habil || disabled ? true : undefined}` (NO usar `disabled` nativo, para que el foco con flechas pueda pasar por días cerrados); `aria-current={f === hoy ? "date" : undefined}`.
   - `onClick`: si hábil y no `disabled` → `setFoco(f)` y `onChange(f)`.
   - Clases: base `mx-auto flex h-10 w-full max-w-12 items-center justify-center rounded-xl text-sm sm:h-12 transition-colors`; hábil `hover:bg-surface-hover`; no hábil `text-muted/50 line-through cursor-not-allowed`; seleccionado `bg-accent text-white hover:bg-accent-hover font-semibold`; hoy (no seleccionado) `ring-1 ring-accent-2/60`. El foco visible lo da la regla global `:focus-visible` de `globals.css`.
   - Guardar refs de botones en `useRef<Map<string, HTMLButtonElement>>` (callback ref por fecha).
7. Teclado (`onKeyDown` en `<tbody>` o en cada botón), con `preventDefault` para estas teclas:
   - `ArrowLeft`/`ArrowRight`: ±1 día; `ArrowUp`/`ArrowDown`: ±7 días.
   - `Home`/`End`: `inicioSemana(foco)` / `finSemana(foco)`.
   - `PageUp`/`PageDown`: `moverFechaMismoDia(foco, ∓1)`; con `Shift`: ∓12 meses.
   - `Enter`/`Space`: comportamiento nativo del `<button>` (dispara `onClick`); no reimplementar.
   - Resultado siempre `clampFecha(nueva, min, max)`. Si `mesDe(nueva) !== mes` → `setMes(mesDe(nueva))`. `setFoco(nueva)` y, tras el render, enfocar el botón: usar un `useEffect` con deps `[foco]` que llame `refs.get(foco)?.focus()` SOLO si una bandera `debeEnfocar` (ref) está activa (se activa en el handler de teclado; se desactiva al enfocar), para no robar el foco al montar ni al usar los botones de mes.
8. Leyenda bajo la tabla (`flex flex-wrap gap-4 text-xs text-muted`): muestras de "Seleccionado", "Hoy", "No disponible" (muestras con `aria-hidden`, texto visible). Texto de ayuda `sr-only` asociado vía `aria-describedby` en la tabla: "Usa las flechas para moverte entre días, Inicio y Fin para ir al comienzo o fin de semana, Re Pág y Av Pág para cambiar de mes."

### 7. Paso 3 — `FranjasHorarias` (`franjas-horarias.tsx`)
1. Props: `{ fecha: string | null; servicioElegido: boolean; status: "idle" | "loading" | "ready" | "error"; disp: Disponibilidad | null; error: string | null; value: Franja | null; onChange: (f: Franja) => void; onReintentar: () => void }`.
2. Estados:
   - Sin servicio o sin fecha → `text-muted`: "Elige un servicio y un día para ver los horarios disponibles."
   - `loading` → `aria-busy="true"`, "Buscando horarios…" + placeholders `animate-pulse motion-reduce:animate-none`.
   - `error` → bloque `role="alert"` con `error` y botón "Reintentar" (`buttonClasses({ variant: "secondary", size: "sm" })`) que llama `onReintentar` (en el orquestador: `setDispStatus("loading"); setDispReload(k => k + 1)`).
   - `ready` con `disp.cerrado` → "La barbería no atiende este día. Elige otra fecha."
   - `ready` sin franjas disponibles → "No quedan horarios libres para este día. Prueba con otra fecha."
   - `ready` con franjas → subtítulo con `etiquetaFechaLarga(fecha)` y `disp.servicio.nombre` (duración), luego `<fieldset>` con `<legend className="sr-only">Horario</legend>` y dos grupos ("Mañana", "Tarde"; `<p className="text-sm font-medium text-muted">`), cada uno `grid grid-cols-3 gap-2 sm:grid-cols-4`, opciones radio nativas (`name="franja"`, `value={f.inicio}`, `checked={value?.inicio === f.inicio}`) con el mismo patrón `peer sr-only` + `peer-checked:bg-accent peer-checked:text-white peer-checked:border-accent` y altura mínima 44 px (`min-h-11`). Texto visible `f.hora`.
3. Solo se pintan franjas `disponible === true`.

### 8. Paso 4 — `CitaForm` (`cita-form.tsx`)
1. Props: `{ servicio: Servicio | null; franja: Franja | null; onCreada: (c: CitaConServicio) => void; onFranjaPerdida: (mensaje: string) => void }`.
2. Mantener el formulario SIEMPRE montado (los valores sobreviven a un 409). Si `!servicio || !franja`: mostrar `<p id="cita-form-ayuda" className="text-sm text-muted">Elige un horario para continuar.</p>` y deshabilitar el botón de envío (`disabled`, `aria-describedby="cita-form-ayuda"`).
3. Resumen compacto encima de los campos cuando hay franja: "Corte · martes, 20 de octubre · 09:00 · $ 25.000".
4. Campos (estilo `inputClass` igual al de `cliente-form.tsx`; label visible + `htmlFor`; ids `cita-<campo>`; patrón `campoProps`/`errorDe` con `aria-invalid` y `aria-describedby` como en `cliente-form.tsx`):
   - `nombre`: `type="text" required minLength={2} maxLength={120} autoComplete="name"`.
   - `telefono`: `type="tel" required inputMode="tel" pattern="[0-9+()\s-]{7,20}" maxLength={20} autoComplete="tel"`; ayuda "Ej.: 300 123 4567".
   - `email` (opcional, etiqueta "Correo (opcional)"): `type="email" maxLength={254} autoComplete="email"`.
   - `notas` (opcional, "Notas (opcional)"): `<textarea rows={3} maxLength={500}>` con contador `n/500` (`text-xs text-muted`).
5. Submit (`async`, `e.preventDefault()`): si `!servicio || !franja` → return. `submitting = true`, limpiar errores; `crearCita({ servicio_id: servicio.id, inicio: franja.inicio, nombre, telefono, email: email || null, notas: notas || null })`.
   - Éxito → limpiar valores y `onCreada(cita)`.
   - `ApiClientError` `FRANJA_NO_DISPONIBLE` → `onFranjaPerdida(mensajeCitas(err))` (el orquestador limpia franja, avisa y recarga franjas). No borrar los datos escritos.
   - `VALIDATION_ERROR` con `fieldErrors.inicio` o `fieldErrors.servicio_id` → `onFranjaPerdida(fieldErrors.inicio?.[0] ?? fieldErrors.servicio_id?.[0])`.
   - `VALIDATION_ERROR` en otros campos → `setFieldErrors(err.fieldErrors)`, `formError = err.formErrors[0] ?? null`; enfocar el primer campo con error.
   - `LIMITE_CITAS_ALCANZADO` → `setFieldErrors({ telefono: [mensajeCitas(err)] })`.
   - Resto → `formError = mensajeCitas(err)`.
   - `finally` → `submitting = false`.
6. `formError` en `<p role="alert" className="text-sm text-red-400">`.
7. Botón principal "Confirmar cita" (`buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })`), `disabled={submitting || !franja}`, texto "Reservando…" mientras `submitting` y `aria-busy` en el form.

### 9. Paso 5 — `CitaConfirmacion` (`cita-confirmacion.tsx`)
1. Props: `{ cita: CitaConServicio; zonaHoraria: string; onNueva: () => void }`.
2. Calcular `{ fecha, hora } = utcALocal(new Date(cita.inicio), zonaHoraria)` (de `@/lib/agenda/tiempo`) y hora de fin con `utcALocal(new Date(cita.fin), zonaHoraria).hora`.
3. `<section aria-labelledby="confirmacion-titulo" className={`${cardClasses} border-accent/40`}>`; icono check SVG `aria-hidden` en `text-accent`; `<h2 id="confirmacion-titulo" tabIndex={-1} ref={…}>¡Tu cita está confirmada!</h2>`; al montar, `useEffect(() => ref.current?.focus(), [])` (gestión de foco para lectores de pantalla y teclado).
4. `<dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">` con: Servicio (`cita.servicio.nombre`), Fecha (`etiquetaFechaLarga(fecha)`), Hora (`hora – horaFin`), Duración (`formatearDuracion(cita.duracion_min)`), Precio (`formatearPrecio(cita.precio)`), Nombre, Teléfono, Correo (si existe), Notas (si existen). `dt` con `text-muted`.
5. Texto: "Te esperamos. Si necesitas cambiar o cancelar tu cita, comunícate con la barbería." (no hay cancelación por el cliente en esta fase).
6. Acciones (`flex flex-col gap-3 sm:flex-row`): botón "Agendar otra cita" (`buttonClasses({ variant: "secondary", size: "md" })`, `onClick={onNueva}`) y `<ButtonLink href="/" variant="ghost">Volver al inicio</ButtonLink>`.

### 10. Verificación
1. `npm run lint` sin errores ni warnings nuevos.
2. `npx tsc --noEmit` sin errores.
3. `npm run build` sin errores; confirmar que `/citas` aparece como ruta prerenderizada/parcial (shell estático + Suspense) y que NO aparece el error de `useSearchParams` sin `Suspense`.
4. `npm run dev` y probar manualmente (con la migración aplicada en Supabase):
   - `/citas`, `/citas?servicio=<id de Corte>`, `/citas?servicio=corte` (slug) y `/citas?servicio=xxx` (se ignora).
   - Domingo, días pasados y días > `fecha_max` aparecen deshabilitados y no se pueden seleccionar.
   - Navegación completa solo con teclado (Tab, flechas, Home/End, PageUp/PageDown, Shift+PageUp/PageDown, Enter/Espacio).
   - Reservar una cita y ver la confirmación; abrir la misma fecha en otra pestaña e intentar la misma franja → aviso 409 y lista refrescada sin esa hora.
   - Con un teléfono con 3 citas futuras → mensaje de límite en el campo teléfono.
   - Con la API caída (o sin la migración) → mensaje "La agenda en línea no está disponible…" + Reintentar.
   - Anchos 375 px, 768 px, 1280 px sin scroll horizontal.

## Criterios de aceptación
- [x] Existe `/citas` con `<h1>` "Agenda tu cita", título de pestaña "Agenda tu cita | Barbería edTeams" y `<main id="contenido">`; los enlaces existentes del header ("Agendar") y de la home ("Agenda tu cita") llegan a esta página y el de la nav muestra `aria-current="page"`.
- [x] `app/citas/page.tsx` es Server Component (sin `"use client"`, sin `searchParams`); `AgendaCitas` (Client Component que usa `useSearchParams`) está dentro de `<Suspense>` con fallback visible.
- [x] Paso 1 lista los servicios activos de `GET /api/servicios` con nombre, duración y precio en COP (p. ej. "$ 25.000"); con `?servicio=<id>` (o slug válido) el servicio llega preseleccionado; con un valor inválido no se preselecciona nada y no hay error.
- [x] Paso 2 muestra un calendario mensual que empieza en lunes, con el mes en español; días pasados, posteriores a `fecha_max` y días cerrados (domingo / `cerrado: true` en `/api/horario`) se ven atenuados, llevan `aria-disabled="true"` y no se pueden seleccionar; "hoy" (de la API) está marcado con `aria-current="date"`.
- [x] No se puede navegar a meses anteriores al de `hoy` ni posteriores al de `fecha_max` (botones de mes deshabilitados y teclado acotado).
- [x] El calendario usa `role="grid"`, celdas `role="gridcell"` con `aria-selected`, cabeceras de columna con nombre largo del día, y roving tabindex (una sola parada de Tab); funcionan ←/→ (±1 día), ↑/↓ (±7), Home/End (inicio/fin de semana), PageUp/PageDown (±1 mes), Shift+PageUp/PageDown (±1 año), Enter/Espacio (seleccionar); al cruzar de mes con el teclado cambia el mes visible y el foco queda en el día correcto.
- [x] Paso 3 muestra solo las franjas `disponible: true` del día y servicio elegidos, agrupadas en Mañana/Tarde, como grupo de radios accesible; muestra estados de carga, error con Reintentar, día cerrado y "sin horarios".
- [x] Al cambiar de servicio o de día se limpia la franja elegida y se vuelven a pedir las franjas; las respuestas obsoletas se cancelan (`AbortController`) y nunca se pinta la disponibilidad de una selección anterior.
- [x] Paso 4: nombre y teléfono obligatorios, correo y notas opcionales, con `<label>` asociados, `autoComplete`, `aria-invalid` + mensaje por campo para los errores 400 del servidor; el botón "Confirmar cita" está deshabilitado sin franja y durante el envío (no hay doble envío).
- [x] El `POST /api/citas` envía exactamente `{ servicio_id, inicio, nombre, telefono, email, notas }` con `inicio` = `franja.inicio` recibido de la API.
- [x] Ante 409 `FRANJA_NO_DISPONIBLE` (o 400 en `inicio`): se anuncia el aviso en la región `aria-live`, se deselecciona la franja, se recargan las franjas y los datos escritos en el formulario se conservan.
- [x] Ante 409 `LIMITE_CITAS_ALCANZADO` se muestra el mensaje junto al campo teléfono.
- [x] Si `/api/servicios` o `/api/horario` fallan (5xx, p. ej. tablas no migradas) o no hay red, se muestra un mensaje amigable en `role="alert"` con botón "Reintentar" que vuelve a cargar; si no hay servicios se muestra un estado vacío.
- [x] Tras un 201 se muestra la confirmación con servicio, fecha larga, hora inicio–fin (hora local de la barbería), duración, precio y datos de contacto; el foco se mueve al título de confirmación; "Agendar otra cita" reinicia el flujo conservando el servicio.
- [x] Existe una región `role="status"`/`aria-live="polite"` siempre montada que anuncia cuántos horarios hay, la selección de hora y los avisos de conflicto.
- [x] Ninguna lógica de fechas usa el reloj del navegador: `hoy`/`fecha_max` vienen de `/api/horario` y las fechas civiles se formatean con `timeZone: "UTC"` sobre `Date.UTC(...)` (sin desfases de un día).
- [x] Responsive: a 375 px todo en una columna, celdas del calendario ≥ 40 px y opciones de hora ≥ 44 px de alto, sin scroll horizontal; desde `lg` (1024 px) dos columnas (servicio+calendario | horas+formulario).
- [x] Estilo coherente con BARB-4: modo oscuro, tarjetas con `cardClasses`, botones con `buttonClasses`/`ButtonLink`, acento rojo para selección/CTA, foco visible (`:focus-visible` global); animaciones con `motion-reduce:animate-none`.
- [x] Ningún archivo de `app/citas/**` importa `lib/services/*`, `lib/supabase/*`, `server-only` ni `lib/validations/cita.ts`.
- [x] No se modifican `app/precios/**`, `app/api/**`, `lib/**`, `supabase/**`, `app/_components/**`, `app/globals.css`, `app/layout.tsx`, `next.config.ts` ni `package.json`; no se añaden dependencias (`git status` solo muestra archivos nuevos bajo `app/citas/`).
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] No se hace commit ni push.
