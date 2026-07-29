-- =============================================================
-- Systems PEX — Avance del Proyecto: vista pública de solo lectura
--
-- Reutiliza el checklist_items existente (NO duplica). Cada proyecto
-- tiene un enlace público corto e independiente; el cliente solo LEE
-- el avance, nunca modifica. Se puede regenerar (invalida el anterior)
-- y desactivar.
-- =============================================================

create table if not exists public.progreso_enlaces (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null unique references public.proyectos(id) on delete cascade,
  token                 text not null unique,
  activo                boolean not null default true,
  generado_por          uuid references public.profiles(id) on delete set null,
  generado_por_nombre   text,
  generado_en           timestamptz not null default now(),
  regenerado_por        uuid references public.profiles(id) on delete set null,
  regenerado_por_nombre text,
  regenerado_en         timestamptz,
  desactivado_en        timestamptz,
  actualizado_en        timestamptz not null default now()
);

create index if not exists idx_progreso_token on public.progreso_enlaces(token);

alter table public.progreso_enlaces enable row level security;

-- Solo lectura interna (para mostrar el estado del enlace en el panel).
-- Las escrituras van por RPC (security definer).
drop policy if exists progreso_select on public.progreso_enlaces;
create policy progreso_select on public.progreso_enlaces for select to authenticated
  using (public.has_project_access(proyecto_id));

-- -------------------------------------------------------------
-- Token corto, limpio y difícil de adivinar (6 chars, sin O/0/I/1/L).
-- -------------------------------------------------------------
create or replace function public.progreso_token_nuevo()
returns text language plpgsql set search_path=public as $$
declare
  alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.progreso_enlaces where token = code);
  end loop;
  return code;
end $$;

-- -------------------------------------------------------------
-- Registrar en auditoría (helper interno).
-- -------------------------------------------------------------
create or replace function public.progreso_auditar(p_proyecto uuid, p_detalle text)
returns void language plpgsql security definer set search_path=public as $$
declare v_nombre text; v_uid uuid := auth.uid();
begin
  select nombre into v_nombre from public.profiles where id = v_uid;
  insert into public.auditoria(user_id, user_nombre, accion, entidad,
                               entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre, 'Sistema'), 'editado', 'proyecto',
          p_proyecto, p_proyecto, p_detalle);
end $$;

-- -------------------------------------------------------------
-- Asegurar el enlace (crear si no existe / reactivar si estaba off).
-- -------------------------------------------------------------
create or replace function public.progreso_asegurar(p_proyecto uuid)
returns public.progreso_enlaces
language plpgsql security definer set search_path=public as $$
declare
  fila     public.progreso_enlaces;
  v_uid    uuid := auth.uid();
  v_nombre text;
begin
  if not public.has_project_access(p_proyecto) then
    raise exception 'Sin permiso para este proyecto';
  end if;
  select nombre into v_nombre from public.profiles where id = v_uid;

  select * into fila from public.progreso_enlaces where proyecto_id = p_proyecto;
  if found then
    if not fila.activo then
      update public.progreso_enlaces
         set activo = true, desactivado_en = null, actualizado_en = now()
       where id = fila.id returning * into fila;
      perform public.progreso_auditar(p_proyecto, 'Enlace de avance reactivado');
    end if;
    return fila;
  end if;

  insert into public.progreso_enlaces (proyecto_id, token, generado_por, generado_por_nombre)
  values (p_proyecto, public.progreso_token_nuevo(), v_uid, v_nombre)
  returning * into fila;
  perform public.progreso_auditar(p_proyecto, 'Enlace de avance generado');
  return fila;
end $$;

-- -------------------------------------------------------------
-- Regenerar: nuevo token (el anterior deja de funcionar).
-- -------------------------------------------------------------
create or replace function public.progreso_regenerar(p_proyecto uuid)
returns public.progreso_enlaces
language plpgsql security definer set search_path=public as $$
declare
  fila     public.progreso_enlaces;
  v_uid    uuid := auth.uid();
  v_nombre text;
begin
  if not public.has_project_access(p_proyecto) then
    raise exception 'Sin permiso para este proyecto';
  end if;
  select nombre into v_nombre from public.profiles where id = v_uid;

  update public.progreso_enlaces
     set token = public.progreso_token_nuevo(),
         activo = true, desactivado_en = null,
         regenerado_por = v_uid, regenerado_por_nombre = v_nombre,
         regenerado_en = now(), actualizado_en = now()
   where proyecto_id = p_proyecto
   returning * into fila;

  if not found then
    -- No existía: crearlo.
    return public.progreso_asegurar(p_proyecto);
  end if;
  perform public.progreso_auditar(p_proyecto, 'Enlace de avance regenerado');
  return fila;
end $$;

-- -------------------------------------------------------------
-- Activar / desactivar el enlace.
-- -------------------------------------------------------------
create or replace function public.progreso_set_activo(p_proyecto uuid, p_activo boolean)
returns public.progreso_enlaces
language plpgsql security definer set search_path=public as $$
declare fila public.progreso_enlaces;
begin
  if not public.has_project_access(p_proyecto) then
    raise exception 'Sin permiso para este proyecto';
  end if;
  update public.progreso_enlaces
     set activo = p_activo,
         desactivado_en = case when p_activo then null else now() end,
         actualizado_en = now()
   where proyecto_id = p_proyecto
   returning * into fila;
  perform public.progreso_auditar(p_proyecto,
    case when p_activo then 'Enlace de avance reactivado'
         else 'Enlace de avance desactivado' end);
  return fila;
end $$;

grant execute on function public.progreso_asegurar(uuid)          to authenticated;
grant execute on function public.progreso_regenerar(uuid)         to authenticated;
grant execute on function public.progreso_set_activo(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- Vista pública (cliente sin cuenta). Solo lectura, sin IDs internos.
-- Devuelve null si el token no existe o está desactivado.
-- -------------------------------------------------------------
create or replace function public.progreso_obtener(p_token text)
returns json
language sql security definer set search_path=public stable as $$
  select json_build_object(
    'proyecto',           p.nombre,
    'cliente',            p.cliente,
    'estado',             p.estado,
    'fechaIncorporacion', p.fecha_incorporacion,
    'items', coalesce((
      select json_agg(json_build_object(
        'orden',        c.orden,
        'titulo',       c.titulo,
        'completado',   c.completado,
        'completadoEn', c.completado_en
      ) order by c.orden)
      from public.checklist_items c
      where c.proyecto_id = p.id
    ), '[]'::json)
  )
  from public.progreso_enlaces e
  join public.proyectos p on p.id = e.proyecto_id
  where e.token = p_token and e.activo;
$$;

grant execute on function public.progreso_obtener(text) to anon, authenticated;
