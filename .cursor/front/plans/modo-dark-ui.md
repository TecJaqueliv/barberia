# Cambiar el UI a modo oscuro

## Objetivo
Que toda la app (home `/` y `/clientes`) se muestre siempre en modo oscuro, sin importar la preferencia del sistema, con buen contraste en textos, bordes, inputs, botones y mensajes de estado.

## Supuestos / dudas
- Supuesto: el modo oscuro es fijo (no se pide un selector claro/oscuro). Se elimina la dependencia de `prefers-color-scheme`.
- Supuesto: se mantienen los tokens actuales `--background` / `--foreground` (Tailwind 4 `@theme inline`) con los valores oscuros ya definidos (`#0a0a0a` / `#ededed`); los componentes ya usan `bg-background`, `bg-foreground`, `text-background`, `border-current/20`, `hover:bg-foreground/5`, por lo que heredan el tema sin reescribirlos.
- Supuesto: los colores de estado (rojo/verde) se ajustan a tonos claros (`red-400`, `green-400`) para contraste AA sobre fondo oscuro.
- Next 16: `colorScheme` y `themeColor` van en `export const viewport` (no en `metadata`); ver `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`.
- No se toca `app/api`, `lib` ni `supabase`.
- Sin dudas bloqueantes.

## Archivos
- Modificar: `app/globals.css` — valores oscuros fijos en `:root`, `color-scheme: dark`, quitar el bloque `@media (prefers-color-scheme: dark)`, variante `dark` siempre activa.
- Modificar: `app/layout.tsx` — clase `dark` en `<html>` y `export const viewport` con `colorScheme: "dark"` y `themeColor: "#0a0a0a"` (Server Component).
- Modificar: `app/clientes/_components/cliente-form.tsx` — colores de error y de inputs adaptados a oscuro.
- Modificar: `app/clientes/_components/clientes-list.tsx` — botón Eliminar en rojo claro.
- Modificar: `app/clientes/_components/clientes-manager.tsx` — mensajes ok/error y bloque de error con colores claros; input de búsqueda coherente con los del formulario.
- Revisar (sin cambios previstos): `app/page.tsx`, `app/clientes/page.tsx` — ya usan tokens/`current`.

## Pasos de implementación
1. `app/globals.css`:
   - En `:root` poner `--background: #0a0a0a; --foreground: #ededed;` y añadir `color-scheme: dark;` (scrollbars, controles nativos y autofill oscuros).
   - Eliminar el bloque `@media (prefers-color-scheme: dark) { ... }`.
   - Añadir debajo de `@import "tailwindcss";` la variante: `@custom-variant dark (&:where(.dark, .dark *));` para que las utilidades `dark:` existentes (p. ej. `dark:text-green-400`) dependan de la clase y no del sistema.
   - Opcional de contraste: añadir tokens `--muted: #a1a1aa` y `--border: #2e2e2e` NO es necesario; mantener `border-current/20` y `opacity-70` existentes.
2. `app/layout.tsx` (Server Component):
   - Importar `Viewport` de `"next"` junto a `Metadata`.
   - Añadir `export const viewport: Viewport = { colorScheme: "dark", themeColor: "#0a0a0a" };`.
   - Cambiar `<html lang="es" className="h-full antialiased">` a `className="dark h-full antialiased"`.
   - En `<body>` añadir `bg-background text-foreground` a las clases existentes (redundante con globals, refuerza el tema).
3. `app/clientes/_components/cliente-form.tsx`:
   - `inputClass`: cambiar `aria-[invalid=true]:border-red-600` por `aria-[invalid=true]:border-red-400` y añadir `placeholder:text-foreground/50` y `focus:outline-none focus:ring-2 focus:ring-foreground/40` (foco visible en oscuro).
   - Mensajes de error de campo y de formulario (`text-red-600`, líneas ~127 y ~210): cambiar a `text-red-400`.
   - Botón primario (`bg-foreground text-background`) se mantiene: queda claro sobre oscuro con texto oscuro.
4. `app/clientes/_components/clientes-list.tsx`:
   - Botón Eliminar: `border-red-600/40 text-red-600 hover:bg-red-600/10` → `border-red-400/40 text-red-400 hover:bg-red-400/10`.
5. `app/clientes/_components/clientes-manager.tsx`:
   - Aviso de estado: `"text-green-700 dark:text-green-400"` → `"text-green-400"`; `"text-red-600"` → `"text-red-400"`.
   - Bloque de error de carga: `border-red-600/40 bg-red-600/5` → `border-red-400/40 bg-red-400/10`; si hay texto `text-red-600` dentro, pasarlo a `text-red-400`.
   - Input de búsqueda: añadir las mismas clases de placeholder y foco que el paso 3.
6. Buscar con `grep -rn "red-600\|green-700\|bg-white\|text-black\|gray-" app --include=*.tsx` (excluyendo `app/api`) y adaptar cualquier color claro restante a su equivalente oscuro (`-400` / tokens).
7. Ejecutar `npm run lint` y `npx tsc --noEmit`; corregir errores.
8. Ejecutar `npm run dev` y revisar `/` y `/clientes` con el sistema en tema claro y en tema oscuro: ambos deben verse idénticos (oscuros).

## Criterios de aceptación
- [x] Con el SO en modo claro, `/` y `/clientes` se ven con fondo `#0a0a0a` y texto `#ededed`.
- [x] No queda ningún `@media (prefers-color-scheme` en `app/globals.css`.
- [x] `<html>` tiene clase `dark` y el HTML renderizado incluye `<meta name="color-scheme" content="dark">` y `<meta name="theme-color" content="#0a0a0a">`.
- [x] Inputs, textarea y select tienen fondo oscuro, texto claro, placeholder legible y foco visible.
- [x] Textos de error/éxito y el botón Eliminar usan tonos `-400` legibles (contraste AA sobre fondo oscuro).
- [x] Botón primario (Guardar) mantiene alto contraste (fondo claro, texto oscuro).
- [x] Responsive sin cambios respecto al estado anterior (móvil y escritorio).
- [x] No se modificaron archivos en `app/api`, `lib` ni `supabase`.
- [x] `npm run lint` y `npx tsc --noEmit` sin errores.
