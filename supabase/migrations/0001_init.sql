-- =============================================================
-- Gestor de Sistemas — Esquema inicial (Fase 1)
-- Herramienta interna Pex para implementaciones CRM en GHL.
-- Ejecutar en Supabase SQL Editor (proyecto gestor-de-sistemas).
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM de estado del proyecto ----------
do $$ begin
  create type estado_proyecto as enum
    ('Pendiente', 'En observación', 'Entregado', 'Performando');
exception when duplicate_object then null; end $$;

-- ---------- profiles (usuarios con rol) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nombre     text,
  rol        text not null default 'subcuenta' check (rol in ('admin', 'subcuenta')),
  created_at timestamptz not null default now()
);

-- ---------- proyectos ----------
create table if not exists public.proyectos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  estado              estado_proyecto not null default 'Pendiente',
  fecha_incorporacion date,
  fecha_cierre        date,
  creado_por          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- ---------- sistemas ----------
create table if not exists public.sistemas (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  nombre      text not null,
  orden       int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sistemas_proyecto on public.sistemas(proyecto_id);

-- ---------- puntos de contacto ----------
create table if not exists public.puntos (
  id         uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references public.sistemas(id) on delete cascade,
  nombre     text not null,
  copy       text not null default '',
  imagen     text,        -- path en storage (bucket privado 'assets')
  video      text,        -- link externo o path en storage
  fijo       boolean not null default false,
  orden      int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_puntos_sistema on public.puntos(sistema_id);

-- ---------- asignaciones (subcuenta <-> proyecto) ----------
create table if not exists public.asignaciones (
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (proyecto_id, user_id)
);
create index if not exists idx_asignaciones_user on public.asignaciones(user_id);

-- ---------- plantilla_config (singleton, editable por admin) ----------
create table if not exists public.plantilla_config (
  id           boolean primary key default true check (id),
  seguimiento  int not null default 5,
  nutricion    int not null default 5,
  fidelizacion int not null default 4,
  inteligencia int not null default 3,
  landing      int not null default 1,
  updated_at   timestamptz not null default now()
);
insert into public.plantilla_config (id) values (true) on conflict do nothing;

-- =============================================================
-- Funciones auxiliares de acceso (SECURITY DEFINER)
-- =============================================================
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'admin'
  );
$$;

create or replace function public.has_project_access(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin()
      or exists (select 1 from public.proyectos p
                  where p.id = pid and p.creado_por = auth.uid())
      or exists (select 1 from public.asignaciones a
                  where a.proyecto_id = pid and a.user_id = auth.uid());
$$;

-- =============================================================
-- Trigger: crear profile al registrarse un usuario
-- =============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    'subcuenta'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles        enable row level security;
alter table public.proyectos       enable row level security;
alter table public.sistemas        enable row level security;
alter table public.puntos          enable row level security;
alter table public.asignaciones    enable row level security;
alter table public.plantilla_config enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

-- ---------- proyectos ----------
drop policy if exists proyectos_select on public.proyectos;
create policy proyectos_select on public.proyectos for select to authenticated
  using (public.has_project_access(id));

drop policy if exists proyectos_insert on public.proyectos;
create policy proyectos_insert on public.proyectos for insert to authenticated
  with check (creado_por = auth.uid());  -- admin y subcuenta pueden crear

drop policy if exists proyectos_update on public.proyectos;
create policy proyectos_update on public.proyectos for update to authenticated
  using (public.has_project_access(id)) with check (public.has_project_access(id));

drop policy if exists proyectos_delete on public.proyectos;
create policy proyectos_delete on public.proyectos for delete to authenticated
  using (public.is_admin());  -- solo admin elimina proyectos

-- ---------- sistemas ----------
drop policy if exists sistemas_all on public.sistemas;
create policy sistemas_all on public.sistemas for all to authenticated
  using (public.has_project_access(proyecto_id))
  with check (public.has_project_access(proyecto_id));

-- ---------- puntos ----------
drop policy if exists puntos_all on public.puntos;
create policy puntos_all on public.puntos for all to authenticated
  using (public.has_project_access(
    (select s.proyecto_id from public.sistemas s where s.id = sistema_id)))
  with check (public.has_project_access(
    (select s.proyecto_id from public.sistemas s where s.id = sistema_id)));

-- ---------- asignaciones ----------
drop policy if exists asignaciones_select on public.asignaciones;
create policy asignaciones_select on public.asignaciones for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists asignaciones_insert on public.asignaciones;
create policy asignaciones_insert on public.asignaciones for insert to authenticated
  with check (public.is_admin());

drop policy if exists asignaciones_delete on public.asignaciones;
create policy asignaciones_delete on public.asignaciones for delete to authenticated
  using (public.is_admin());

-- ---------- plantilla_config ----------
drop policy if exists plantilla_select on public.plantilla_config;
create policy plantilla_select on public.plantilla_config for select to authenticated
  using (true);

drop policy if exists plantilla_update on public.plantilla_config;
create policy plantilla_update on public.plantilla_config for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================
-- Storage: bucket privado 'assets' (imágenes/videos)
-- Acceso solo a usuarios autenticados; se sirve vía URLs firmadas.
-- =============================================================
insert into storage.buckets (id, name, public)
  values ('assets', 'assets', false)
  on conflict (id) do nothing;

drop policy if exists assets_auth_all on storage.objects;
create policy assets_auth_all on storage.objects for all to authenticated
  using (bucket_id = 'assets') with check (bucket_id = 'assets');
