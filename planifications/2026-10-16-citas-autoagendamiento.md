# BARB-5 — Autoagendamiento de citas (backend del calendario)

## 1. Resumen
El cliente debe poder ver un calendario con las franjas libres y reservar su cita sin intervención del personal. Este plan cubre **solo el backend**: catálogo de servicios con duración y precio (`servicios`, que también alimentará la futura lista de precios), horario semanal de atención (`horario_atencion`), tabla `citas` con una **exclusion constraint** que impide solapamientos a nivel de base de datos, y Route Handlers para listar servicios, consultar horario, calcular disponibilidad por día, crear citas (409 si la franja se ocupó) y un listado/cancelación administrativa. Se reutilizan las convenciones del CRUD de clientes (`planifications/2026-10-16-crud-clientes.md`): acceso solo vía API de Next con `service_role`, zod, `lib/services/*`, formato `{ data }` / `{ error }`.

## 2. Supuestos y preguntas abiertas
| # | Ambigüedad | Decisión por defecto |
|---|------------|----------------------|
| S1 | ¿Cuántos barberos/sillas atienden a la vez? | **Uno** (capacidad 1). Dos citas confirmadas no pueden solaparse en ningún caso. Si se añaden barberos, una migración futura añadirá `barbero_id` a `citas` y a la exclusion constraint (requerirá `btree_gist`). |
| S2 | Valores de negocio no dados por el usuario | Se usan los de ejemplo: 4 servicios (sección 3.6), lunes–sábado 09:00–19:00, domingo cerrado, franjas cada 30 min, zona `America/Bogota`. Servicios y horario viven en **tablas** (editables sin despliegue); los parámetros de agenda viven en **un único archivo** `lib/config/agenda.ts`. |
| S3 | Parámetros de agenda (configurables en `lib/config/agenda.ts`) | `ZONA_HORARIA = "America/Bogota"`, `INTERVALO_FRANJA_MIN = 30`, `DIAS_MAX_ANTICIPACION = 30` (se puede reservar desde hoy hasta hoy+30), `ANTELACION_MIN_MINUTOS = 30` (no se puede reservar una franja que empieza en menos de 30 min), `MAX_CITAS_FUTURAS_POR_TELEFONO = 3`, `MONEDA = "COP"`. |
| S4 | Precio | Entero en pesos colombianos (`integer`, sin decimales). `25000` = $25.000. Se guarda una **copia** del precio y la duración en la cita (snapshot) para que cambios futuros del catálogo no alteren citas existentes. |
| S5 | ¿Una cita puede terminar después del cierre? | No. Una franja es válida solo si `inicio + duracion_min <= cierre`. Ej.: "Corte + Barba" (45 min) no se ofrece a las 18:30. |
| S6 | Inicio de franja | Las franjas empiezan en múltiplos de `INTERVALO_FRANJA_MIN` contados desde la hora de apertura. Servicios de 20/45 min ocupan su duración real (no se redondea a 30); por eso una cita de 20 min a las 09:00 deja libre la franja 09:30, y una de 45 min a las 09:00 bloquea 09:00 y 09:30. |
| S7 | Un solo tramo por día | `horario_atencion` admite un único intervalo apertura–cierre por día (sin pausa de almuerzo). Ausencia de fila = día cerrado. Festivos/cierres excepcionales: fuera de alcance (ver P2). |
| S8 | ¿La cita se vincula a `clientes`? | **No en esta fase.** La cita guarda `nombre`, `telefono` y `email` como datos propios (el cliente que se autoagenda no está registrado). Ver P1. |
| S9 | Nombre de columna "creada_en" | Por coherencia con `clientes` se usan `created_at` / `updated_at` (el JSON los expone con esos nombres). |
| S10 | Estados | Enum `cita_estado` con `confirmada` y `cancelada`. Toda cita nace `confirmada` (sin aprobación manual). Solo las `confirmada` bloquean franjas. Se agrega `cancelada_en` para trazabilidad. |
| S11 | Autenticación | Igual que clientes: no hay auth. `GET /api/servicios`, `GET /api/horario`, `GET /api/citas/disponibilidad` y `POST /api/citas` son públicos por naturaleza. `GET /api/citas` y `PATCH /api/citas/[id]` son administrativos pero **quedan sin protección** en esta fase (mismo riesgo aceptado que en clientes; ver Riesgos). |
| S12 | Formato de fechas en la API | `fecha` como `YYYY-MM-DD` (fecha civil en la zona de la barbería). Instantes (`inicio`, `fin`, `created_at`…) en ISO 8601 UTC (`2026-10-20T14:00:00.000Z`). La disponibilidad también devuelve `hora` local `"HH:MM"` para pintar el calendario sin cálculos de zona en el front. |
| S13 | Antispam | Sin captcha en esta fase. Se limita a `MAX_CITAS_FUTURAS_POR_TELEFONO` citas confirmadas futuras por teléfono (409 `LIMITE_CITAS_ALCANZADO`). |
| S14 | `cacheComponents: true` | Todos los `GET` llaman `await connection()` antes de consultar (igual que clientes). No se usa `'use cache'` en esta fase. |
| P1 (abierta) | ¿Crear/actualizar un registro en `clientes` al reservar? | No por ahora. Futuro: columna `cliente_id uuid null references clientes(id) on delete set null`. |
| P2 (abierta) | Festivos y cierres puntuales | No soportado. Futuro: tabla `dias_bloqueados (fecha date pk, motivo text)`. |
| P3 (abierta) | Notificaciones (WhatsApp/correo) y cancelación por el propio cliente | Fuera de alcance. |

