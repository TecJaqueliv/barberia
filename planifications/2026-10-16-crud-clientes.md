# CRUD de clientes de la barbería

## 1. Resumen
Se necesita registrar y administrar los clientes de la barbería con los datos mínimos: nombre, correo electrónico, teléfono y un detalle/notas libre. Se crea la tabla `public.clientes` en Supabase (migración SQL) y un CRUD REST en Route Handlers de Next.js (`app/api/clientes`) que actúa como único punto de acceso a la tabla. El proyecto parte de una plantilla limpia (sin `lib/`, `supabase/`, `app/api/`, dependencias de Supabase ni `.env`), por lo que este plan también define la infraestructura mínima (cliente Supabase de servidor, validaciones, variables de entorno). La UI y los servicios de frontend los planificará el equipo de front a partir del apartado "Contrato para frontend".

## 2. Supuestos y preguntas abiertas
| # | Ambigüedad | Decisión por defecto |
|---|------------|----------------------|
| S1 | No hay autenticación de usuarios. ¿Quién puede usar el CRUD? | La API es pública en esta fase (sin 401/403). La protección de la BD se logra porque **solo el servidor de Next** accede a la tabla usando `SUPABASE_SERVICE_ROLE_KEY`. Cuando exista auth se añadirá en otro plan (ver Riesgos). |
| S2 | Enfoque RLS | `clientes` tiene **RLS habilitado y sin ninguna política** para `anon` ni `authenticated` → ambos roles quedan denegados por defecto (ni siquiera con la anon key pública se puede leer/escribir). `service_role` omite RLS (bypass) y es el que usa la API. Además se revocan los privilegios de tabla a `anon`/`authenticated` como defensa en profundidad. |
| S3 | ¿Qué campos son obligatorios? | `nombre` obligatorio. `correo`, `telefono` y `detalle` opcionales, pero se exige **al menos uno de `correo` o `telefono`** (un cliente sin forma de contacto no es útil). |
| S4 | ¿El correo es único? | Sí, único sin distinguir mayúsculas (índice único sobre `lower(correo)` cuando no es null). Se guarda normalizado en minúsculas. Duplicado → 409. El teléfono **no** es único (familias pueden compartir teléfono). |
| S5 | Formato de teléfono | Texto libre validado de forma laxa: 7–20 caracteres, solo dígitos, espacios, `+`, `-`, `(`, `)`. No se normaliza a E.164. |
| S6 | Nombre de la columna "detalle" | `detalle` (`text`, máx. 1000 caracteres). |
| S7 | Borrado | Borrado físico (`DELETE`). No hay tablas dependientes todavía; cuando existan citas se decidirá `on delete` en su propio plan. |
| S8 | Paginación/búsqueda en listado | Paginación simple `limit`/`offset` y búsqueda opcional `q` por nombre, correo o teléfono (`ilike`). Orden fijo `created_at desc`. |
| S9 | Actualización | `PATCH` parcial (solo los campos enviados). No se implementa `PUT`. |
| S10 | Nombres en español vs inglés | Tabla y columnas en español (`clientes`, `nombre`, `correo`, `telefono`, `detalle`) por coherencia con el dominio; JSON de la API usa exactamente los mismos nombres (snake_case). |
| S11 | Seeds | No se requieren. Opcionalmente `supabase/seed.sql` con 3 clientes de ejemplo solo para desarrollo local (no obligatorio). |
| S12 | `cacheComponents: true` en `next.config.ts` | Con Cache Components los `GET` de Route Handlers pueden prerenderizarse si no acceden a datos de request. Los `GET` deben llamar `await connection()` (de `next/server`) antes de consultar Supabase para garantizar ejecución en tiempo de request y no servir datos congelados del build. |
| P1 (abierta) | ¿Se requiere auditoría (quién creó/editó)? | No por ahora. |

## 3. Modelo de datos (para backend-migrations)

