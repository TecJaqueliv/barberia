# BARB-4 — Diseño más amigable del sitio

## Objetivo
Rediseñar la interfaz para que resulte atractiva y cercana a clientes de una barbería: home con hero y servicios, navegación principal responsive y accesible, footer compartido y un sistema visual consistente (tipografía, espaciado, tarjetas, botones), manteniendo el modo oscuro fijo y el logo actual. La lógica del CRUD de `/clientes` no cambia.

## Supuestos / dudas
- Sin dudas bloqueantes.
- Supuesto: `/precios` y `/citas` NO existen aún (las crea otra tarea). Se enlazan igual; mientras tanto devolverán el 404 por defecto de Next. No se crean páginas ni placeholders.
- Supuesto: `typedRoutes` NO está activo en `next.config.ts`, por lo que `href="/citas"` y `href="/precios"` no rompen `tsc`. No activarlo.
- Supuesto: color de acento = rojo del poste del logo (`#ef4444`, `red-500`) para CTAs; azul (`#3b82f6`) solo como acento secundario (iconos/detalles). Fondo oscuro actual se mantiene (`#0a0a0a`), se añade una superficie de tarjeta un poco más clara.
- Supuesto: tipografía con pila de fuentes del sistema (sin `next/font/google`) para no depender de red en `next build`. Jerarquía vía tamaños/pesos de Tailwind.
- Supuesto: textos de servicios son genéricos (Corte clásico, Arreglo de barba, Afeitado con toalla caliente, Corte + barba) SIN precios (los precios son de `/precios`).
- Supuesto: CTA secundario del hero = "Ver precios" → `/precios`.
- Contexto Next 16 (verificado en `node_modules/next/dist/docs/`):
  - `usePathname` (de `next/navigation`) solo funciona en Client Components. Con `cacheComponents: true` (activo en este proyecto) puede requerir `<Suspense>` si alguna ruta tiene params dinámicos no resueltos; hoy todas las rutas son estáticas, pero se envuelve la nav en `<Suspense>` como protección para no romper el build en el futuro (ver `04-functions/use-pathname.md`, sección "Cache Components").
  - `<Link>` de `next/link` pasa `className`, `aria-current`, `onClick` al `<a>` (ver `02-components/link.md`). No usar `legacyBehavior` ni `<a>` anidado.
  - `next/image` en el header ya usa `preload` (sustituto de `priority`); mantenerlo.

## Archivos
- Modificar: `app/globals.css` — tokens de diseño (superficie, borde, texto atenuado, acento), fuente del sistema, `scroll-behavior`, estilo global de foco visible.
- Crear: `app/_components/button.tsx` — Server Component. Estilos de botón/enlace reutilizables (`primary` | `secondary` | `ghost` | `danger`; tamaños `sm` | `md` | `lg`).
- Crear: `app/_components/card.tsx` — Server Component. Contenedor de tarjeta consistente.
- Crear: `app/_components/site-nav.tsx` — Client Component (`"use client"`). Enlaces de navegación con `aria-current` y menú móvil.
- Modificar: `app/_components/site-header.tsx` — Server Component; añade `<SiteNav />` dentro de `<Suspense>`, header sticky.
- Crear: `app/_components/site-footer.tsx` — Server Component. Footer compartido.
- Modificar: `app/layout.tsx` — añade `<SiteFooter />`, metadata con `title.template`, contenedor `<main>` no (cada página mantiene su `<main>`).
- Modificar: `app/page.tsx` — Server Component. Hero + servicios + "por qué elegirnos" + CTA final.
- Modificar: `app/clientes/page.tsx` — encabezado de página pulido (sin enlace "← Inicio", ya está en la nav).
- Modificar (solo `className`/marcado presentacional): `app/clientes/_components/clientes-manager.tsx`, `app/clientes/_components/cliente-form.tsx`, `app/clientes/_components/clientes-list.tsx`.
- NO tocar: `app/api/**`, `lib/**`, `supabase/**`, `public/logo.svg`, `app/icon.svg`, `next.config.ts`.

## Pasos de implementación

### 1. Tokens y base visual (`app/globals.css`)
1. Mantener `@import "tailwindcss";` y `@custom-variant dark ...`.
2. En `:root` conservar `--background: #0a0a0a`, `--foreground: #ededed`, `color-scheme: dark` y añadir:
   - `--surface: #141414` (tarjetas), `--surface-hover: #1c1c1c`, `--border: #262626`, `--muted: #a3a3a3` (texto secundario, contraste >= 4.5:1 sobre `#0a0a0a` y `#141414`), `--accent: #ef4444`, `--accent-hover: #dc2626`, `--accent-2: #3b82f6`.