## 3. Modelo de datos (para backend-migrations)

### 3.1 Archivo de migración
`supabase/migrations/20261016130000_create_servicios_horario_citas.sql`
(posterior a `20261016120000_create_clientes.sql`; reutiliza la función existente `public.set_updated_at()` — **no** recrearla).

Orden dentro del archivo: enum → `servicios` → `horario_atencion` → `citas` → índices → triggers → RLS → revoke/grant → datos semilla → comentarios. Todas las constraints van **nombradas**. Usar `if not exists` / `drop trigger if exists` para que sea re-ejecutable.

### 3.2 Enum
```sql
do $$ begin
  create type public.cita_estado as enum ('confirmada', 'cancelada');
exception when duplicate_object then null; end $$;
```

### 3.3 Tabla `public.servicios`
| Columna | Tipo | Null | Default | Notas |
|---------|------|------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK `servicios_pkey` |
| `slug` | `text` | NOT NULL | — | Identificador estable para semillas/URLs |
| `nombre` | `text` | NOT NULL | — | |
| `descripcion` | `text` | NULL | — | |
| `duracion_min` | `integer` | NOT NULL | — | minutos |
| `precio` | `integer` | NOT NULL | — | COP, sin decimales |
| `activo` | `boolean` | NOT NULL | `true` | inactivos no se ofrecen |
| `orden` | `smallint` | NOT NULL | `0` | orden de presentación |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | trigger |

Constraints:
- `servicios_slug_chk`: `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60)`
- `servicios_slug_key`: `unique (slug)`
- `servicios_nombre_chk`: `check (char_length(btrim(nombre)) between 2 and 80)`
- `servicios_descripcion_chk`: `check (descripcion is null or char_length(descripcion) <= 500)`
- `servicios_duracion_chk`: `check (duracion_min between 5 and 480 and duracion_min % 5 = 0)`
- `servicios_precio_chk`: `check (precio >= 0)`

Índices:
- `servicios_nombre_unique_idx`: `unique index on public.servicios (lower(nombre))`
- `servicios_activo_orden_idx`: `on public.servicios (orden, nombre) where activo`

### 3.4 Tabla `public.horario_atencion`
| Columna | Tipo | Null | Default | Notas |
|---------|------|------|---------|-------|
| `dia_semana` | `smallint` | NOT NULL | — | PK `horario_atencion_pkey`. **0 = domingo … 6 = sábado** (misma convención que `Date.prototype.getUTCDay()` en JS y `extract(dow ...)` en Postgres) |
| `apertura` | `time` | NOT NULL | — | hora local de la barbería |
| `cierre` | `time` | NOT NULL | — | hora local |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | trigger |

Constraints:
- `horario_atencion_dia_chk`: `check (dia_semana between 0 and 6)`
- `horario_atencion_rango_chk`: `check (cierre > apertura)`
- `horario_atencion_minuto_chk`: `check (date_trunc('minute', apertura) = apertura and date_trunc('minute', cierre) = cierre)` (sin segundos)

Un día sin fila = cerrado.

### 3.5 Tabla `public.citas`
| Columna | Tipo | Null | Default | Notas |
|---------|------|------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK `citas_pkey` |
| `servicio_id` | `uuid` | NOT NULL | — | FK `citas_servicio_id_fkey` → `servicios(id)` **on delete restrict** |
| `inicio` | `timestamptz` | NOT NULL | — | |
| `fin` | `timestamptz` | NOT NULL | — | calculado por la API = inicio + duracion_min |
| `duracion_min` | `integer` | NOT NULL | — | snapshot del servicio |
| `precio` | `integer` | NOT NULL | — | snapshot del servicio (COP) |
| `nombre` | `text` | NOT NULL | — | nombre del cliente |
| `telefono` | `text` | NOT NULL | — | |
| `email` | `text` | NULL | — | |
| `notas` | `text` | NULL | — | comentario libre del cliente |
| `estado` | `public.cita_estado` | NOT NULL | `'confirmada'` | |
| `cancelada_en` | `timestamptz` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | trigger |

Constraints:
- `citas_rango_chk`: `check (fin > inicio)`
- `citas_duracion_chk`: `check (duracion_min > 0 and fin = inicio + make_interval(mins => duracion_min))`
- `citas_inicio_minuto_chk`: `check (date_trunc('minute', inicio) = inicio)`
- `citas_precio_chk`: `check (precio >= 0)`
- `citas_nombre_chk`: `check (char_length(btrim(nombre)) between 2 and 120)`
- `citas_telefono_chk`: `check (telefono ~ '^[0-9+()\s-]{7,20}$')` (misma regex que clientes)
- `citas_email_formato_chk`: `check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')`
- `citas_email_minusculas_chk`: `check (email is null or email = lower(email))`
- `citas_email_longitud_chk`: `check (email is null or char_length(email) <= 254)`
- `citas_notas_chk`: `check (notas is null or char_length(notas) <= 500)`
- `citas_cancelacion_chk`: `check ((estado = 'cancelada') = (cancelada_en is not null))`
- **`citas_sin_solapamiento_excl`** (clave del requerimiento):
  ```sql
  constraint citas_sin_solapamiento_excl
    exclude using gist (tstzrange(inicio, fin, '[)') with &&)
    where (estado = 'confirmada')
  ```
  Rango semiabierto `[)`: una cita 09:00–09:30 y otra 09:30–10:00 **no** se solapan. Solo cuentan las confirmadas. No requiere `btree_gist` (solo hay una columna de rango). Su violación produce SQLSTATE **`23P01`**.

