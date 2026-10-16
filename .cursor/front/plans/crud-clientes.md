# CRUD de clientes (frontend)

## Objetivo
Crear el servicio de frontend que consume `/api/clientes` con errores tipados y una página `/clientes` sencilla y responsive para listar, buscar, crear, editar y eliminar clientes (nombre, correo, teléfono, detalle). Se añade un enlace desde la página raíz.

## Supuestos / dudas
- Contrato: sección 4.5 de `planifications/2026-10-16-crud-clientes.md`. El backend es la fuente de verdad de la validación; en el cliente solo se usan atributos HTML (`required`, `minLength`, `maxLength`, `type="email"`, `type="tel"`) para no duplicar reglas ni meter `zod` en el bundle.
- Reutilización de tipos (solo `import type`, se borran al compilar):
  - `Cliente` de `@/lib/types/cliente`.
  - `ApiErrorCode` y `ApiErrorDetails` de `@/lib/api/responses`. Ese archivo no importa `server-only`, pero importa `zod` y `lib/api/errors`, así que en el front **solo** se permite `import type`, nunca un import de valor.
- **Prohibido** importar en código de cliente `@/lib/supabase/*` y `@/lib/services/*` (usan `server-only` y romperían el build).
- Todo se hace en el navegador (fetch en un Client Component). La página `/clientes` es un Server Component estático que solo pinta el título y monta el componente cliente. Así se evita la interacción entre `cacheComponents` y datos de request: no se usa `useSearchParams` (la búsqueda y la paginación viven en el estado local), por lo que no hace falta `<Suspense>`. Ver `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` y `06-fetching-data.md`.
- No se usan Server Actions: el backend ya expone REST y la tarea pide "servicios en el frontend".
- Sin credenciales de Supabase en local, cualquier llamada válida devuelve 500 `INTERNAL_ERROR`. La UI muestra un aviso amigable con un botón "Reintentar". Los 400 de validación sí se pueden probar en local, porque el backend valida antes de tocar la BD.
- Paginación: `limit=20`, botones "Anterior/Siguiente" usando `meta.total`. Búsqueda con debounce de unos 300 ms, que vuelve a `offset=0`.
- Edición en el mismo formulario que la creación (un solo formulario arriba de la lista o en un panel; sin modal). Al editar se envía PATCH con los 4 campos; una cadena vacía la convierte el backend en `null`.
- Para eliminar se pide confirmación con `window.confirm` (es lo más sencillo y accesible); no se hace modal propio.
- Las fechas no se muestran (no se pidieron). Texto de la UI en español.

## Archivos
- Crear: `lib/client/clientes.ts`: servicio de fetch tipado (sin `"use client"` ni `server-only`; es un módulo de funciones puras usable desde componentes cliente).
- Crear: `app/clientes/page.tsx`: **Server Component**. Exporta `metadata` (title "Clientes") y renderiza `<main>` con un `<h1>Clientes</h1>`, un enlace "← Inicio" y `<ClientesManager />`.
- Crear: `app/clientes/_components/clientes-manager.tsx`: **Client Component** (`"use client"`). Contiene el estado, la carga, la búsqueda, la paginación y la orquestación de crear, editar y eliminar.
- Crear: `app/clientes/_components/cliente-form.tsx`: **Client Component**. Formulario controlado de crear/editar con errores por campo.
- Crear: `app/clientes/_components/clientes-list.tsx`: **Client Component** (presentacional). Lista o tabla responsive con las acciones Editar y Eliminar.
- Modificar: `app/page.tsx`: mantiene el `<h1>hola edteams</h1>` y añade debajo un `<Link href="/clientes">Gestionar clientes</Link>` (`next/link`). Sigue siendo Server Component.

## Pasos de implementación
1. **Servicio `lib/client/clientes.ts`**
   - Tipos exportados:
     - `ClienteInput = { nombre: string; correo?: string | null; telefono?: string | null; detalle?: string | null }`.
     - `ClienteUpdate = Partial<ClienteInput>`.
     - `ListClientesParams = { q?: string; limit?: number; offset?: number }`.
     - `ListClientesResponse = { data: Cliente[]; meta: { total: number; limit: number; offset: number } }`.
   - Clase `ApiClientError extends Error` con `status: number`, `code: ApiErrorCode | "NETWORK_ERROR"`, `fieldErrors: Record<string, string[]>` (por defecto `{}`) y `formErrors: string[]`.
   - Helper interno `request<T>(path: string, init?: RequestInit): Promise<T>`:
     - Usa `fetch` con `headers: { "Content-Type": "application/json", Accept: "application/json" }` y `cache: "no-store"`.
     - Si `fetch` lanza (red caída), lanza `ApiClientError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor")`.
     - Si `status === 204`, devuelve `undefined as T`.
     - Lee el cuerpo con `res.json()` dentro de try/catch. Si el cuerpo no es JSON, lo trata como `null`.
     - Si `!res.ok`, lanza `ApiClientError` con `body.error.code` y `body.error.message` y con `details.fieldErrors`/`formErrors` cuando existan. Si falta `body.error`, usa `INTERNAL_ERROR`.
     - Si la respuesta es correcta, devuelve el cuerpo tipado.
   - Funciones exportadas:
     - `listClientes(params?) : Promise<ListClientesResponse>`: construye `URLSearchParams` y omite `q` si viene vacío.
     - `getCliente(id): Promise<Cliente>`: devuelve `body.data`.
     - `createCliente(input: ClienteInput): Promise<Cliente>`: POST.
     - `updateCliente(id, input: ClienteUpdate): Promise<Cliente>`: PATCH.
     - `deleteCliente(id): Promise<void>`: DELETE.
     - `encodeURIComponent(id)` en las rutas con id.
   - Helper exportado `mensajeAmigable(err: unknown): string`, que traduce a texto en español:
     - `INTERNAL_ERROR` / 5xx → "No pudimos completar la operación. El servidor no está disponible en este momento; inténtalo más tarde."
     - `NETWORK_ERROR` → "Sin conexión con el servidor."
     - `NOT_FOUND` → "El cliente ya no existe."
     - `CORREO_DUPLICADO` → `err.message`.
     - `VALIDATION_ERROR` / `INVALID_JSON` → `formErrors[0] ?? err.message`.
     - Cualquier otro caso → "Ocurrió un error inesperado."
