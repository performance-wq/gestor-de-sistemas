-- =============================================================
-- System PEX - Archivar proyectos (borrado suave + recuperacion)
--
-- "Eliminar" un proyecto ya NO lo destruye: lo archiva (archivado_en).
-- Los proyectos archivados desaparecen de las listas normales pero se
-- conservan y SOLO un administrador puede restaurarlos desde la Papelera.
-- El borrado permanente sigue existiendo (RLS proyectos_delete = admin).
--
-- ADITIVO: no toca sistemas, onboarding, tareas ni datos existentes.
-- =============================================================

alter table public.proyectos add column if not exists archivado_en timestamptz;
alter table public.proyectos add column if not exists archivado_por uuid
  references public.profiles(id) on delete set null;
alter table public.proyectos add column if not exists archivado_por_nombre text;

-- Archivar (solo admin). Registra en auditoria.
create or replace function public.proyecto_archivar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_nombre text; v_pname text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede archivar proyectos.';
  end if;
  select nombre into v_nombre from public.profiles where id = v_uid;
  select nombre into v_pname from public.proyectos where id = p_id;
  if not found then raise exception 'Proyecto no encontrado.'; end if;
  update public.proyectos
     set archivado_en = now(), archivado_por = v_uid, archivado_por_nombre = v_nombre
   where id = p_id;
  insert into public.auditoria(user_id, user_nombre, accion, entidad,
                               entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre,'Sistema'), 'eliminado', 'proyecto',
          p_id, p_id, 'Proyecto archivado: ' || coalesce(v_pname,''));
end $$;
grant execute on function public.proyecto_archivar(uuid) to authenticated;

-- Restaurar (solo admin). Registra en auditoria.
create or replace function public.proyecto_restaurar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_nombre text; v_pname text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede restaurar proyectos.';
  end if;
  select nombre into v_nombre from public.profiles where id = v_uid;
  select nombre into v_pname from public.proyectos where id = p_id;
  if not found then raise exception 'Proyecto no encontrado.'; end if;
  update public.proyectos
     set archivado_en = null, archivado_por = null, archivado_por_nombre = null
   where id = p_id;
  insert into public.auditoria(user_id, user_nombre, accion, entidad,
                               entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre,'Sistema'), 'editado', 'proyecto',
          p_id, p_id, 'Proyecto restaurado: ' || coalesce(v_pname,''));
end $$;
grant execute on function public.proyecto_restaurar(uuid) to authenticated;
