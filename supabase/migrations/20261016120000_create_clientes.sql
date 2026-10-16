-- =============================================================================
-- Migración: crear tabla public.clientes (CRUD de clientes de la barbería)
-- Plan: planifications/2026-10-16-crud-clientes.md (sección 3)
-- Orden: tabla/constraints -> índices -> función -> trigger -> RLS -> grants -> comentarios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla public.clientes
--    nombre obligatorio; correo/telefono/detalle opcionales pero se exige al
--    menos una forma de contacto (correo o teléfono). El correo se guarda
--    normalizado en minúsculas. Todas las constraints van nombradas para que la
--    API pueda identificarlas en los errores de Postgres (23514 / 23505).
-- -----------------------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid        not null default gen_random_uuid(),
  nombre      text        not null,
  correo      text,
  telefono    text,
  detalle     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint clientes_pkey primary key (id),

  -- Nombre entre 2 y 120 caracteres útiles (sin contar espacios extremos)
  constraint clientes_nombre_chk
    check (char_length(btrim(nombre)) between 2 and 120),

  -- Formato básico de correo: algo@algo.algo, sin espacios
  constraint clientes_correo_formato_chk
    check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- El correo se almacena siempre en minúsculas (la API lo normaliza)
  constraint clientes_correo_minusculas_chk
    check (correo is null or correo = lower(correo)),

  -- Longitud máxima de correo según RFC 5321
  constraint clientes_correo_longitud_chk
    check (char_length(correo) <= 254),

  -- Teléfono laxo: 7-20 caracteres entre dígitos, espacios, +, -, ( y )
  constraint clientes_telefono_chk
    check (telefono is null or telefono ~ '^[0-9+()\s-]{7,20}$'),

  -- Detalle/notas libre de hasta 1000 caracteres
  constraint clientes_detalle_chk
    check (detalle is null or char_length(detalle) <= 1000),

  -- Debe existir al menos una forma de contacto (red de seguridad para PATCH concurrentes)
  constraint clientes_contacto_chk
    check (correo is not null or telefono is not null)
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------
-- Unicidad del correo sin distinguir mayúsculas; parcial para permitir varios
-- clientes sin correo. Una violación produce el error 23505 -> 409 en la API.
create unique index if not exists clientes_correo_unique_idx
  on public.clientes (lower(correo))
  where correo is not null;

-- Soporta el listado ordenado por fecha de creación descendente.
create index if not exists clientes_created_at_idx
  on public.clientes (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Función genérica para mantener updated_at (reutilizable por otras tablas).
--    No es security definer: se ejecuta con los privilegios del invocador.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Trigger: actualiza updated_at en cada UPDATE de clientes.
-- -----------------------------------------------------------------------------
drop trigger if exists clientes_set_updated_at on public.clientes;

create trigger clientes_set_updated_at
  before update on public.clientes
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
--    INTENCIONAL: no se crea ninguna política para anon ni authenticated.
--    Con RLS habilitado y sin políticas, ambos roles quedan denegados por
--    defecto (ni con la anon key pública se puede leer/escribir).
--    service_role tiene BYPASSRLS y es el único rol que usa la API de Next
--    (lib/supabase/admin.ts). Cuando exista autenticación se añadirán
--    políticas en una migración nueva.
-- -----------------------------------------------------------------------------
alter table public.clientes enable row level security;

-- -----------------------------------------------------------------------------
-- 6. Privilegios (defensa en profundidad)
--    Supabase concede por defecto privilegios en public a anon/authenticated;
--    se revocan explícitamente y solo service_role conserva el CRUD.
-- -----------------------------------------------------------------------------
revoke all on table public.clientes from anon, authenticated;
grant select, insert, update, delete on table public.clientes to service_role;

-- -----------------------------------------------------------------------------
-- 7. Comentarios de documentación
-- -----------------------------------------------------------------------------
comment on table public.clientes is
  'Clientes de la barbería. Acceso solo vía API de Next (service_role).';
comment on column public.clientes.correo is
  'Correo en minúsculas; único (case-insensitive) cuando no es null.';
comment on column public.clientes.telefono is
  'Teléfono en texto libre (7-20 caracteres: dígitos, espacios, +, -, paréntesis). No es único.';
comment on column public.clientes.detalle is
  'Notas libres sobre el cliente (máx. 1000 caracteres).';
comment on column public.clientes.updated_at is
  'Mantenido por el trigger clientes_set_updated_at.';
comment on function public.set_updated_at() is
  'Trigger genérico que asigna now() a updated_at antes de cada UPDATE.';