3. En `@theme inline` exponerlos como `--color-surface`, `--color-surface-hover`, `--color-border`, `--color-muted`, `--color-accent`, `--color-accent-hover`, `--color-accent-2`, y `--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`.
4. `html { scroll-behavior: smooth; }` dentro de `@media (prefers-reduced-motion: no-preference)`.
5. Regla global de foco: `:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }` (azul para que se distinga del rojo de los CTAs).
6. `body` mantiene `background`/`color` y añade `font-family: var(--font-sans)`.

### 2. `Button` (`app/_components/button.tsx`, Server Component, sin `"use client"`)
1. Exportar `buttonClasses({ variant, size, className }): string` — función pura que devuelve las clases; reutilizable tanto en `<button>` como en `<Link>`.
   - Base: `inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`.
   - `primary`: `bg-accent text-white hover:bg-accent-hover`.
   - `secondary`: `border border-border bg-surface hover:bg-surface-hover`.
   - `ghost`: `hover:bg-surface-hover`.
   - `danger`: `border border-red-400/40 text-red-400 hover:bg-red-400/10`.
   - Tamaños: `sm` → `px-3 py-1.5 text-sm`; `md` → `px-4 py-2`; `lg` → `px-6 py-3 text-base sm:text-lg`.
2. Exportar `ButtonLink` — props: `ComponentProps<typeof Link> & { variant?: Variant; size?: Size }`; renderiza `<Link className={buttonClasses(...)}>`.
3. No exportar un componente `<Button>` con estado: los `<button>` de `/clientes` (Client Components) usan `buttonClasses(...)` directamente. `button.tsx` no importa nada de cliente, así que puede importarse desde Client Components sin problema.
4. Tipos: `type Variant = "primary" | "secondary" | "ghost" | "danger"; type Size = "sm" | "md" | "lg";`.

### 3. `Card` (`app/_components/card.tsx`, Server Component)
1. `export function Card({ as = "div", className, children }: { as?: "div" | "article" | "section" | "li"; className?: string; children: React.ReactNode })`.
2. Clases base: `rounded-2xl border border-border bg-surface p-5 sm:p-6`.
3. Exportar también `cardClasses` (string) para reutilizar en `<form>`/`<ul>` de clientes.

### 4. Navegación (`app/_components/site-nav.tsx`, Client Component)
1. `"use client"`; importar `usePathname` de `next/navigation`, `Link` de `next/link`, `useState`, `useEffect`.
2. Constante `NAV_ITEMS = [{ href: "/", label: "Inicio" }, { href: "/precios", label: "Precios" }, { href: "/citas", label: "Agendar" }, { href: "/clientes", label: "Clientes" }] as const`.
3. Función `isActive(pathname, href)`: `href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")`.
4. Escritorio (`hidden md:flex`): `<nav aria-label="Principal"><ul>` con cada `<Link>` llevando `aria-current={active ? "page" : undefined}`; estilo activo `text-foreground bg-surface-hover`, inactivo `text-muted hover:text-foreground`. "Agendar" se resalta como CTA (`buttonClasses({ variant: "primary", size: "sm" })`) cuando no está activo, pero sigue llevando `aria-current` si lo está.
5. Móvil (`md:hidden`): botón hamburguesa `<button type="button" aria-expanded={open} aria-controls="menu-movil" aria-label={open ? "Cerrar menú" : "Abrir menú"}>` con icono SVG inline (`aria-hidden="true"`), tamaño táctil mínimo 44×44 px (`h-11 w-11`).
6. Panel `id="menu-movil"`, renderizado solo si `open`; lista vertical a ancho completo bajo el header (`absolute inset-x-0 top-full` dentro de un header `relative`), enlaces con `py-3` y mismo `aria-current`.
7. Cierre del menú: `onClick` de cada enlace → `setOpen(false)`; tecla `Escape` (listener `keydown` en `useEffect` solo mientras `open`) cierra y devuelve el foco al botón (usar `useRef<HTMLButtonElement>`). No usar `useEffect` sobre `pathname` para cerrar (evitar setState en efecto; el `onClick` basta).
8. Exportar `export function SiteNav()`.

### 5. Header (`app/_components/site-header.tsx`, Server Component)
1. `<header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">`; contenedor interno `relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6`.
2. Conservar el `<Link href="/">` con `<Image src="/logo.svg" ... unoptimized preload />` tal cual (quitar las clases `focus-visible:ring-*` propias si duplican la regla global; mantener `rounded`).
3. Añadir `<Suspense fallback={null}><SiteNav /></Suspense>` (importar `Suspense` de `react`). Nota: fallback `null` es aceptable porque hoy todas las rutas son estáticas y la nav se prerenderiza.
4. Añadir enlace "Saltar al contenido" (`<a href="#contenido" className="sr-only focus:not-sr-only ...">`) como primer hijo del header.