### Archivo de migración
`supabase/migrations/20261016120000_create_clientes.sql`

### Tabla `public.clientes`
| Columna | Tipo | Null | Default | Notas |
|---------|------|------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `nombre` | `text` | NOT NULL | — | `check (char_length(btrim(nombre)) between 2 and 120)` |
| `correo` | `text` | NULL | — | `check (correo is null or correo = lower(correo))` y `check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')`; `check (char_length(correo) <= 254)` |
| `telefono` | `text` | NULL | — | `check (telefono is null or telefono ~ '^[0-9+()\s-]{7,20}$')` |
| `detalle` | `text` | NULL | — | `check (detalle is null or char_length(detalle) <= 1000)` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Actualizado por trigger |

Constraints adicionales:
- `constraint clientes_pkey primary key (id)`
- `constraint clientes_contacto_chk check (correo is not null or telefono is not null)`
- Nombrar todas las constraints explícitamente: `clientes_nombre_chk`, `clientes_correo_formato_chk`, `clientes_correo_minusculas_chk`, `clientes_correo_longitud_chk`, `clientes_telefono_chk`, `clientes_detalle_chk`, `clientes_contacto_chk`.

### Índices
- `create unique index if not exists clientes_correo_unique_idx on public.clientes (lower(correo)) where correo is not null;` → permite detectar duplicados (Postgres error `23505`).
- `create index if not exists clientes_created_at_idx on public.clientes (created_at desc);` → listado ordenado.
- (No se crea índice trigram para `q`; volumen esperado pequeño. Ver Riesgos.)

### Enums / tipos
Ninguno.

### Función y trigger `updated_at`
- `create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;` (genérica, reutilizable por futuras tablas; **no** `security definer`).
- `drop trigger if exists clientes_set_updated_at on public.clientes;`
- `create trigger clientes_set_updated_at before update on public.clientes for each row execute function public.set_updated_at();`

### RLS y privilegios
```sql
alter table public.clientes enable row level security;
-- Sin políticas para anon ni authenticated: acceso denegado por defecto.
-- service_role ignora RLS (bypassrls) y es el único rol que usa la API de Next.
revoke all on table public.clientes from anon, authenticated;
grant select, insert, update, delete on table public.clientes to service_role;
```
- Documentar en un comentario SQL que la ausencia de políticas es **intencional**.
- `comment on table public.clientes is 'Clientes de la barbería. Acceso solo vía API de Next (service_role).';`

### Orden dentro de la migración
tabla → constraints → índices → función → trigger → RLS → revoke/grant → comentarios.

### Datos semilla
No obligatorios (ver S11).

## 4. API / lógica de negocio (para backend-api)

### 4.1 Infraestructura nueva
**Dependencias** (instalar con npm):
- `@supabase/supabase-js` (cliente; no se necesita `@supabase/ssr` porque no hay sesión de usuario).
- `zod` (validación).
- `server-only` (impide importar el cliente admin desde Client Components).