2. **`app/page.tsx`**: importar `Link` de `next/link` y renderizar debajo del `h1` un enlace con estilo de botón sencillo (`underline` o `rounded border px-4 py-2`). El contenedor `main` pasa a `flex-col gap-4`.
3. **`app/clientes/page.tsx`** (Server Component)
   - `export const metadata: Metadata = { title: "Clientes | edTeams" }`.
   - Layout: `main` con `mx-auto w-full max-w-4xl p-4 sm:p-6 flex flex-col gap-6`. Encabezado con `Link` a `/` y `h1`. Debajo, `<ClientesManager />`.
   - No hace fetch ni llama `connection()`: es contenido estático.
4. **`clientes-manager.tsx`** (Client Component)
   - Estado: `clientes: Cliente[]`, `total`, `offset`, `query` (input), `debouncedQuery`, `status: "loading" | "ready" | "error"`, `loadError: string | null`, `editing: Cliente | null`, `deletingId: string | null`, `notice: string | null` (mensaje de éxito).
   - Función `cargar()` que llama `listClientes({ q: debouncedQuery, limit: 20, offset })` y pone `status`. Si falla, `loadError = mensajeAmigable(err)`. Se ejecuta en un `useEffect` cuando cambian `[debouncedQuery, offset]`. Se ignoran respuestas obsoletas con un flag `ignore` o con `AbortController`, pasando `signal` al servicio mediante un `init` opcional.
   - Debounce: `useEffect` con `setTimeout(300)` que copia `query` a `debouncedQuery` y pone `offset` en 0.
   - Al crear o editar con éxito, se recarga la lista (`cargar()`), se limpia `editing` y se muestra el aviso "Cliente creado" o "Cliente actualizado".
   - Eliminar: `if (!window.confirm(\`¿Eliminar a ${c.nombre}? Esta acción no se puede deshacer.\`)) return;`. Durante la petición se pone `deletingId` para deshabilitar el botón. Si sale bien, se recarga y se avisa "Cliente eliminado". Si devuelve 404, también se recarga. Los demás errores se muestran como `notice` de error.
   - Si `offset >= total` tras eliminar y `offset > 0`, se retrocede una página.
   - Render, en este orden:
     1. Input de búsqueda (`type="search"`, `aria-label="Buscar clientes"`, placeholder "Buscar por nombre, correo o teléfono").
     2. `<ClienteForm>`.
     3. Mensaje `notice` en una región con `role="status"`.
     4. El estado de la lista:
        - `loading`: texto "Cargando clientes…" con `aria-busy`.
        - `error`: caja con `role="alert"`, el `loadError` y un botón "Reintentar".
        - `ready` sin datos: "Aún no hay clientes registrados." o, si hay búsqueda, "No hay clientes que coincidan con «q»".
        - `ready` con datos: `<ClientesList>` y la paginación "Mostrando X–Y de total", con Anterior/Siguiente deshabilitados en los extremos.
