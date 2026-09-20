-- =============================================================
-- System PEX — Roles operativos (Fase 2)
--
-- Amplía los roles de admin|subcuenta a 4 roles reales, con permisos
-- reforzados a nivel de datos (RLS). ADITIVO: no borra usuarios ni
-- cambia el rol de nadie; 'admin' y 'subcuenta' siguen válidos.
--
--   admin          → Administrador (control total)      = is_admin()
--   pm             → Project Manager (ve todo)          ┐ puede_ver_todo()
--   coordinacion   → Coordinación (ve todo)             ┘
--   implementacion → Implementación (proyectos asignados / responsable)
--   subcuenta      → Colaborador (legacy, por asignación)
-- =============================================================

alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles
  add constraint profiles_rol_check
  check (rol in ('admin','subcuenta','pm','coordinacion','implementacion'));

-- Responsable de implementación del proyecto (un solo ejecutor por proyecto).
alter table public.proyectos
  add column if not exists responsable_implementacion uuid
    references public.profiles(id) on delete set null;

-- Rol del usuario actual (null si está inactivo o no existe).
create or replace function public.mi_rol()
returns text language sql security definer set search_path = public stable as $$
  select rol from public.profiles where id = auth.uid() and activo;
$$;

-- ¿Ve todos los proyectos? Admin, PM y Coordinación.
create or replace function public.puede_ver_todo()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and activo
      and rol in ('admin','pm','coordinacion')
  );
$$;

-- Acceso a proyecto: ve-todo, o es su creador/responsable, o está asignado.
-- (is_admin sigue igual; los datos existentes no cambian de comportamiento.)
create or replace function public.has_project_access(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    exists (select 1 from public.profiles where id = auth.uid() and activo)
    and (
      public.puede_ver_todo()
      or exists (
        select 1 from public.proyectos p
        where p.id = pid
          and (p.creado_por = auth.uid()
               or p.responsable_implementacion = auth.uid())
      )
      or exists (
        select 1 from public.asignaciones a
        where a.proyecto_id = pid and a.user_id = auth.uid()
      )
    );
$$;

grant execute on function public.mi_rol() to authenticated;
grant execute on function public.puede_ver_todo() to authenticated;
