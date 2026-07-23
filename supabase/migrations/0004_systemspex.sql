-- =============================================================
-- Systems PEX — Expansión de funcionalidades (esquema)
-- Buscador/filtros, datos de control, tipos de punto, usuarios
-- activos y tabla de auditoría.
-- =============================================================

-- ---------- proyectos: nuevos campos ----------
alter table public.proyectos
  add column if not exists cliente        text,
  add column if not exists nicho          text,
  add column if not exists palabras_clave text,
  add column if not exists resultado_antes        numeric,
  add column if not exists resultado_antes_fecha  date,
  add column if not exists resultado_con          numeric,
  add column if not exists resultado_con_fecha    date,
  add column if not exists evidencia_imagen       text,
  add column if not exists evidencia_video        text,
  add column if not exists actualizado_por uuid references public.profiles(id) on delete set null,
  add column if not exists actualizado_en  timestamptz;

-- ---------- proyectos: nuevo conjunto de estados ----------
-- Activo · Pendiente · En Espera · Finalizado (migrando valores previos).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='proyectos'
      and column_name='estado' and udt_name='estado_proyecto'
  ) then
    alter table public.proyectos alter column estado drop default;
    alter table public.proyectos alter column estado type text using estado::text;
    update public.proyectos set estado = case estado
      when 'Performando'    then 'Activo'
      when 'En observación' then 'En Espera'
      when 'Entregado'      then 'Finalizado'
      else 'Pendiente' end;
    alter table public.proyectos
      add constraint proyectos_estado_chk
      check (estado in ('Activo','Pendiente','En Espera','Finalizado'));
    alter table public.proyectos alter column estado set default 'Pendiente';
  end if;
end $$;

-- ---------- puntos: tipo de contenido, url, programación ----------
alter table public.puntos
  add column if not exists tipo         text not null default 'estandar',
  add column if not exists url          text,
  add column if not exists programacion text,
  add column if not exists actualizado_por uuid references public.profiles(id) on delete set null,
  add column if not exists actualizado_en  timestamptz;

do $$ begin
  alter table public.puntos
    add constraint puntos_tipo_chk check (tipo in ('estandar','texto','landing'));
exception when duplicate_object then null; end $$;

-- ---------- profiles: usuario activo ----------
alter table public.profiles
  add column if not exists activo boolean not null default true;

-- ---------- auditoría ----------
create table if not exists public.auditoria (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  user_nombre  text,
  accion       text not null,            -- creado | editado | eliminado
  entidad      text not null,            -- proyecto | sistema | punto
  entidad_id   uuid,
  proyecto_id  uuid,
  detalle      text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_auditoria_proyecto on public.auditoria(proyecto_id);
create index if not exists idx_auditoria_fecha on public.auditoria(created_at desc);

alter table public.auditoria enable row level security;

-- Solo lectura para usuarios con acceso; escritura vía triggers (security definer).
drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (
    public.is_admin()
    or (proyecto_id is not null and public.has_project_access(proyecto_id))
  );
