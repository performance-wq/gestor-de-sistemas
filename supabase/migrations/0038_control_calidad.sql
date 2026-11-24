-- =============================================================
-- Systems PEX — Proceso "Control de calidad"
--
-- Doble checklist por proyecto: primero lo pasa la implementadora y
-- luego la supervisora, sistema por sistema. Los puntos del checklist
-- viven en el código (src/lib/control-calidad.ts); aquí solo se guardan
-- las marcas y las observaciones.
--
--   rol = 'implementadora' | 'supervisora'
--   item_key = clave estable del punto (p. ej. 'ia.prompt')
--             o '<sistema>.obs' para la observación del sistema.
-- ADITIVO: tabla nueva, no toca nada existente.
-- =============================================================

create table if not exists public.control_calidad (
  id                 uuid primary key default gen_random_uuid(),
  proyecto_id        uuid not null references public.proyectos(id) on delete cascade,
  item_key           text not null,
  rol                text not null check (rol in ('implementadora','supervisora')),
  ok                 boolean not null default false,
  nota               text,
  marcado_por        uuid references public.profiles(id) on delete set null,
  marcado_por_nombre text,
  marcado_en         timestamptz,
  unique (proyecto_id, item_key, rol)
);

create index if not exists idx_cc_proyecto on public.control_calidad(proyecto_id);

alter table public.control_calidad enable row level security;

drop policy if exists cc_all on public.control_calidad;
create policy cc_all on public.control_calidad for all to authenticated
  using (public.has_project_access(proyecto_id))
  with check (public.has_project_access(proyecto_id));

-- Igual que el resto de la app (0027): todo usuario activo puede VER.
drop policy if exists cc_ver_todos on public.control_calidad;
create policy cc_ver_todos on public.control_calidad for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- Sella quién y cuándo marcó o escribió cada punto.
create or replace function public.fn_control_calidad_stamp()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  cambio boolean;
begin
  if tg_op = 'INSERT' then
    cambio := true;
  else
    cambio := new.ok is distinct from old.ok
              or new.nota is distinct from old.nota;
  end if;
  if cambio then
    if new.ok or coalesce(new.nota, '') <> '' then
      new.marcado_por := auth.uid();
      select nombre into new.marcado_por_nombre
        from public.profiles where id = auth.uid();
      new.marcado_en := now();
    else
      new.marcado_por := null;
      new.marcado_por_nombre := null;
      new.marcado_en := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_control_calidad_stamp on public.control_calidad;
create trigger trg_control_calidad_stamp
  before insert or update on public.control_calidad
  for each row execute function public.fn_control_calidad_stamp();