**Variables de entorno** (crear `.env.example` y añadir `!.env.example` a `.gitignore`, que hoy ignora `.env*`):
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # SOLO servidor, nunca NEXT_PUBLIC_
```
No se usan `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY` en esta fase (el navegador nunca habla con Supabase directamente). Si el equipo prefiere reutilizar `NEXT_PUBLIC_SUPABASE_URL` para la URL es aceptable, pero la service key jamás lleva prefijo `NEXT_PUBLIC_`.

**Archivos**:
| Archivo | Contenido |
|---------|-----------|
| `lib/supabase/admin.ts` | `import 'server-only'`. Exporta `getSupabaseAdmin()` que crea (y memoiza) `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`. Lanza error claro si falta alguna variable. |
| `lib/types/cliente.ts` | `type Cliente = { id: string; nombre: string; correo: string \| null; telefono: string \| null; detalle: string \| null; created_at: string; updated_at: string }`. |
| `lib/validations/cliente.ts` | Esquemas zod: `clienteCreateSchema`, `clienteUpdateSchema`, `clienteIdSchema`, `clienteListQuerySchema` (ver 4.3). Tipos inferidos exportados. |
| `lib/services/clientes.ts` | `import 'server-only'`. Funciones `listClientes`, `getClienteById`, `createCliente`, `updateCliente`, `deleteCliente`. Encapsulan las consultas Supabase y traducen errores Postgres a errores de dominio (`ConflictError`, `NotFoundError`). |
| `lib/api/responses.ts` (o `lib/http.ts`) | Helpers `ok(data, status)`, `fail(status, code, message, details?)` y `handleError(err)` para respuestas consistentes. |
| `app/api/clientes/route.ts` | `GET` (listar), `POST` (crear). |
| `app/api/clientes/[id]/route.ts` | `GET` (obtener), `PATCH` (actualizar), `DELETE` (eliminar). |

**Convenciones Next 16** (leído en `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `03-api-reference/03-file-conventions/route.md`):
- `context.params` es una **Promise**: `const { id } = await ctx.params`. Tipar con el helper global `RouteContext<'/api/clientes/[id]'>`.
- `GET` deben iniciar con `await connection()` (`import { connection } from 'next/server'`) por `cacheComponents: true` (S12).
- Usar `Response.json(...)` / `NextResponse.json(...)`; `204` con `new Response(null, { status: 204 })`.
- Métodos no exportados → Next devuelve 405 automáticamente (no implementar `PUT`).

### 4.2 Formato de respuestas
- Éxito: `{ "data": ... }` (listado añade `"meta"`).
- Error: `{ "error": { "code": string, "message": string, "details"?: object } }`.

Códigos de error (`error.code`):
| HTTP | code | Cuándo |
|------|------|--------|
| 400 | `VALIDATION_ERROR` | Body/query/params inválidos (incluye `details` = `z.flattenError(...)` / `error.flatten()` con errores por campo). |
| 400 | `INVALID_JSON` | Body no parseable como JSON. |
| 404 | `NOT_FOUND` | No existe cliente con ese `id`. |
| 409 | `CORREO_DUPLICADO` | Violación de `clientes_correo_unique_idx` (Postgres `23505`). |
| 500 | `INTERNAL_ERROR` | Cualquier otro error; mensaje genérico, se loguea con `console.error` en servidor sin exponer detalles. |

### 4.3 Validaciones (zod)
Preprocesado común para strings: `trim()`; cadena vacía → `null` en campos opcionales.
- `nombre`: string, trim, 2–120 caracteres. Requerido en create.
- `correo`: email válido (`z.email()` o `z.string().email()`), trim, `toLowerCase()`, máx. 254; opcional/nullable.
- `telefono`: regex `^[0-9+()\s-]{7,20}$`, trim; opcional/nullable.
- `detalle`: string trim, máx. 1000; opcional/nullable.
- `clienteCreateSchema`: objeto estricto (`.strict()`, rechaza campos desconocidos como `id`, `created_at`) + refine: `correo` o `telefono` no nulo → si no, error en path `["correo"]` con mensaje "Debe indicar correo o teléfono".
- `clienteUpdateSchema`: mismos campos todos opcionales, `.strict()`, refine: al menos un campo presente (si body vacío → 400 "No hay campos para actualizar").
- `clienteIdSchema`: `z.uuid()` (o `z.string().uuid()`).
- `clienteListQuerySchema`: `q` string opcional trim máx. 100; `limit` entero 1–100 default 20 (coerce); `offset` entero ≥ 0 default 0 (coerce).

### 4.4 Endpoints