Índices:
- `citas_inicio_idx`: `on public.citas (inicio)` — listados y consulta de disponibilidad por rango.
- `citas_servicio_id_idx`: `on public.citas (servicio_id)` — FK.
- `citas_telefono_confirmadas_idx`: `on public.citas (telefono, inicio) where estado = 'confirmada'` — regla de límite por teléfono.

### 3.6 Triggers
Reutilizan `public.set_updated_at()` (ya creada en la migración de clientes):
- `servicios_set_updated_at` before update on `servicios` for each row.
- `horario_atencion_set_updated_at` before update on `horario_atencion` for each row.
- `citas_set_updated_at` before update on `citas` for each row.
Cada uno precedido de `drop trigger if exists`.

### 3.7 RLS y privilegios (mismo patrón que clientes)
```sql
alter table public.servicios        enable row level security;
alter table public.horario_atencion enable row level security;
alter table public.citas            enable row level security;
-- INTENCIONAL: sin políticas para anon/authenticated -> denegado por defecto.
-- Solo la API de Next (service_role, bypass RLS) accede.
revoke all on table public.servicios, public.horario_atencion, public.citas from anon, authenticated;
grant select, insert, update, delete on table public.servicios, public.horario_atencion, public.citas to service_role;
```
Comentario SQL explicando que la ausencia de políticas es intencional. No crear ninguna `create policy`.

### 3.8 Datos semilla (dentro de la migración, idempotentes)
Son datos de negocio necesarios para que la app funcione, por eso van en la migración y no en `seed.sql`.
```sql
insert into public.servicios (slug, nombre, duracion_min, precio, orden) values
  ('corte',       'Corte',         30, 25000, 1),
  ('barba',       'Barba',         20, 15000, 2),
  ('corte-barba', 'Corte + Barba', 45, 35000, 3),
  ('corte-nino',  'Corte niño',    30, 20000, 4)
on conflict (slug) do nothing;

insert into public.horario_atencion (dia_semana, apertura, cierre) values
  (1, '09:00', '19:00'), (2, '09:00', '19:00'), (3, '09:00', '19:00'),
  (4, '09:00', '19:00'), (5, '09:00', '19:00'), (6, '09:00', '19:00')
on conflict (dia_semana) do nothing;
-- dia_semana 0 (domingo) sin fila = cerrado.
```

### 3.9 Comentarios
`comment on table` para las tres tablas (indicar "Acceso solo vía API de Next (service_role)"), y `comment on column` para `horario_atencion.dia_semana` (convención 0=domingo), `horario_atencion.apertura/cierre` (hora local `America/Bogota`), `citas.precio`/`citas.duracion_min` (snapshot), y `comment on constraint citas_sin_solapamiento_excl on public.citas`.

## 4. API / lógica de negocio (para backend-api)

### 4.1 Convenciones (Next 16, ver `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`)
- Reutilizar `lib/api/responses.ts` (`ok`, `fail`, `validationFail`, `readJson`, `invalidJson`, `handleError`) y `lib/api/errors.ts`.
- `GET` inician con `await connection()` (de `next/server`) por `cacheComponents: true`.
- Rutas dinámicas: `ctx: RouteContext<"/api/citas/[id]">`, `const { id } = await ctx.params`.
- Solo exportar los métodos indicados (el resto → 405 automático).
- Todo acceso a Supabase desde `lib/services/*` con `import "server-only"` y `getSupabaseAdmin()`.

