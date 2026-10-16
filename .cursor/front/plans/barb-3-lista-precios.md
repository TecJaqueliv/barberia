# BARB-3 — Lista de precios (/precios)

## Objetivo
Crear la página pública `/precios` que muestra los servicios activos de la tabla `servicios` (nombre, descripción, duración y precio en COP) con un botón "Agendar" por servicio hacia `/citas?servicio=<id>`. Debe verse con el diseño BARB-4 (modo oscuro, acento rojo) y no romper el build ni la página si la tabla aún no existe.

## Supuestos / dudas
- Supuesto: datos **dinámicos por request** (no `"use cache"`). Motivo: con `cacheComponents: true` un `"use cache"` ejecutaría la consulta a Supabase en `next build`; si faltan `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` o la tabla no existe en la base remota, el build fallaría o se quedaría cacheado el estado de error. Se usa `await connection()` (de `next/server`) dentro de un componente async envuelto en `<Suspense>`, según `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` (sección "uncached data" → wrap en Suspense) y `03-api-reference/04-functions/connection.md`. El shell (título, intro) queda prerenderizado; la lista se transmite en streaming.
- Supuesto: cualquier error al leer (tabla inexistente `PGRST205`/`42P01`, `ConfigError` por variables ausentes, red) muestra el mismo mensaje amable; el detalle solo se registra con `console.error` en servidor. No se crea `error.tsx` (el error se captura en el componente).
- Supuesto: `precio` puede llegar como `number` o string numérico desde PostgREST; se formatea con `Number(precio)`.
- Duda no bloqueante: `/citas` la crea otro agente en paralelo; hasta que exista, el botón "Agendar" llevará a un 404. No se toca `app/citas`.
- No se modifica `site-nav.tsx` (ya enlaza a `/precios`), ni `lib/`, `app/api/`, `supabase/`, ni componentes compartidos.

## Archivos
- Crear: `app/precios/page.tsx` — **Server Component** (no async). Exporta `metadata` y renderiza `<main>`, encabezado y `<Suspense fallback={<ListaPreciosSkeleton />}><ListaPrecios /></Suspense>`.
- Crear: `app/precios/_components/lista-precios.tsx` — **Server Component async**. `await connection()`, llama a `listServiciosActivos()` en try/catch y renderiza lista / vacío / error.
- Crear: `app/precios/_components/lista-precios-skeleton.tsx` — Server Component con tarjetas placeholder (`animate-pulse`) para el fallback.
- Crear: `app/precios/_components/formato.ts` — helpers puros `formatearPrecio(valor: number | string): string` y `formatearDuracion(min: number): string`.

## Pasos de implementación
1. Crear `app/precios/_components/formato.ts`:
   - Constante a nivel de módulo `const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
   - `formatearPrecio(valor)` → `cop.format(Number(valor))` (ej. `$ 25.000`).
   - `formatearDuracion(min)` → `< 60`: `"30 min"`; múltiplo de 60: `"1 h"`; resto: `"1 h 15 min"`.
2. Crear `app/precios/_components/lista-precios-skeleton.tsx`:
   - Exporta `ListaPreciosSkeleton()`; `<ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">` con 6 `<Card as="li">` que contengan barras `rounded bg-surface-hover animate-pulse` (título, 2 líneas de texto, fila de precio + botón).
   - Añadir fuera de la lista `<p className="sr-only" role="status">Cargando precios…</p>`.
3. Crear `app/precios/_components/lista-precios.tsx`:
   - Imports: `connection` de `next/server`; `listServiciosActivos` de `@/lib/services/servicios`; `type Servicio` de `@/lib/types/servicio`; `Card` de `@/app/_components/card` (o ruta relativa `../../_components/card`); `ButtonLink` de `../../_components/button`; helpers de `./formato`.
   - `export async function ListaPrecios()`:
     - `await connection();`
     - `let servicios: Servicio[] | null = null;` → `try { servicios = await listServiciosActivos(); } catch (error) { console.error("[precios] No se pudieron cargar los servicios", error); }`. **No** devolver JSX dentro del try/catch; decidir el render después.
     - Si `servicios === null` → estado error (paso 4).
     - Si `servicios.length === 0` → estado vacío (paso 5).
     - Si hay datos → lista (paso 6).
