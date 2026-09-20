-- =============================================================
-- System PEX — Listado de miembros (Fase 3/4)
--
-- profiles tiene RLS restrictiva (cada quien se ve a sí mismo; el
-- admin ve a todos). Para asignar responsables y mostrar nombres en
-- tareas, los gestores y ejecutores necesitan la lista de miembros
-- activos. Nombres/roles del equipo no son sensibles dentro de la
-- herramienta interna: función SECURITY DEFINER de solo lectura.
-- =============================================================
create or replace function public.listar_miembros()
returns table (id uuid, nombre text, email text, rol text)
language sql security definer set search_path = public stable as $$
  select p.id, coalesce(p.nombre, p.email) as nombre, p.email, p.rol
  from public.profiles p
  where p.activo
  order by coalesce(p.nombre, p.email);
$$;

grant execute on function public.listar_miembros() to authenticated;
