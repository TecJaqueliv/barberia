-- =============================================================================
-- Migración: catálogo de servicios, horario de atención y citas (BARB-5)
-- Plan: planifications/2026-10-16-citas-autoagendamiento.md (sección 3)
-- Depende de: 20261016120000_create_clientes.sql (reutiliza public.set_updated_at()).
-- Orden: enum -> servicios -> horario_atencion -> citas -> índices -> triggers
--        -> RLS -> revoke/grant -> datos semilla -> comentarios
-- Re-ejecutable: if not exists / drop trigger if exists / on conflict do nothing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum public.cita_estado
--    Toda cita nace 'confirmada'; solo las confirmadas bloquean franjas.
--    Bloque do/exception para que sea idempotente (create type no admite
--    "if not exists").
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.cita_estado as enum ('confirmada', 'cancelada');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. Tabla public.servicios
--    Catálogo con duración (minutos) y precio (COP entero). Alimenta el
--    calendario y la futura lista de precios. Los servicios no se borran si
--    tienen citas (FK restrict); se retiran con activo = false.
-- -----------------------------------------------------------------------------
create table if not exists public.servicios (
  id            uuid        not null default gen_random_uuid(),
  slug          text        not null,
  nombre        text        not null,
  descripcion   text,
  duracion_min  integer     not null,
  precio        integer     not null,
  activo        boolean     not null default true,
  orden         smallint    not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint servicios_pkey primary key (id),

  -- Slug estable en kebab-case (para semillas y URLs), máx. 60 caracteres
  constraint servicios_slug_chk
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),

  -- Slug único (también es el objetivo de "on conflict" en las semillas)
  constraint servicios_slug_key unique (slug),

  -- Nombre entre 2 y 80 caracteres útiles
  constraint servicios_nombre_chk
    check (char_length(btrim(nombre)) between 2 and 80),

  -- Descripción opcional de hasta 500 caracteres
  constraint servicios_descripcion_chk
    check (descripcion is null or char_length(descripcion) <= 500),

  -- Duración entre 5 min y 8 h, en múltiplos de 5 minutos
  constraint servicios_duracion_chk
    check (duracion_min between 5 and 480 and duracion_min % 5 = 0),

  -- Precio no negativo (COP sin decimales)
  constraint servicios_precio_chk
    check (precio >= 0)
);

-- -----------------------------------------------------------------------------
-- 3. Tabla public.horario_atencion
--    Un único tramo apertura-cierre por día de la semana (0 = domingo ...
--    6 = sábado, igual que getUTCDay() en JS y extract(dow) en Postgres).
--    Día sin fila = cerrado. Horas en hora local de la barbería.
-- -----------------------------------------------------------------------------
create table if not exists public.horario_atencion (
  dia_semana  smallint    not null,
  apertura    time        not null,
  cierre      time        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint horario_atencion_pkey primary key (dia_semana),

  -- Día de la semana válido (0 = domingo ... 6 = sábado)
  constraint horario_atencion_dia_chk
    check (dia_semana between 0 and 6),

  -- El cierre debe ser posterior a la apertura (sin tramos que crucen medianoche)
  constraint horario_atencion_rango_chk
    check (cierre > apertura),

  -- Horas exactas al minuto (sin segundos ni fracciones).
  -- Nota: date_trunc() no tiene sobrecarga para "time"; extract(second ...)
  -- incluye la parte fraccionaria, así que "= 0" equivale a truncar al minuto.
  constraint horario_atencion_minuto_chk
    check (extract(second from apertura) = 0 and extract(second from cierre) = 0)
);

