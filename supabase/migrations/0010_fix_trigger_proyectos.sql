-- =============================================================
-- Systems PEX — FIX: crear/editar proyectos fallaba
--
-- La 0008 usaba una sola condición:
--   if tg_table_name = 'puntos' and tg_op = 'UPDATE'
--      and new.copy is not distinct from old.copy ...
-- PL/pgSQL NO hace cortocircuito en esa expresión: resuelve los campos
-- del record aunque la primera parte sea falsa. Al disparar el trigger
-- sobre 'proyectos' (que no tiene columna 'copy') lanzaba
--   42703: record "new" has no field "copy"
-- y rompía TODO insert/update de proyectos (crear proyecto, cambiar
-- estado, guardar datos de control).
--
-- Fix: anidar los IF para que los campos solo se evalúen cuando la
-- tabla es realmente 'puntos' y la operación es UPDATE.
-- =============================================================

create or replace function public.fn_set_actualizado()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_nombre text;
begin
  if tg_table_name = 'puntos' and tg_op = 'UPDATE' then
    if new.copy   is not distinct from old.copy
       and new.imagen is not distinct from old.imagen
       and new.video  is not distinct from old.video
       and new.url    is not distinct from old.url
       and new.nombre is not distinct from old.nombre then
      return new; -- reordenamiento: no sellar
    end if;
  end if;

  select nombre into v_nombre from public.profiles where id = auth.uid();
  new.actualizado_por := auth.uid();
  new.actualizado_por_nombre := v_nombre;
  new.actualizado_en := now();
  return new;
end $$;

create or replace function public.fn_auditar()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_nombre text;
  v_accion text;
  v_entidad text;
  v_proyecto_id uuid;
  v_detalle text;
  rec record;
begin
  -- Reordenamiento (solo cambia 'orden'): no auditar.
  if tg_table_name = 'puntos' and tg_op = 'UPDATE' then
    if new.copy   is not distinct from old.copy
       and new.imagen is not distinct from old.imagen
       and new.video  is not distinct from old.video
       and new.url    is not distinct from old.url
       and new.nombre is not distinct from old.nombre then
      return new;
    end if;
  end if;

  v_accion := case tg_op when 'INSERT' then 'creado'
                         when 'UPDATE' then 'editado'
                         when 'DELETE' then 'eliminado' end;
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;

  v_entidad := case tg_table_name when 'proyectos' then 'proyecto'
                                  when 'sistemas'  then 'sistema'
                                  when 'puntos'    then 'punto' end;

  if tg_table_name = 'proyectos' then
    v_proyecto_id := rec.id;  v_detalle := rec.nombre;
  elsif tg_table_name = 'sistemas' then
    v_proyecto_id := rec.proyecto_id;  v_detalle := rec.nombre;
  else
    select s.proyecto_id into v_proyecto_id from public.sistemas s where s.id = rec.sistema_id;
    v_detalle := rec.nombre;
    if tg_op = 'UPDATE' then
      if new.imagen is distinct from old.imagen and new.imagen is not null then
        v_detalle := rec.nombre || ' · imagen subida';
      elsif new.video is distinct from old.video and new.video is not null then
        v_detalle := rec.nombre || ' · video agregado';
      elsif new.url is distinct from old.url and new.url is not null then
        v_detalle := rec.nombre || ' · landing actualizada';
      elsif new.copy is distinct from old.copy then
        v_detalle := rec.nombre || ' · copy actualizado';
      end if;
    end if;
  end if;

  select nombre into v_nombre from public.profiles where id = v_uid;
  insert into public.auditoria(user_id, user_nombre, accion, entidad, entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre, 'Sistema'), v_accion, v_entidad, rec.id, v_proyecto_id, v_detalle);

  return rec;
end $$;