4. Estado error: `<Card className="flex flex-col items-start gap-4" >` con `role="alert"` en un wrapper o en el `<p>` principal; texto: título "Nuestros precios estarán disponibles muy pronto" y `<p className="text-muted">Estamos actualizando la lista de servicios. Mientras tanto, puedes agendar tu cita y te confirmamos el valor en la barbería.</p>`; `ButtonLink href="/citas" variant="primary"` "Agenda tu cita" y `ButtonLink href="/" variant="secondary"` "Volver al inicio".
5. Estado vacío: `Card` similar (sin `role="alert"`): "Aún no hay servicios publicados" + texto muted "Vuelve pronto para conocer nuestros servicios y precios." + `ButtonLink href="/"` secondary "Volver al inicio".
6. Lista:
   - `<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">`, por cada servicio `<Card as="li" key={s.id} className="flex flex-col gap-4">`:
     - `<div className="flex items-start justify-between gap-4">` con `<h2 className="text-lg font-semibold">{s.nombre}</h2>` y `<p className="shrink-0 text-xl font-bold text-accent">{formatearPrecio(s.precio)}</p>`.
     - Descripción solo si `s.descripcion` no es null/vacía: `<p className="text-sm text-muted">`.
     - Fila inferior `mt-auto flex items-center justify-between gap-4`: duración con icono de reloj SVG inline `aria-hidden` + `<span className="text-sm text-muted">` con texto `Duración: {formatearDuracion(s.duracion_min)}` (prefijo "Duración" en `sr-only` si visualmente se muestra solo el valor), y `<ButtonLink href={`/citas?servicio=${encodeURIComponent(s.id)}`} size="sm" variant="primary" aria-label={`Agendar ${s.nombre}`}>Agendar</ButtonLink>`.
   - Bajo la lista, `<p className="text-sm text-muted">Precios en pesos colombianos (COP), IVA incluido.</p>` (omitir "IVA incluido" si se prefiere no afirmarlo; usar solo "Precios en pesos colombianos (COP).").
7. Crear `app/precios/page.tsx`:
   - `export const metadata: Metadata = { title: "Precios", description: "Lista de precios de cortes, barba y afeitado. Agenda tu cita en línea." }` (el layout aplica el template `%s | Barbería edTeams`).
   - `export default function PreciosPage()` (sync, **sin** `"use cache"`, sin `export const dynamic`: con Cache Components esa opción de segmento no aplica).
   - Estructura igual que `app/clientes/page.tsx`: `<main id="contenido" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">`, `<header className="flex flex-col gap-2">` con `<h1 className="text-3xl font-bold tracking-tight">Lista de precios</h1>` y `<p className="text-muted">Elige tu servicio y reserva tu turno en línea.</p>`.
   - Debajo: `<Suspense fallback={<ListaPreciosSkeleton />}><ListaPrecios /></Suspense>` (`Suspense` de `react`).
8. Verificar: `npx tsc --noEmit`, `npm run lint` y `npm run build` (el build debe completar y listar `/precios` como ruta con prerender parcial, sin error "blocking-route"/"Uncached data was accessed outside of <Suspense>"). Probar `npm run dev` en `/precios`: con tabla disponible muestra tarjetas; renombrando temporalmente `SUPABASE_URL` en `.env.local` (y restaurándolo) se ve el mensaje de error amable.

## Criterios de aceptación
- [x] `/precios` existe, título de pestaña "Precios | Barbería edTeams", y el enlace "Precios" del header queda marcado con `aria-current="page"`.
- [x] Los datos se obtienen con `listServiciosActivos()` en Server Component (sin `fetch` a `/api/servicios`, sin `"use client"` en la página ni en la lista).
- [x] Cada servicio muestra nombre, descripción (si existe), duración legible ("45 min", "1 h 30 min") y precio en formato COP de `Intl.NumberFormat("es-CO")` sin decimales.
- [x] Cada tarjeta tiene botón "Agendar" que navega a `/citas?servicio=<id>` con `aria-label` "Agendar <nombre>".
- [x] Si no hay servicios activos se muestra el estado vacío; si la tabla no existe o falla Supabase/configuración se muestra el mensaje amable (la página responde 200, no aparece overlay de error ni pantalla de error).
- [x] Mientras carga se ve el skeleton (fallback de Suspense) con texto para lectores de pantalla.
- [x] Diseño coherente con BARB-4: `Card`, `ButtonLink`, tokens `bg-surface`, `border-border`, `text-muted`, `text-accent`; modo oscuro.
- [x] Responsive: 1 columna en móvil (sin scroll horizontal a 360 px), 2 en `sm`, 3 en `lg`.
- [x] Jerarquía de encabezados correcta (h1 página, h2 por servicio); foco visible en botones.
- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [x] No se modificaron `app/citas`, `app/api`, `lib/`, `supabase/` ni componentes de `app/_components`.