-- -----------------------------------------------------------------------------
-- 4. Tabla public.citas
--    Reservas autoagendadas. Guarda una copia (snapshot) de duración y precio
--    del servicio para que cambios del catálogo no alteren citas existentes.
--    Los datos del cliente son propios de la cita (no se vincula a clientes en
--    esta fase).
-- -----------------------------------------------------------------------------
create table if not exists public.citas (
  id            uuid               not null default gen_random_uuid(),
  servicio_id   uuid               not null,
  inicio        timestamptz        not null,
  fin           timestamptz        not null,
  duracion_min  integer            not null,
  precio        integer            not null,
  nombre        text               not null,
  telefono      text               not null,
  email         text,
  notas         text,
  estado        public.cita_estado not null default 'confirmada',
  cancelada_en  timestamptz,
  created_at    timestamptz        not null default now(),
  updated_at    timestamptz        not null default now(),

  constraint citas_pkey primary key (id),

  -- Un servicio con citas no se puede borrar (se desactiva con activo = false)
  constraint citas_servicio_id_fkey
    foreign key (servicio_id) references public.servicios (id) on delete restrict,

  -- El fin es estrictamente posterior al inicio
  constraint citas_rango_chk
    check (fin > inicio),

  -- fin coherente con el snapshot de duración
  constraint citas_duracion_chk
    check (duracion_min > 0 and fin = inicio + make_interval(mins => duracion_min)),

  -- Inicio exacto al minuto (sin segundos ni milisegundos)
  constraint citas_inicio_minuto_chk
    check (date_trunc('minute', inicio) = inicio),

  -- Precio snapshot no negativo
  constraint citas_precio_chk
    check (precio >= 0),

  -- Nombre del cliente entre 2 y 120 caracteres útiles
  constraint citas_nombre_chk
    check (char_length(btrim(nombre)) between 2 and 120),

  -- Teléfono: misma regla laxa que clientes (7-20: dígitos, espacios, +, -, ())
  constraint citas_telefono_chk
    check (telefono ~ '^[0-9+()\s-]{7,20}$'),

  -- Formato básico de correo
  constraint citas_email_formato_chk
    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Correo almacenado en minúsculas (la API lo normaliza)
  constraint citas_email_minusculas_chk
    check (email is null or email = lower(email)),

  -- Longitud máxima de correo (RFC 5321)
  constraint citas_email_longitud_chk
    check (email is null or char_length(email) <= 254),

  -- Notas libres de hasta 500 caracteres
  constraint citas_notas_chk
    check (notas is null or char_length(notas) <= 500),

  -- cancelada_en se informa si y solo si la cita está cancelada
  constraint citas_cancelacion_chk
    check ((estado = 'cancelada') = (cancelada_en is not null)),

  -- CLAVE DEL REQUERIMIENTO: dos citas confirmadas no pueden solaparse.
  -- Rango semiabierto [inicio, fin): 09:00-09:30 y 09:30-10:00 no chocan.
  -- Atómico en Postgres (resuelve la doble reserva concurrente); su violación
  -- produce SQLSTATE 23P01 -> 409 FRANJA_NO_DISPONIBLE en la API.
  -- Una sola columna de rango: no requiere la extensión btree_gist.
  constraint citas_sin_solapamiento_excl
    exclude using gist (tstzrange(inicio, fin, '[)') with &&)
    where (estado = 'confirmada')
);

-- -----------------------------------------------------------------------------
-- 5. Índices
-- -----------------------------------------------------------------------------
-- Orden de presentación de servicios activos y nombre único sin distinguir
-- mayúsculas.
create unique index if not exists servicios_nombre_unique_idx
  on public.servicios (lower(nombre));

create index if not exists servicios_activo_orden_idx
  on public.servicios (orden, nombre)
  where activo;

-- Listados administrativos y consulta de disponibilidad por rango de fechas.
create index if not exists citas_inicio_idx
  on public.citas (inicio);

-- Índice sobre la FK (joins con servicios y comprobación del on delete restrict).
create index if not exists citas_servicio_id_idx
  on public.citas (servicio_id);

-- Regla antispam: conteo de citas confirmadas futuras por teléfono.
create index if not exists citas_telefono_confirmadas_idx
  on public.citas (telefono, inicio)
  where estado = 'confirmada';

-- -----------------------------------------------------------------------------
-- 6. Triggers de updated_at
--    Reutilizan public.set_updated_at() creada en la migración de clientes
--    (no se redefine aquí).
-- -----------------------------------------------------------------------------
drop trigger if exists servicios_set_updated_at on public.servicios;
create trigger servicios_set_updated_at
  before update on public.servicios
  for each row
  execute function public.set_updated_at();