### 6. Footer (`app/_components/site-footer.tsx`, Server Component)
1. `<footer className="mt-auto border-t border-border">` con contenedor `max-w-6xl`, en grid `sm:grid-cols-3`:
   - Marca: nombre "Barbería edTeams" + frase corta.
   - Horario (texto estático, p. ej. "Lun–Sáb 9:00–20:00").
   - Enlaces: Precios, Agendar cita (mismo destino que la nav), sin `aria-current`.
2. Línea inferior `© {new Date().getFullYear()} Barbería edTeams`. Ojo con `cacheComponents`: `new Date()` en un Server Component prerenderizado puede provocar error de "dynamic data" en build; si `next build` lo marca, sustituir por año fijo calculado en build con `"use cache"` o simplemente texto sin año. Verificar en el paso de build.
3. Texto secundario con `text-muted text-sm`.

### 7. Layout (`app/layout.tsx`)
1. Metadata: `title: { default: "Barbería edTeams", template: "%s | Barbería edTeams" }`, `description: "Cortes, barba y afeitado clásico. Agenda tu cita en línea."`.
2. Body: `<SiteHeader />`, `{children}`, `<SiteFooter />`. Mantener `className="dark h-full antialiased"` en `<html>` y `min-h-full flex flex-col` en `<body>`. Mantener `viewport` sin cambios.
3. Cada página debe tener `<main id="contenido" className="flex-1 ...">` (destino del skip link).

### 8. Home (`app/page.tsx`, Server Component)
1. `<main id="contenido" className="flex-1">` con secciones separadas por `py-16 sm:py-24` y contenedor `mx-auto max-w-6xl px-4 sm:px-6`.
2. **Hero** (`<section aria-labelledby="hero-titulo">`):
   - Fondo decorativo: degradado sutil (`bg-[radial-gradient(...)]` con rojo/azul a baja opacidad) o franjas diagonales tipo poste de barbero muy tenues; `aria-hidden`.
   - Etiqueta pequeña ("Barbería clásica · estilo moderno"), `<h1 id="hero-titulo">` grande (`text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance`), p. ej. "Tu mejor versión empieza en nuestra silla".
   - Subtítulo `text-lg text-muted max-w-2xl`.
   - CTAs (`flex flex-col sm:flex-row gap-3`): `<ButtonLink href="/citas" variant="primary" size="lg">Agenda tu cita</ButtonLink>` y `<ButtonLink href="/precios" variant="secondary" size="lg">Ver precios</ButtonLink>`. En móvil ocupan ancho completo (`w-full sm:w-auto`).
3. **Servicios** (`<section aria-labelledby="servicios-titulo">`): `<h2>` "Nuestros servicios" + `<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">` con 4 `<Card as="li">`: icono SVG inline (`aria-hidden`, color `text-accent` o `text-accent-2`), `<h3>` y descripción de 1 línea. Datos en un array constante en el mismo archivo.
4. **Por qué elegirnos** (`<section aria-labelledby="porque-titulo">`): `<h2>` + 3 puntos (Barberos expertos, Reserva en minutos, Ambiente cómodo) en `grid sm:grid-cols-3`, cada uno con icono + título + texto.
5. **CTA final**: `<Card>` destacada con borde acento (`border-accent/40`) y texto "¿Listo para tu próximo corte?" + `ButtonLink` primario a `/citas`.
6. Eliminar el texto "hola edteams" y el enlace "Gestionar clientes" (Clientes queda en la nav).
7. No añadir imágenes externas; solo SVG inline o `public/logo.svg`.

### 9. Pulido de `/clientes` (solo presentación; NO cambiar estado, handlers, efectos, llamadas a `lib/`, ids, `aria-*` existentes ni textos de error)
1. `app/clientes/page.tsx`: `<main id="contenido" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">`; quitar enlace "← Inicio"; encabezado con `<h1>` "Clientes" (`text-3xl font-bold tracking-tight`) + `<p className="text-muted">` descriptivo ("Registra y gestiona la información de tus clientes."). `metadata.title` → `"Clientes"` (el template añade el sufijo).
2. `clientes-manager.tsx`:
   - Input de búsqueda: clases con `rounded-xl border-border bg-surface px-4 py-2.5`; añadir icono de lupa decorativo opcional (`aria-hidden`) sin alterar `aria-label`.
   - Layout: en `lg`, formulario y listado en dos columnas (`lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start gap-6`); en móvil, apilado (orden actual: buscador, form, aviso, listado).
   - Bloque de error: `rounded-xl` y botón "Reintentar" con `buttonClasses({ variant: "secondary", size: "md" })`.
   - Estado vacío/cargando: dentro de `Card`-like (`cardClasses` + `text-center text-muted`).
   - Paginación: botones con `buttonClasses({ variant: "secondary", size: "sm" })`.
