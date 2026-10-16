# BARB-2: Poner un logo a la página

## Objetivo
Crear un logo SVG sencillo de la barbería (poste de barbero + texto "Barbería") coherente con el modo oscuro fijo, y mostrarlo en un encabezado compartido (en `/` y `/clientes`) que enlaza a `/`. Usar además un ícono SVG como favicon.

## Supuestos / dudas
- No hay imagen ni descripción aportada: se diseña un logo propio (poste de barbero con franjas rojo/blanco/azul + wordmark "Barbería"). Sin dudas bloqueantes.
- La carpeta `public/` no existe todavía: se crea.
- El encabezado se implementa como Server Component (no necesita estado ni eventos); `next/link` y `next/image` funcionan en Server Components.
- Se conserva `app/favicon.ico`; `app/icon.svg` se añade como ícono adicional (Next genera `<link rel="icon" ... sizes="any" type="image/svg+xml">` y los navegadores modernos lo prefieren).
- No se toca `app/api`, `lib`, `supabase` ni `next.config.ts`.

### Docs consultadas (Next 16.4.2) y conclusiones
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`:
  - Next no optimiza SVG por defecto; se recomienda `unoptimized` y **esto ocurre automáticamente cuando `src` termina en `.svg`**. Por tanto NO hace falta `images.dangerouslyAllowSVG` en `next.config.ts` (y no se debe activar). Se pasa `unoptimized` explícito igualmente por claridad (inocuo).
  - Con `src` como string de ruta interna (`"/logo.svg"`) son obligatorios `width` y `height` (tamaño intrínseco, para aspect ratio); el tamaño renderizado lo controla CSS.
  - `priority` está **deprecado desde Next 16**; usar `preload` si se quiere precargar (el logo está above-the-fold: usar `preload`).
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`:
  - `icon` admite `.svg` en `app/**/*`; colocar `app/icon.svg` añade automáticamente el `<link rel="icon">` en `<head>` con `sizes="any"`. No requiere cambios en `metadata`. `favicon` solo `.ico` en raíz de `app/`.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`:
  - `<Link href="/">` sin cambios de API; con `partialPrefetching: true` (activo en `next.config.ts`) el prefetch por defecto es el App Shell. No se requiere prop `prefetch`.

## Archivos
- Crear: `public/logo.svg` — logo completo (ícono de poste + texto "Barbería"), colores para fondo oscuro.
- Crear: `app/icon.svg` — versión solo-ícono (poste de barbero) cuadrada para favicon.
- Crear: `app/_components/site-header.tsx` — Server Component `SiteHeader` con el logo enlazado a `/`.
- Modificar: `app/layout.tsx` — renderizar `<SiteHeader />` antes de `{children}` dentro de `<body>`.

## Pasos de implementación
1. Crear la carpeta `public/` y el archivo `public/logo.svg`:
   - `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 48" width="200" height="48" role="img" aria-labelledby="t"><title id="t">Barbería</title> ...`.
   - Ícono a la izquierda (zona x 0–40): poste de barbero vertical: tapa superior e inferior redondeadas en `#ededed` (rect con `rx`), cuerpo rect blanco `#ededed` de ~16x32 con 3 franjas diagonales alternas rojo `#ef4444` y azul `#3b82f6` (usar `<clipPath>` sobre el cuerpo y `<path>`/`<polygon>` diagonales dentro del clip).
   - Texto a la derecha: `<text x="52" y="32" fill="#ededed" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="600">Barbería</text>`.
   - Sin fondo (transparente), sin scripts, sin referencias externas, sin `<style>` con `@import`.
2. Crear `app/icon.svg`: solo el poste, `viewBox="0 0 32 32"`, mismos colores; dejar fondo transparente. Debe verse bien a 16px (formas simples, 2–3 franjas).
3. Crear `app/_components/site-header.tsx` (Server Component, sin `"use client"`):
   - Firma: `export function SiteHeader()` (export nombrado, sin props; no anotar `JSX.Element`, que con React 19 no existe como namespace global; dejar que TS infiera).
   - Estructura: `<header className="border-b border-current/20">` > `<div className="mx-auto flex w-full max-w-4xl items-center p-4 sm:px-6">` > `<Link href="/" aria-label="Barbería - ir al inicio" className="inline-flex items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">` > `<Image src="/logo.svg" alt="Logo de Barbería" width={200} height={48} unoptimized preload className="h-8 w-auto sm:h-10" />`.
   - Importar `Link` de `"next/link"` e `Image` de `"next/image"`. No usar `priority`.
   - El `max-w-4xl` y padding coinciden con el `<main>` de `/clientes` para alinear.
4. Modificar `app/layout.tsx`:
   - `import { SiteHeader } from "./_components/site-header";`
   - Dentro de `<body>`: `<SiteHeader />` seguido de `{children}`. No cambiar `metadata`, `viewport` ni clases existentes.
   - Verificar que `/` sigue centrando su contenido (`main` usa `flex-1`, el body es `flex flex-col`, así que el header ocupa su alto y el main el resto).
5. Verificar con `npm run dev`: el logo aparece arriba en `/` y `/clientes`; clic en el logo navega a `/`; la pestaña muestra el favicon SVG.
6. Ejecutar `npm run lint`, `npx tsc --noEmit` y `npm run build`; corregir cualquier error.

## Criterios de aceptación
- [x] Existe `public/logo.svg` (SVG válido, transparente, colores legibles sobre `#0a0a0a`, sin scripts ni recursos externos).
- [x] El encabezado con el logo se ve en `/` y en `/clientes` (renderizado una sola vez desde `app/layout.tsx`).
- [x] El logo es un enlace a `/` (`next/link`) con nombre accesible; la imagen tiene `alt="Logo de Barbería"`; el foco con teclado es visible.
- [x] Se usa `next/image` sin `priority` (deprecado) y sin activar `dangerouslyAllowSVG`; `next.config.ts` no cambia.
- [x] `app/icon.svg` existe y el `<head>` incluye `<link rel="icon" ... type="image/svg+xml">`.
- [x] Responsive: a 360px de ancho el logo no desborda ni genera scroll horizontal (altura `h-8`, `w-auto`).
- [x] `SiteHeader` es Server Component (sin `"use client"`).
- [x] No hay cambios en `app/api`, `lib` ni `supabase`.
- [x] `npm run lint` sin errores.
- [x] `npx tsc --noEmit` sin errores.
- [x] `npm run build` sin errores.