### 4.2 Archivos nuevos / modificados
| Archivo | Contenido |
|---------|-----------|
| `lib/config/agenda.ts` | Constantes de S3 exportadas (`ZONA_HORARIA`, `INTERVALO_FRANJA_MIN`, `DIAS_MAX_ANTICIPACION`, `ANTELACION_MIN_MINUTOS`, `MAX_CITAS_FUTURAS_POR_TELEFONO`, `MONEDA`). Único lugar donde se definen. |
| `lib/agenda/tiempo.ts` | Funciones **puras** de zona horaria (sin dependencias nuevas, con `Intl.DateTimeFormat`): `hoyEnZona(tz): string` (YYYY-MM-DD), `sumarDias(fecha, n): string`, `diaSemana(fecha): 0..6` (vía `new Date(Date.UTC(y,m-1,d)).getUTCDay()`), `localAUtc(fecha, "HH:MM", tz): Date`, `utcALocal(date, tz): { fecha, hora }`. `localAUtc` debe calcular el offset con `Intl` (formatToParts con `timeZone` y `hourCycle: "h23"`) y re-verificarlo una vez, para no asumir `-05:00` fijo. |
| `lib/agenda/franjas.ts` | Función pura `generarFranjas({ fecha, apertura, cierre, duracionMin, intervaloMin, tz, ocupadas: {inicio: Date, fin: Date}[], ahora: Date, antelacionMin })` → `Franja[]`. Sin acceso a BD (testeable). |
| `lib/types/servicio.ts` | `Servicio`, `HorarioDia`. |
| `lib/types/cita.ts` | `Cita`, `CitaConServicio`, `Franja`, `Disponibilidad`, `CitasListResult`. |
| `lib/validations/cita.ts` | Esquemas zod de 4.4. Reutiliza `TELEFONO_REGEX` de `lib/validations/cliente.ts` (importarla, no duplicarla). |
| `lib/services/servicios.ts` | `listServiciosActivos()`, `getServicioActivo(id)`. |
| `lib/services/horario.ts` | `getHorarioSemanal()`, `getHorarioDia(diaSemana)`. |
| `lib/services/citas.ts` | `getDisponibilidad(...)`, `createCita(...)`, `listCitas(...)`, `cancelarCita(id)`, `mapDbError`. Único sitio con `.from("citas")`. |
| `lib/api/errors.ts` | Ampliar `ConflictError.code` a la unión `"CORREO_DUPLICADO" \| "FRANJA_NO_DISPONIBLE" \| "LIMITE_CITAS_ALCANZADO" \| "CITA_YA_CANCELADA"` (exportar el tipo `ConflictCode`). |
| `lib/api/responses.ts` | Añadir esos tres códigos nuevos a `ApiErrorCode`. `handleError` ya mapea `ConflictError` → 409 con `err.code`. |
| `app/api/servicios/route.ts` | `GET` |
| `app/api/horario/route.ts` | `GET` |
| `app/api/citas/route.ts` | `GET`, `POST` |
| `app/api/citas/disponibilidad/route.ts` | `GET` |
| `app/api/citas/[id]/route.ts` | `PATCH` |

No se añaden dependencias npm.

### 4.3 Formato de respuestas y códigos de error
Éxito `{ "data": ... }` (listados con `"meta"`). Error `{ "error": { code, message, details? } }`.

| HTTP | code | Cuándo |
|------|------|--------|
| 400 | `VALIDATION_ERROR` | Query/body/params inválidos; fecha fuera de ventana; servicio inexistente/inactivo; franja fuera de horario, no alineada, en el pasado o día cerrado. `details.fieldErrors` indica el campo (`fecha`, `servicio_id`, `inicio`…). |
| 400 | `INVALID_JSON` | Body no parseable. |
| 404 | `NOT_FOUND` | Cita inexistente en PATCH. |
| 409 | `FRANJA_NO_DISPONIBLE` | La franja se solapa con otra cita confirmada (Postgres `23P01`). Mensaje: "La franja seleccionada ya no está disponible". |
| 409 | `LIMITE_CITAS_ALCANZADO` | El teléfono ya tiene `MAX_CITAS_FUTURAS_POR_TELEFONO` citas confirmadas futuras. |
| 409 | `CITA_YA_CANCELADA` | PATCH de cancelación sobre una cita ya cancelada. |
| 500 | `INTERNAL_ERROR` | Resto; detalle solo en `console.error`. |

`mapDbError` en `lib/services/citas.ts`:
- `23P01` → `ConflictError("FRANJA_NO_DISPONIBLE", ...)`
- `23503` (FK servicio) → `ValidationError("El servicio no existe", "servicio_id")`
- `23514` → `ValidationError("Los datos no cumplen las reglas de la base de datos")`
- `22P02` (uuid/enum inválido) → `ValidationError("Valor inválido")`
- otro → `Error` genérico con `cause` (→ 500).

### 4.4 Validaciones (zod, `lib/validations/cita.ts`)
Mismo estilo que `cliente.ts` (`strictObject` con mensajes en español, trim, vacío → null en opcionales).
- `fechaSchema`: `z.iso.date()` (YYYY-MM-DD válido), mensaje "Fecha inválida (formato YYYY-MM-DD)".
- `servicioIdSchema` / `citaIdSchema`: `z.uuid()`.
- `disponibilidadQuerySchema`: `{ fecha: fechaSchema, servicio_id: servicioIdSchema }` (ambos requeridos).
- `citaCreateSchema` (`strictObject`):
  - `servicio_id`: uuid, requerido.
  - `inicio`: `z.iso.datetime({ offset: true })` requerido (acepta `Z` o `-05:00`); se transforma a `Date`. Se rechazan segundos ≠ 0 (regla en servicio).
  - `nombre`: trim 2–120, requerido.
  - `telefono`: trim, `TELEFONO_REGEX`, requerido.
  - `email`: opcional/nullable, vacío → null, `z.email()`, máx. 254, `toLowerCase()`.
  - `notas`: opcional/nullable, trim, vacío → null, máx. 500.
  - Campos no permitidos (`fin`, `estado`, `precio`, `duracion_min`, `id`…) → 400.
- `citaListQuerySchema`: `desde?` fecha (default hoy en zona), `hasta?` fecha (default `desde + 7 días`), `estado?` `"confirmada" | "cancelada"`, `limit` 1–200 default 50, `offset` ≥ 0 default 0; refine `hasta >= desde` y rango ≤ 62 días.
- `citaUpdateSchema`: `strictObject({ estado: z.literal("cancelada") })`.

### 4.5 Endpoints