#### GET `/api/clientes` — listar
- Archivo: `app/api/clientes/route.ts`. Auth: ninguna (S1).
- Query: `q?`, `limit?` (1–100, default 20), `offset?` (≥0, default 0).
- Reglas:
  1. `await connection()`.
  2. Validar query → 400 si inválida.
  3. `select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1)`.
  4. Si `q`: escapar `%`, `_`, `,`, `(`, `)` y aplicar `.or('nombre.ilike.%q%,correo.ilike.%q%,telefono.ilike.%q%')`.
- 200: `{ "data": Cliente[], "meta": { "total": number, "limit": number, "offset": number } }`.
- Errores: 400 `VALIDATION_ERROR`, 500.
- Tabla: lee `clientes`.

#### POST `/api/clientes` — crear
- Body: `{ nombre, correo?, telefono?, detalle? }`.
- Reglas:
  1. `request.json()` en try/catch → 400 `INVALID_JSON`.
  2. Validar con `clienteCreateSchema` → 400.
  3. `insert(payload).select().single()`.
  4. Error `23505` → 409 `CORREO_DUPLICADO` ("Ya existe un cliente con ese correo").
- 201: `{ "data": Cliente }`. Opcional header `Location: /api/clientes/{id}`.
- Errores: 400, 409, 500. Tabla: escribe `clientes`.

#### GET `/api/clientes/[id]` — obtener
- Archivo: `app/api/clientes/[id]/route.ts`.
- Reglas: `await connection()`; `const { id } = await ctx.params`; validar uuid → 400; `select('*').eq('id', id).maybeSingle()`; null → 404.
- 200: `{ "data": Cliente }`. Errores: 400, 404, 500. Tabla: lee `clientes`.

#### PATCH `/api/clientes/[id]` — actualizar parcial
- Body: cualquier subconjunto de `{ nombre, correo, telefono, detalle }` (enviar `null` o `""` borra un campo opcional).
- Reglas:
  1. Validar `id` → 400. Parsear JSON → 400 `INVALID_JSON`. Validar con `clienteUpdateSchema` → 400.
  2. Regla de contacto sobre el **estado resultante**: leer el cliente actual (404 si no existe), combinar con el patch y comprobar que `correo` o `telefono` queden no nulos → si no, 400 `VALIDATION_ERROR` ("Debe indicar correo o teléfono"). (La constraint `clientes_contacto_chk` es la red de seguridad; si salta, Postgres `23514` → 400 `VALIDATION_ERROR`.)
  3. `update(patch).eq('id', id).select().maybeSingle()`; null → 404.
  4. `23505` → 409 `CORREO_DUPLICADO`.
  5. `updated_at` lo pone el trigger; no enviarlo desde la API.
- 200: `{ "data": Cliente }`. Errores: 400, 404, 409, 500. Tabla: lee/escribe `clientes`.

#### DELETE `/api/clientes/[id]` — eliminar
- Reglas: validar uuid → 400; `delete().eq('id', id).select('id')`; 0 filas → 404.
- 204 sin cuerpo. Errores: 400, 404, 500. Tabla: escribe `clientes`.

### 4.5 Contrato para frontend
Base: mismo origen, `/api/clientes`. Todas las respuestas son JSON (salvo 204). Enviar `Content-Type: application/json`.

```ts
type Cliente = {
  id: string;            // uuid
  nombre: string;
  correo: string | null;
  telefono: string | null;
  detalle: string | null;
  created_at: string;    // ISO 8601
  updated_at: string;    // ISO 8601
};
type ApiError = { error: { code: 'VALIDATION_ERROR' | 'INVALID_JSON' | 'NOT_FOUND' | 'CORREO_DUPLICADO' | 'INTERNAL_ERROR'; message: string; details?: { formErrors: string[]; fieldErrors: Record<string, string[]> } } };
```

