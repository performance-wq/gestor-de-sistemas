-- =============================================================
-- Systems PEX — Control de acceso estricto + "creado por"
-- =============================================================

-- Quién creó cada usuario.
alter table public.profiles
  add column if not exists creado_por uuid references public.profiles(id) on delete set null;

-- Bloqueo de usuarios inactivos A NIVEL DE DATOS (RLS):
-- un usuario no activo no es admin y no tiene acceso a ningún proyecto.
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function public.has_project_access(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    exists (select 1 from public.profiles where id = auth.uid() and activo)
    and (
      public.is_admin()
      or exists (select 1 from public.proyectos p
                  where p.id = pid and p.creado_por = auth.uid())
      or exists (select 1 from public.asignaciones a
                  where a.proyecto_id = pid and a.user_id = auth.uid())
    );
$$;