#### GET `/api/servicios` — catálogo (también para lista de precios)
- Archivo `app/api/servicios/route.ts`. Auth: pública.
- Reglas: `await connection()`; `select("id, slug, nombre, descripcion, duracion_min, precio, orden").eq("activo", true).order("orden").order("nombre")`.
- 200: `{ "data": Servicio[], "meta": { "moneda": "COP" } }`.
- Errores: 500. Lee `servicios`.

#### GET `/api/horario` — horario semanal y parámetros del calendario
- Archivo `app/api/horario/route.ts`. Auth: pública.
- Reglas: `await connection()`; leer `horario_atencion` ordenado por `dia_semana`; construir los 7 días (0–6) marcando `cerrado: true` donde no hay fila.
- 200:
  ```json
  { "data": {
      "zona_horaria": "America/Bogota",
      "intervalo_min": 30,
      "hoy": "2026-10-16",
      "fecha_max": "2026-11-15",
      "dias": [ { "dia_semana": 0, "cerrado": true, "apertura": null, "cierre": null },
                { "dia_semana": 1, "cerrado": false, "apertura": "09:00", "cierre": "19:00" }, ... ]
  } }
  ```
  `apertura`/`cierre` formateados `HH:MM` (Postgres devuelve `HH:MM:SS`; recortar). `hoy` = `hoyEnZona(ZONA_HORARIA)`, `fecha_max` = hoy + `DIAS_MAX_ANTICIPACION`.
- Errores: 500. Lee `horario_atencion`.
- Propósito: el front deshabilita domingos y fechas fuera de ventana sin pedir disponibilidad día a día.

#### GET `/api/citas/disponibilidad?fecha=YYYY-MM-DD&servicio_id=<uuid>` — franjas de un día
- Archivo `app/api/citas/disponibilidad/route.ts`. Auth: pública.
- Reglas, en orden:
  1. `await connection()`; validar query con `disponibilidadQuerySchema` → 400.
  2. `hoy = hoyEnZona(ZONA_HORARIA)`. Si `fecha < hoy` o `fecha > hoy + DIAS_MAX_ANTICIPACION` → 400 `VALIDATION_ERROR` campo `fecha` ("Solo se puede consultar desde hoy hasta N días").
  3. `getServicioActivo(servicio_id)`; si no existe o `activo = false` → 400 `VALIDATION_ERROR` campo `servicio_id` ("Servicio no disponible").
  4. `getHorarioDia(diaSemana(fecha))`. Si no hay fila → 200 con `cerrado: true`, `horario: null`, `franjas: []` (no consulta citas).
  5. `diaInicio = localAUtc(fecha, apertura)`, `diaFin = localAUtc(fecha, cierre)`.
  6. Leer citas que se solapan con el día: `select("inicio, fin").eq("estado", "confirmada").lt("inicio", diaFin.toISOString()).gt("fin", diaInicio.toISOString())`.
  7. `generarFranjas(...)`: candidatos `t = apertura + k·INTERVALO_FRANJA_MIN` mientras `t + duracion_min <= cierre`. Para cada uno `fin = t + duracion_min`. `disponible = false` si (a) se solapa con alguna cita (`inicio_c < fin && fin_c > t`, semiabierto) o (b) `t < ahora + ANTELACION_MIN_MINUTOS`. Si no, `true`.
- 200:
  ```json
  { "data": {
      "fecha": "2026-10-20",
      "zona_horaria": "America/Bogota",
      "cerrado": false,
      "horario": { "apertura": "09:00", "cierre": "19:00" },
      "servicio": { "id": "…", "nombre": "Corte", "duracion_min": 30, "precio": 25000 },
      "franjas": [
        { "hora": "09:00", "inicio": "2026-10-20T14:00:00.000Z", "fin": "2026-10-20T14:30:00.000Z", "disponible": true },
        { "hora": "09:30", "inicio": "…", "fin": "…", "disponible": false }
      ]
  } }
  ```
  Orden ascendente por `inicio`. No se expone ningún dato de otras citas (ni nombres ni ids).
- Errores: 400, 500. Lee `servicios`, `horario_atencion`, `citas`.

#### POST `/api/citas` — reservar
- Archivo `app/api/citas/route.ts`. Auth: pública.
- Body: `{ servicio_id, inicio, nombre, telefono, email?, notas? }`. El front envía como `inicio` el valor recibido en la franja.
- Reglas, en orden:
  1. `readJson` → 400 `INVALID_JSON`; validar con `citaCreateSchema` → 400.
  2. `getServicioActivo(servicio_id)` → si no existe/inactivo: 400 `VALIDATION_ERROR` campo `servicio_id`.
  3. Convertir `inicio` a local: `{ fecha, hora } = utcALocal(inicio, ZONA_HORARIA)`. Validar (cada fallo → 400 `VALIDATION_ERROR` campo `inicio` con mensaje específico):
     - segundos y milisegundos = 0;
     - `fecha` dentro de `[hoy, hoy + DIAS_MAX_ANTICIPACION]`;
     - `inicio >= ahora + ANTELACION_MIN_MINUTOS` ("La franja ya pasó o está demasiado próxima");
     - el día tiene horario ("La barbería no atiende ese día");
     - `hora >= apertura` y `inicio + duracion_min <= cierre` ("Fuera del horario de atención");
     - `(minutos(hora) - minutos(apertura)) % INTERVALO_FRANJA_MIN = 0` ("Hora no válida para el calendario").
     Reutilizar la misma lógica de `lib/agenda` que usa disponibilidad (no duplicar reglas).
  4. Límite antispam: contar citas `estado = 'confirmada'`, `telefono = <telefono>`, `inicio > now()` (`select("id", { count: "exact", head: true })`). Si `>= MAX_CITAS_FUTURAS_POR_TELEFONO` → 409 `LIMITE_CITAS_ALCANZADO`.
  5. Calcular `fin = inicio + duracion_min` y snapshot: `insert({ servicio_id, inicio, fin, duracion_min, precio, nombre, telefono, email, notas }).select("*, servicio:servicios(id, nombre)").single()`. No enviar `estado` (default) ni `created_at`.
  6. **No** hacer una comprobación previa de solapamiento como garantía: la exclusion constraint es la fuente de verdad. Error `23P01` → 409 `FRANJA_NO_DISPONIBLE`. (Una pre-consulta opcional es aceptable solo como optimización, nunca sustituye al manejo de `23P01`.)