| Método | Ruta | Body | Éxito |
|--------|------|------|-------|
| GET | `/api/clientes?q=&limit=20&offset=0` | — | 200 `{ data: Cliente[], meta: { total, limit, offset } }` |
| GET | `/api/clientes/{id}` | — | 200 `{ data: Cliente }` |
| POST | `/api/clientes` | `{ nombre: string, correo?: string\|null, telefono?: string\|null, detalle?: string\|null }` (correo o teléfono obligatorio) | 201 `{ data: Cliente }` |
| PATCH | `/api/clientes/{id}` | subconjunto de los campos anteriores (al menos uno) | 200 `{ data: Cliente }` |
| DELETE | `/api/clientes/{id}` | — | 204 sin cuerpo |

Errores posibles: 400 (`VALIDATION_ERROR` con `details.fieldErrors` para mostrar por campo, `INVALID_JSON`), 404 `NOT_FOUND`, 409 `CORREO_DUPLICADO` (mostrar en el campo correo), 500 `INTERNAL_ERROR`. El frontend **no** debe usar Supabase directamente ni conocer ninguna key.

## 5. Criterios de aceptación

### Migraciones
- [ ] Existe `supabase/migrations/20261016120000_create_clientes.sql` (o timestamp equivalente con sufijo `_create_clientes.sql`).
- [ ] Crea `public.clientes` con `create table if not exists` y exactamente las columnas `id, nombre, correo, telefono, detalle, created_at, updated_at` con los tipos/nulabilidad/defaults de la sección 3.
- [ ] `id uuid primary key default gen_random_uuid()`.
- [ ] Constraints CHECK nombradas: `clientes_nombre_chk`, `clientes_correo_formato_chk`, `clientes_correo_minusculas_chk`, `clientes_correo_longitud_chk`, `clientes_telefono_chk`, `clientes_detalle_chk`, `clientes_contacto_chk`.
- [ ] Índice único parcial `clientes_correo_unique_idx` sobre `lower(correo)` `where correo is not null`.
- [ ] Índice `clientes_created_at_idx` sobre `created_at desc`.
- [ ] Función `public.set_updated_at()` con `create or replace`, `set search_path = public`, sin `security definer`.
- [ ] Trigger `clientes_set_updated_at` `before update ... for each row`, precedido de `drop trigger if exists`.
- [ ] `alter table public.clientes enable row level security;` presente.
- [ ] **No** existe ninguna `create policy` sobre `clientes` para `anon` ni `authenticated` (y hay comentario explicando que es intencional).
- [ ] `revoke all ... from anon, authenticated` y `grant select, insert, update, delete ... to service_role`.
- [ ] Bloques comentados; orden tabla → índices → función → trigger → RLS → grants.

### API
- [ ] `package.json` incluye `@supabase/supabase-js`, `zod` y `server-only`.
- [ ] Existe `.env.example` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; `.gitignore` contiene `!.env.example`. Ninguna variable con la service key tiene prefijo `NEXT_PUBLIC_`.
- [ ] `lib/supabase/admin.ts` importa `server-only`, lee variables de entorno (sin secretos hardcodeados), usa `persistSession: false` y falla con mensaje claro si faltan.
- [ ] `lib/services/clientes.ts` contiene las 5 operaciones y es el único sitio que llama a `.from('clientes')`.
- [ ] `lib/validations/cliente.ts` define los esquemas de 4.3 con `.strict()`, trim, correo en minúsculas, cadena vacía → null, y la regla "correo o teléfono".
- [ ] `app/api/clientes/route.ts` exporta solo `GET` y `POST`; `app/api/clientes/[id]/route.ts` exporta solo `GET`, `PATCH`, `DELETE`.
- [ ] `params` se obtiene con `await` (Promise) y está tipado (`RouteContext<'/api/clientes/[id]'>` o equivalente).
- [ ] Los handlers `GET` llaman `await connection()` antes de consultar.
- [ ] `id` no uuid → 400 `VALIDATION_ERROR` sin llegar a la BD.
- [ ] Body no JSON → 400 `INVALID_JSON`.
- [ ] POST sin correo ni teléfono → 400; PATCH que deja ambos nulos → 400.
- [ ] PATCH con body vacío `{}` → 400.
- [ ] Campos desconocidos (`id`, `created_at`, etc.) en POST/PATCH → 400.
- [ ] Error Postgres `23505` → 409 `CORREO_DUPLICADO`.
- [ ] GET/PATCH/DELETE de id inexistente → 404 `NOT_FOUND`.
- [ ] POST → 201 `{ data }`; GET lista → 200 `{ data, meta: { total, limit, offset } }`; DELETE → 204 sin cuerpo.
- [ ] `limit` fuera de 1–100 u `offset` negativo → 400; defaults 20/0.
- [ ] Búsqueda `q` escapa caracteres especiales del filtro `.or()` de PostgREST.
- [ ] Errores inesperados → 500 `INTERNAL_ERROR` con mensaje genérico; detalle solo en `console.error`.
- [ ] Ningún archivo bajo `app/` con `'use client'` importa `lib/supabase/admin.ts` ni `lib/services/*`.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan sin errores.