5. **`cliente-form.tsx`** (Client Component)
   - Props: `{ cliente: Cliente | null; onSaved: (c: Cliente, modo: "crear" | "editar") => void; onCancel: () => void }`.
   - Estado: `values` con los 4 campos como string (`null` → `""`), `fieldErrors: Record<string,string[]>`, `formError: string | null`, `submitting`. Se reinicia cuando cambia `cliente?.id` (usar `key={cliente?.id ?? "nuevo"}` desde el padre en lugar de un efecto).
   - Envío: `preventDefault`. Si hay `cliente`, llama `updateCliente(cliente.id, values)`; si no, `createCliente(values)`. Mientras tanto `submitting = true` y el botón muestra "Guardando…" y queda deshabilitado.
   - Errores:
     - `VALIDATION_ERROR`: `fieldErrors = err.fieldErrors` y `formError = err.formErrors[0]` (por ejemplo "No hay campos para actualizar").
     - `CORREO_DUPLICADO`: `fieldErrors = { correo: [err.message] }`.
     - `NOT_FOUND`: se muestra `formError` y se llama `onCancel()` para refrescar.
     - Cualquier otro error: `formError = mensajeAmigable(err)`.
   - Campos, cada uno con `<label htmlFor>`, `aria-invalid` y `aria-describedby` que apunta al `<p id="…-error" className="text-sm text-red-600">` con el primer mensaje:
     - `nombre`: `required`, `minLength={2}`, `maxLength={120}`.
     - `correo`: `type="email"`, `maxLength={254}`.
     - `telefono`: `type="tel"`, `maxLength={20}`.
     - `detalle`: `<textarea maxLength={1000} rows={3}>`.
   - Texto de ayuda: "Indica al menos correo o teléfono." El error de contacto del backend llega en `fieldErrors.correo`.
   - Botones: "Crear cliente" o "Guardar cambios" según el modo. En modo edición se añade "Cancelar", que llama `onCancel`. El título del formulario es "Nuevo cliente" o "Editar cliente".
   - Grid responsive: `grid gap-4 sm:grid-cols-2`. `detalle` ocupa `sm:col-span-2`.
6. **`clientes-list.tsx`** (Client Component, presentacional)
   - Props: `{ clientes: Cliente[]; onEdit: (c: Cliente) => void; onDelete: (c: Cliente) => void; deletingId: string | null }`.
   - En móvil, `<ul>` de tarjetas. Desde `sm:`, una tabla (`hidden sm:table` / `sm:hidden`) o una sola lista con `sm:grid` (elegir una opción y mantenerla simple).
   - Cada fila muestra el nombre (en negrita), el correo (o "—"), el teléfono (o "—") y el detalle truncado (`line-clamp-2`).
   - Acciones: botones `type="button"` "Editar" y "Eliminar", con `aria-label` que incluye el nombre del cliente. "Eliminar" queda deshabilitado y muestra "Eliminando…" si `deletingId === c.id`.
   - Al pulsar Editar, el padre hace scroll al formulario o le pone foco (`formRef.current?.scrollIntoView()`).
7. **Estilos**: solo utilidades de Tailwind 4, respetando las variables `--background`/`--foreground` existentes (no fijar `bg-white` sin su variante `dark:`; usar `border-current/20` o `bg-foreground/5`). Con un ancho de 360 px no debe haber scroll horizontal.
8. Ejecutar `npx tsc --noEmit` y `npm run lint`.
9. Prueba manual con `npm run dev`:
   - `/` muestra el enlace.
   - `/clientes` sin credenciales muestra la caja de error amigable con "Reintentar".
   - Crear sin nombre y sin contacto muestra los errores por campo que devuelve el backend (400).
   - Crear con datos válidos muestra el mensaje amigable de 500.

## Criterios de aceptación
- [x] Existe `lib/client/clientes.ts` con `listClientes`, `getCliente`, `createCliente`, `updateCliente`, `deleteCliente`, la clase `ApiClientError` y `mensajeAmigable`, todo tipado sin `any`.
- [x] Ningún archivo del front importa `@/lib/supabase/*` ni `@/lib/services/*`, y desde `@/lib/api/responses` solo se usa `import type`.
- [x] `/` sigue mostrando "hola edteams" y tiene un `Link` funcional a `/clientes`.
- [x] `app/clientes/page.tsx` es un Server Component (sin `"use client"`) con metadata. Los componentes interactivos tienen `"use client"`.
- [x] La lista muestra estados de carga, vacío (con y sin búsqueda) y error con botón "Reintentar".
- [x] La búsqueda aplica debounce, consulta `?q=` y reinicia la paginación. La paginación usa `meta.total` y deshabilita los botones en los extremos.
- [x] Crear: POST y, si sale bien, recarga la lista y muestra el aviso. Editar: precarga el formulario, envía PATCH y permite cancelar.
- [x] Eliminar pide confirmación, deshabilita el botón durante la petición y recarga la lista tras el 204.
- [x] Los errores 400 `VALIDATION_ERROR` se muestran bajo cada campo (`details.fieldErrors`). 409 `CORREO_DUPLICADO` aparece en el campo correo. 404 y 500 muestran un mensaje amigable en español (nunca un JSON crudo ni un stack).
- [x] Sin credenciales de Supabase, la página no se rompe y muestra un aviso amigable.
- [x] Accesibilidad: inputs con `label`, `aria-invalid` y `aria-describedby` en los campos con error, errores globales con `role="alert"`, avisos con `role="status"`, y botones con texto o `aria-label` descriptivo.
- [ ] Responsive: se usa sin scroll horizontal a 360 px y se ve bien a 1280 px. Funciona en modo claro y oscuro.
- [x] `npx tsc --noEmit` y `npm run lint` pasan sin errores. `npm run build` compila sin errores de prerender en `/clientes`.