- 201: `{ "data": CitaConServicio }` + header `Location: /api/citas/{id}`.
- Errores: 400, 409 (`FRANJA_NO_DISPONIBLE`, `LIMITE_CITAS_ALCANZADO`), 500. Lee `servicios`, `horario_atencion`, `citas`; escribe `citas`.

#### GET `/api/citas` — listado administrativo
- Mismo archivo. Auth: ninguna en esta fase (S11, riesgo documentado).
- Query: `desde?`, `hasta?`, `estado?`, `limit?`, `offset?` (4.4).
- Reglas: `await connection()`; validar → 400; rango `[localAUtc(desde,"00:00"), localAUtc(hasta + 1 día,"00:00"))` sobre `inicio`; `select("*, servicio:servicios(id, nombre)", { count: "exact" }).gte("inicio", …).lt("inicio", …)`, filtro `estado` si viene; `.order("inicio", { ascending: true }).range(offset, offset + limit - 1)`. Manejar `PGRST103` (offset fuera de rango) como en clientes: `data: []` con total real.
- 200: `{ "data": CitaConServicio[], "meta": { "total", "limit", "offset", "desde", "hasta" } }`.
- Errores: 400, 500. Lee `citas`, `servicios`.

#### PATCH `/api/citas/[id]` — cancelar
- Archivo `app/api/citas/[id]/route.ts`. Auth: ninguna en esta fase (S11).
- Body: `{ "estado": "cancelada" }` (único cambio permitido).
- Reglas:
  1. Validar `id` uuid → 400; `readJson` → 400; `citaUpdateSchema` → 400.
  2. `update({ estado: "cancelada", cancelada_en: new Date().toISOString() }).eq("id", id).eq("estado", "confirmada").select("*, servicio:servicios(id, nombre)").maybeSingle()` (atómico, sin lectura previa).
  3. Si no devolvió fila: consultar si existe → no existe: 404 `NOT_FOUND` ("Cita no encontrada"); existe: 409 `CITA_YA_CANCELADA`.
- 200: `{ "data": CitaConServicio }`. Al cancelar, la franja vuelve a estar libre (la constraint solo aplica a confirmadas).
- Errores: 400, 404, 409, 500. Escribe `citas`.

### 4.6 Contrato para frontend
```ts
type Servicio = { id: string; slug: string; nombre: string; descripcion: string | null; duracion_min: number; precio: number; orden: number };
type HorarioDia = { dia_semana: 0|1|2|3|4|5|6; cerrado: boolean; apertura: string | null; cierre: string | null };
type Horario = { zona_horaria: string; intervalo_min: number; hoy: string; fecha_max: string; dias: HorarioDia[] };
type Franja = { hora: string; inicio: string; fin: string; disponible: boolean };
type Disponibilidad = { fecha: string; zona_horaria: string; cerrado: boolean; horario: { apertura: string; cierre: string } | null;
  servicio: { id: string; nombre: string; duracion_min: number; precio: number }; franjas: Franja[] };
type Cita = { id: string; servicio_id: string; inicio: string; fin: string; duracion_min: number; precio: number;
  nombre: string; telefono: string; email: string | null; notas: string | null; estado: 'confirmada' | 'cancelada';
  cancelada_en: string | null; created_at: string; updated_at: string };
type CitaConServicio = Cita & { servicio: { id: string; nombre: string } };
```

| Método | Ruta | Body | Éxito |
|--------|------|------|-------|
| GET | `/api/servicios` | — | 200 `{ data: Servicio[], meta: { moneda } }` |
| GET | `/api/horario` | — | 200 `{ data: Horario }` |
| GET | `/api/citas/disponibilidad?fecha=&servicio_id=` | — | 200 `{ data: Disponibilidad }` |
| POST | `/api/citas` | `{ servicio_id, inicio, nombre, telefono, email?, notas? }` | 201 `{ data: CitaConServicio }` |
| GET | `/api/citas?desde=&hasta=&estado=&limit=&offset=` | — | 200 `{ data: CitaConServicio[], meta }` |
| PATCH | `/api/citas/{id}` | `{ estado: "cancelada" }` | 200 `{ data: CitaConServicio }` |

Flujo sugerido del calendario: `GET /api/servicios` + `GET /api/horario` → el usuario elige servicio y día → `GET /api/citas/disponibilidad` → elige franja → `POST /api/citas`. Ante 409 `FRANJA_NO_DISPONIBLE`, mostrar aviso y volver a pedir disponibilidad.