3. `cliente-form.tsx`:
   - `<form>` usa `cardClasses` (sustituye `rounded border border-current/20 p-4`).
   - `inputClass`: `w-full rounded-xl border border-border bg-background px-3 py-2.5 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-2/60 aria-[invalid=true]:border-red-400`.
   - Botón submit: `buttonClasses({ variant: "primary", size: "md" })`; botón cancelar: `buttonClasses({ variant: "secondary", size: "md" })`.
4. `clientes-list.tsx`:
   - `<ul>` con `cardClasses` sin padding (`p-0 overflow-hidden`) y `divide-y divide-border`; cada `<li>` con `hover:bg-surface-hover transition-colors`.
   - Avatar con iniciales (círculo `h-10 w-10 bg-accent/15 text-accent`, `aria-hidden="true"`) a la izquierda del nombre.
   - `dt` con `text-muted` en lugar de `opacity-70`.
   - Botones: Editar → `buttonClasses({ variant: "secondary", size: "sm" })`; Eliminar → `buttonClasses({ variant: "danger", size: "sm" })`. Mantener `aria-label`, `disabled` y textos.
5. Importar `buttonClasses`/`cardClasses` con alias `@/app/_components/button` y `@/app/_components/card`.

### 10. Verificación
1. `npm run lint` sin errores.
2. `npx tsc --noEmit` sin errores.
3. `npm run build` sin errores (prestar atención a avisos de `cacheComponents` sobre `usePathname` y `new Date()` en el footer; corregir según paso 6.2).
4. `npm run dev` y revisar manualmente `/` y `/clientes` a 375 px, 768 px y 1280 px.
5. Navegar solo con teclado: Tab muestra el skip link, logo, nav, CTAs; foco siempre visible; Escape cierra el menú móvil.

## Criterios de aceptación
- [x] El modo oscuro se mantiene en todas las páginas (`<html class="dark">`, `color-scheme: dark`, fondo `#0a0a0a`); no hay fondos claros.
- [x] El logo (`/logo.svg`) sigue en el header y enlaza a `/`; el favicon no cambia.
- [x] La home muestra un hero con `<h1>`, subtítulo, CTA primario "Agenda tu cita" con `href="/citas"` y CTA secundario "Ver precios" con `href="/precios"`.
- [x] La home muestra la sección de servicios (4 tarjetas) y la de "por qué elegirnos" (3 puntos), en 1 columna en móvil y varias en escritorio.
- [x] El header contiene una `<nav aria-label="Principal">` con Inicio (/), Precios (/precios), Agendar (/citas), Clientes (/clientes), en ese orden.
- [x] El enlace de la ruta actual tiene `aria-current="page"` (comprobado en `/` y `/clientes`); los demás no lo tienen.
- [x] Por debajo de `md` (768 px) la nav se oculta y aparece un botón con `aria-expanded`/`aria-controls` que abre y cierra el menú; Escape lo cierra y devuelve el foco al botón; pulsar un enlace lo cierra.
- [x] Todos los elementos interactivos tienen foco visible con teclado; existe un enlace "Saltar al contenido" que lleva a `#contenido`.
- [x] Footer compartido visible en `/` y `/clientes`, al fondo de la página aunque haya poco contenido.
- [x] Botones y tarjetas usan `buttonClasses`/`ButtonLink` y `Card`/`cardClasses` de `app/_components/`, con estilo consistente entre home y `/clientes`.
- [x] `/clientes` mantiene exactamente el mismo comportamiento: listar, buscar, crear, editar, eliminar, paginar, mensajes de error/éxito (solo cambian clases y marcado presentacional; el diff no altera hooks, handlers ni llamadas a `lib/client/clientes`).
- [ ] Sin scroll horizontal a 375 px en `/` ni en `/clientes`.
- [x] Texto secundario con contraste >= 4.5:1 (token `--muted` sobre fondo y superficie).
- [x] Iconos decorativos con `aria-hidden="true"`; jerarquía de encabezados correcta (un `<h1>` por página, `h2`/`h3` en orden).
- [x] No se crean `app/precios/` ni `app/citas/`; no se modifican `app/api/`, `lib/`, `supabase/` ni `next.config.ts`.
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] No se hace commit ni push.