## 6. Orden de implementación
1. **backend-migrations**: crear `supabase/migrations/20261016120000_create_clientes.sql` (y opcionalmente `supabase/seed.sql`). Validar localmente con Supabase CLI si está disponible; no hacer `db push` remoto sin autorización.
2. **backend-api**:
   1. `npm install @supabase/supabase-js zod server-only`.
   2. `.env.example` + ajuste de `.gitignore`.
   3. `lib/types/cliente.ts`, `lib/supabase/admin.ts`, `lib/validations/cliente.ts`, `lib/api/responses.ts`.
   4. `lib/services/clientes.ts`.
   5. `app/api/clientes/route.ts` y `app/api/clientes/[id]/route.ts`.
   6. `npx tsc --noEmit` y `npm run lint`.
3. **backend-validator**: revisar contra la sección 5.
4. Equipo de front: servicios y UI usando el contrato 4.5.

## 7. Riesgos y consideraciones
- **Seguridad (principal)**: la API es pública y usa `service_role`, que omite RLS. Cualquiera que alcance `/api/clientes` puede leer/modificar datos personales (PII: correo, teléfono). Aceptable solo para desarrollo/demo. Antes de producción: añadir autenticación (Supabase Auth + `@supabase/ssr`) y, idealmente, migrar a cliente con sesión de usuario y políticas RLS para `authenticated`, o proteger la API con `proxy` (ex-middleware) / verificación de sesión en cada handler.
- **Fuga de la service key**: solo en variables sin `NEXT_PUBLIC_`; `server-only` en `lib/supabase/admin.ts` y `lib/services/*` rompe el build si se importa en cliente. No loguear la key.
- **`.gitignore`**: hoy ignora `.env*`; sin `!.env.example` el ejemplo no se versiona. `.env.local` nunca debe commitearse.
- **Cache Components**: sin `connection()` un `GET` podría prerenderizarse en build y servir datos obsoletos o fallar si no hay variables de entorno en build.
- **Concurrencia**: la unicidad del correo la garantiza el índice único (no solo una comprobación previa en código), evitando condiciones de carrera. La validación "correo o teléfono" en PATCH hace lectura + escritura no atómica; la constraint `clientes_contacto_chk` cubre la carrera (mapear `23514` → 400).
- **Inyección en filtros PostgREST**: `q` se interpola en `.or()`; debe escaparse para evitar alterar el filtro.
- **Rendimiento**: `ilike '%q%'` hace scan secuencial; aceptable para el volumen de una barbería. Si crece, añadir `pg_trgm` + índices GIN.
- **Privacidad**: datos personales; considerar en el futuro política de retención y consentimiento (Habeas Data / normativa local).
- **Futuro**: cuando exista la tabla de citas con FK a `clientes`, revisar si el borrado debe pasar a lógico (`deleted_at`) o `on delete restrict`.