## 5. Criterios de aceptación

### Migraciones
- [ ] Existe `supabase/migrations/20261016130000_create_servicios_horario_citas.sql` (timestamp posterior a la migración de clientes) y no modifica la migración de clientes.
- [ ] Crea el enum `public.cita_estado` con exactamente `('confirmada', 'cancelada')`, de forma idempotente.
- [ ] Crea `public.servicios`, `public.horario_atencion` y `public.citas` con `if not exists` y exactamente las columnas, tipos, nulabilidad y defaults de 3.3–3.5.
- [ ] `servicios`: constraints `servicios_slug_chk`, `servicios_slug_key`, `servicios_nombre_chk`, `servicios_descripcion_chk`, `servicios_duracion_chk`, `servicios_precio_chk`; índice único `servicios_nombre_unique_idx` sobre `lower(nombre)`.
- [ ] `horario_atencion`: PK en `dia_semana`; constraints `horario_atencion_dia_chk` (0–6), `horario_atencion_rango_chk`, `horario_atencion_minuto_chk`.
- [ ] `citas.servicio_id` FK a `servicios(id)` con `on delete restrict`.
- [ ] `citas` tiene las constraints `citas_rango_chk`, `citas_duracion_chk`, `citas_inicio_minuto_chk`, `citas_precio_chk`, `citas_nombre_chk`, `citas_telefono_chk`, `citas_email_formato_chk`, `citas_email_minusculas_chk`, `citas_email_longitud_chk`, `citas_notas_chk`, `citas_cancelacion_chk`.
- [ ] Existe `citas_sin_solapamiento_excl` como `exclude using gist (tstzrange(inicio, fin, '[)') with &&) where (estado = 'confirmada')`.
- [ ] Índices `citas_inicio_idx`, `citas_servicio_id_idx`, `citas_telefono_confirmadas_idx` (parcial `where estado = 'confirmada'`).
- [ ] Triggers `servicios_set_updated_at`, `horario_atencion_set_updated_at`, `citas_set_updated_at` usan `public.set_updated_at()` existente (la función no se redefine) y van precedidos de `drop trigger if exists`.
- [ ] RLS habilitado en las tres tablas; **ninguna** `create policy`; comentario que explica que es intencional.
- [ ] `revoke all ... from anon, authenticated` y `grant select, insert, update, delete ... to service_role` en las tres tablas.
- [ ] Semillas: 4 servicios (`corte` 30/25000, `barba` 20/15000, `corte-barba` 45/35000, `corte-nino` 30/20000) con `on conflict (slug) do nothing`; horario días 1–6 09:00–19:00 con `on conflict (dia_semana) do nothing`; sin fila para el día 0.
- [ ] Comentarios `comment on` en tablas y en `horario_atencion.dia_semana`.

### API
- [ ] Existe `lib/config/agenda.ts` con `ZONA_HORARIA`, `INTERVALO_FRANJA_MIN`, `DIAS_MAX_ANTICIPACION`, `ANTELACION_MIN_MINUTOS`, `MAX_CITAS_FUTURAS_POR_TELEFONO`, `MONEDA`, y ningún otro archivo hardcodea `"America/Bogota"`, `30` como intervalo, etc.
- [ ] `lib/agenda/tiempo.ts` y `lib/agenda/franjas.ts` son funciones puras (sin imports de Supabase); la conversión de zona usa `Intl` y no asume un offset fijo.
- [ ] Los servicios (`lib/services/servicios.ts`, `horario.ts`, `citas.ts`) importan `server-only` y usan `getSupabaseAdmin()`; `.from("citas")` solo aparece en `lib/services/citas.ts`.
- [ ] `TELEFONO_REGEX` se importa de `lib/validations/cliente.ts` (no se duplica).
- [ ] Route files exportan exactamente: `servicios/route.ts` → `GET`; `horario/route.ts` → `GET`; `citas/route.ts` → `GET`, `POST`; `citas/disponibilidad/route.ts` → `GET`; `citas/[id]/route.ts` → `PATCH`.
- [ ] Todos los `GET` llaman `await connection()` antes de consultar; `params` se obtiene con `await ctx.params` tipado con `RouteContext<"/api/citas/[id]">`.
- [ ] `GET /api/servicios` devuelve solo servicios `activo = true`, ordenados por `orden`, `nombre`.
- [ ] `GET /api/horario` devuelve los 7 días, con domingo `cerrado: true`, horas en formato `HH:MM`, y `hoy`/`fecha_max` calculados en la zona configurada.
- [ ] Disponibilidad: `fecha` mal formada, en el pasado o > hoy + `DIAS_MAX_ANTICIPACION` → 400; `servicio_id` no uuid, inexistente o inactivo → 400 con `fieldErrors.servicio_id`; día sin horario → 200 con `cerrado: true` y `franjas: []`.
- [ ] Disponibilidad: franjas cada `INTERVALO_FRANJA_MIN` desde la apertura, sin franjas cuyo fin supere el cierre; solapamiento evaluado con rango semiabierto; solo citas `confirmada` bloquean; franjas antes de `ahora + ANTELACION_MIN_MINUTOS` salen con `disponible: false`; la respuesta no incluye datos de otras citas.
- [ ] POST: body no JSON → 400 `INVALID_JSON`; campos desconocidos (`fin`, `estado`, `precio`…) → 400; `inicio` sin offset o inválido → 400; `email` normalizado a minúsculas; vacíos → null.
- [ ] POST: rechaza con 400 (`fieldErrors.inicio`) inicio con segundos, en el pasado/sin antelación, fuera de ventana, en día cerrado, antes de apertura, cuyo fin supera el cierre, o no alineado al intervalo.
- [ ] POST: `fin`, `duracion_min` y `precio` se calculan en servidor a partir del servicio (nunca del body).
- [ ] POST: error Postgres `23P01` → 409 `FRANJA_NO_DISPONIBLE`; límite por teléfono → 409 `LIMITE_CITAS_ALCANZADO`; éxito → 201 con `Location`.
- [ ] `ApiErrorCode` y `ConflictError` incluyen `FRANJA_NO_DISPONIBLE`, `LIMITE_CITAS_ALCANZADO`, `CITA_YA_CANCELADA` sin romper `CORREO_DUPLICADO`.
- [ ] GET `/api/citas`: defaults `desde = hoy`, `hasta = desde + 7`, `limit = 50`, `offset = 0`; `hasta < desde`, rango > 62 días, `limit` fuera de 1–200 o `estado` inválido → 400; respuesta con `meta { total, limit, offset, desde, hasta }`, orden por `inicio` asc, incluye `servicio { id, nombre }`.
- [ ] PATCH: solo acepta `{ "estado": "cancelada" }`; update condicionado a `estado = 'confirmada'` que fija `cancelada_en`; inexistente → 404; ya cancelada → 409 `CITA_YA_CANCELADA`.
- [ ] Errores inesperados → 500 `INTERNAL_ERROR` genérico (detalle solo en `console.error`).
- [ ] Ningún componente `'use client'` importa `lib/services/*` ni `lib/supabase/admin.ts`.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan.

