# Limpieza del proyecto y página "hola edteams"

## Objetivo
Eliminar el contenido de plantilla de Create Next App (assets, fuentes, estilos, textos) y dejar una única página en `/` que muestre "hola edteams", sin romper build ni lint.

## Supuestos / dudas
- Se mantiene Tailwind CSS 4 (`@import "tailwindcss";` en `globals.css`) para usarlo en próximas tareas; la página usará solo clases utilitarias mínimas.
- Se eliminan las fuentes Geist: la fuente queda la del sistema (`font-sans` de Tailwind).
- Se mantiene `app/favicon.ico`.
- `lang` del `<html>` pasa a `"es"` (contenido en español). Metadata: title `"edTeams"`, description breve en español (supuesto razonable, ajustable).
- Se mantiene el soporte de modo oscuro mínimo (variables `--background`/`--foreground`) por ser 6 líneas útiles; si se prefiere, puede eliminarse por completo dejando solo el import de Tailwind.
- `LayoutProps<"/">` es un helper global tipado por Next 16 (ver `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`); se conserva.
- `next.config.ts` (flags `cacheComponents`, `partialPrefetching`, regla turbopack para CSS) NO se toca.
- No se tocan: `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.git`, `node_modules`, `.next`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `next-env.d.ts`.

## Archivos
- Eliminar: `public/file.svg`, `public/globe.svg`, `public/window.svg` — no se usan en ningún archivo.
- Eliminar: `public/next.svg`, `public/vercel.svg` — solo los usa la plantilla de `app/page.tsx`, que se reemplaza.
- Eliminar: carpeta `public/` si queda vacía (git no versiona carpetas vacías; Next funciona sin ella).
- Modificar: `app/page.tsx` — Server Component mínimo que renderiza "hola edteams".
- Modificar: `app/layout.tsx` — quitar fuentes Geist y metadata de plantilla.
- Modificar: `app/globals.css` — quitar referencias a fuentes Geist y la `font-family: Arial...`.
- Modificar: `README.md` — reducir a descripción mínima del proyecto y comandos.

## Pasos de implementación
1. Borrar `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`. Borrar `public/` si queda vacía.
2. Reescribir `app/page.tsx` (Server Component, sin `"use client"`, sin imports):
   - `export default function Home()` que retorna un `<main>` centrado (ej. `flex flex-1 items-center justify-center`) con un `<h1>` cuyo texto exacto es `hola edteams`.
   - Eliminar `import Image from "next/image"` y todos los enlaces/imágenes de plantilla.
3. Editar `app/layout.tsx`:
   - Eliminar `import { Geist, Geist_Mono } from "next/font/google"` y las constantes `geistSans` / `geistMono`.
   - Mantener `import type { Metadata } from "next"` e `import "./globals.css"`.
   - `metadata`: `title: "edTeams"`, `description: "Proyecto Barbería edTeams"`.
   - `<html lang="es" className="h-full antialiased">` (sin variables de fuente); `<body className="min-h-full flex flex-col">` se mantiene.
   - Mantener firma `RootLayout({ children }: LayoutProps<"/">)`.
4. Editar `app/globals.css`:
   - Mantener `@import "tailwindcss";`.
   - Mantener `:root` con `--background`/`--foreground` y el bloque `@media (prefers-color-scheme: dark)`.
   - En `@theme inline` dejar solo `--color-background` y `--color-foreground`; eliminar `--font-sans` y `--font-mono`.
   - En `body` mantener `background` y `color`; eliminar `font-family: Arial, Helvetica, sans-serif;`.
5. Reescribir `README.md`: título "Barbería edTeams", una línea de descripción (Next.js 16 + Tailwind 4) y comandos `npm install`, `npm run dev`, `npm run build`, `npm run lint`. Sin enlaces de plantilla de Vercel.
6. Verificar: `grep -r "geist\|next.svg\|vercel.svg\|Create Next App" app README.md` no devuelve resultados.
7. Ejecutar `npm run lint` y `npm run build`; ambos deben terminar sin errores.
8. Ejecutar `npm run dev`, abrir `http://localhost:3000` y confirmar que solo se ve "hola edteams".

## Criterios de aceptación
- [x] `/` muestra únicamente el texto "hola edteams" dentro de un `<h1>`, centrado.
- [x] `public/` no contiene los SVG de plantilla (o no existe).
- [x] `app/` contiene solo `favicon.ico`, `globals.css`, `layout.tsx`, `page.tsx`.
- [x] No quedan referencias a Geist, `next/image`, SVG de plantilla ni "Create Next App" en `app/` ni `README.md`.
- [x] `<html lang="es">` y title de pestaña "edTeams".
- [x] `page.tsx` y `layout.tsx` son Server Components (sin `"use client"`).
- [x] `npm run lint` y `npm run build` pasan sin errores ni warnings de tipos.
- [x] Archivos protegidos (`.claude/`, `CLAUDE.md`, `AGENTS.md`, configs de build/lint) sin cambios.
- [x] Texto legible en modo claro y oscuro.