drop trigger if exists horario_atencion_set_updated_at on public.horario_atencion;
create trigger horario_atencion_set_updated_at
  before update on public.horario_atencion
  for each row
  execute function public.set_updated_at();

drop trigger if exists citas_set_updated_at on public.citas;
create trigger citas_set_updated_at
  before update on public.citas
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
--    INTENCIONAL: no se crea ninguna política para anon ni authenticated
--    (mismo patrón que clientes). Con RLS habilitado y sin políticas ambos
--    roles quedan denegados por defecto. Solo la API de Next accede, usando
--    service_role (BYPASSRLS) desde lib/supabase/admin.ts. Cuando exista
--    autenticación se añadirán políticas en una migración nueva.
-- -----------------------------------------------------------------------------
alter table public.servicios        enable row level security;
alter table public.horario_atencion enable row level security;
alter table public.citas            enable row level security;

-- -----------------------------------------------------------------------------
-- 8. Privilegios (defensa en profundidad)
--    Supabase concede por defecto privilegios en public a anon/authenticated;
--    se revocan y solo service_role conserva el CRUD.
-- -----------------------------------------------------------------------------
revoke all on table public.servicios, public.horario_atencion, public.citas
  from anon, authenticated;
grant select, insert, update, delete
  on table public.servicios, public.horario_atencion, public.citas
  to service_role;

-- -----------------------------------------------------------------------------
-- 9. Datos semilla (datos de negocio necesarios para que la app funcione)
--    Idempotentes: no sobrescriben cambios hechos después desde la base.
-- -----------------------------------------------------------------------------
insert into public.servicios (slug, nombre, duracion_min, precio, orden) values
  ('corte',       'Corte',         30, 25000, 1),
  ('barba',       'Barba',         20, 15000, 2),
  ('corte-barba', 'Corte + Barba', 45, 35000, 3),
  ('corte-nino',  'Corte niño',    30, 20000, 4)
on conflict (slug) do nothing;

-- Lunes (1) a sábado (6) de 09:00 a 19:00.
-- dia_semana 0 (domingo) sin fila = cerrado.
insert into public.horario_atencion (dia_semana, apertura, cierre) values
  (1, '09:00', '19:00'), (2, '09:00', '19:00'), (3, '09:00', '19:00'),
  (4, '09:00', '19:00'), (5, '09:00', '19:00'), (6, '09:00', '19:00')
on conflict (dia_semana) do nothing;

-- -----------------------------------------------------------------------------
-- 10. Comentarios de documentación
-- -----------------------------------------------------------------------------
comment on table public.servicios is
  'Catálogo de servicios (duración y precio COP). Acceso solo vía API de Next (service_role).';
comment on column public.servicios.precio is
  'Precio en pesos colombianos (COP), entero sin decimales.';
comment on column public.servicios.activo is
  'Los servicios inactivos no se ofrecen; usar en lugar de borrar si tienen citas.';

comment on table public.horario_atencion is
  'Horario semanal de atención (un tramo por día; sin fila = cerrado). Acceso solo vía API de Next (service_role).';
comment on column public.horario_atencion.dia_semana is
  'Día de la semana: 0 = domingo ... 6 = sábado (convención de getUTCDay() y extract(dow)).';
comment on column public.horario_atencion.apertura is
  'Hora de apertura en hora local de la barbería (America/Bogota).';
comment on column public.horario_atencion.cierre is
  'Hora de cierre en hora local de la barbería (America/Bogota). Ninguna cita puede terminar después.';

comment on table public.citas is
  'Citas autoagendadas. Acceso solo vía API de Next (service_role).';
comment on column public.citas.duracion_min is
  'Snapshot de la duración del servicio al reservar (minutos).';
comment on column public.citas.precio is
  'Snapshot del precio del servicio al reservar (COP).';
comment on column public.citas.cancelada_en is
  'Instante de cancelación; no null si y solo si estado = cancelada.';
comment on constraint citas_sin_solapamiento_excl on public.citas is
  'Impide que dos citas confirmadas se solapen (rango semiabierto [inicio, fin)). Violación = SQLSTATE 23P01.';