## 6. Orden de implementación
1. **backend-migrations**: `supabase/migrations/20261016130000_create_servicios_horario_citas.sql`. Probar localmente si hay Supabase CLI (insertar dos citas solapadas confirmadas debe fallar con `23P01`; una cancelada + una confirmada en el mismo rango debe pasar). No hacer `db push` remoto sin autorización.
2. **backend-api**:
   1. `lib/config/agenda.ts`, `lib/agenda/tiempo.ts`, `lib/agenda/franjas.ts`.
   2. `lib/types/servicio.ts`, `lib/types/cita.ts`, `lib/validations/cita.ts`.
   3. Ampliar `lib/api/errors.ts` y `lib/api/responses.ts`.
   4. `lib/services/servicios.ts`, `lib/services/horario.ts`, `lib/services/citas.ts`.
   5. Route Handlers (`servicios`, `horario`, `citas/disponibilidad`, `citas`, `citas/[id]`).
   6. `npx tsc --noEmit` y `npm run lint`.
3. **backend-validator**: revisar contra la sección 5.
4. Equipo de front: calendario usando el contrato 4.6.

## 7. Riesgos y consideraciones
- **Concurrencia (doble reserva)**: dos clientes pueden pedir la misma franja a la vez. La garantía es la exclusion constraint `citas_sin_solapamiento_excl` (atómica en Postgres), no una consulta previa en código. La API debe traducir siempre `23P01` → 409. La disponibilidad es una "foto"; el front debe tratar el 409 como caso normal.
- **Límite por teléfono no atómico**: el conteo + insert puede rebasarse por carrera; aceptable (es antispam, no integridad).
- **Zona horaria**: Bogotá no tiene horario de verano, pero el código no debe asumir `-05:00` fijo para que cambiar `ZONA_HORARIA` funcione. `dia_semana` se calcula sobre la fecha civil (no sobre un `Date` local del servidor, que en Vercel corre en UTC). "Hoy" siempre con `hoyEnZona`, nunca `new Date().toISOString().slice(0,10)` (daría el día UTC: después de las 19:00 en Bogotá ya es "mañana").
- **Seguridad**: los endpoints públicos (`POST /api/citas`) pueden recibir spam; mitigación parcial con el límite por teléfono. `GET /api/citas` y `PATCH /api/citas/[id]` exponen/alteran PII (nombre, teléfono, email) **sin autenticación**: igual que el CRUD de clientes, aceptable solo para demo; antes de producción proteger con Supabase Auth / `proxy`. Considerar rate limiting (p. ej. por IP en Vercel) y captcha.
- **Disponibilidad sin fuga de datos**: la respuesta solo indica `disponible`, nunca datos de otras citas.
- **Cambios de catálogo/horario**: el snapshot de `precio`/`duracion_min` protege citas existentes. Cambiar el horario no invalida citas ya confirmadas fuera del nuevo horario (se listan igual en el admin). `on delete restrict` impide borrar servicios con citas; para retirarlos usar `activo = false`.
- **Rendimiento**: volumen bajo; la consulta diaria usa `citas_inicio_idx` y el índice GiST de la exclusion. Cache Components: sin `connection()` los `GET` podrían prerenderizarse con datos congelados (y `hoy` incorrecto).
- **Futuro**: varios barberos (`barbero_id` + `btree_gist` en la exclusion), festivos (`dias_bloqueados`), vínculo con `clientes`, notificaciones y cancelación por el cliente con token.
