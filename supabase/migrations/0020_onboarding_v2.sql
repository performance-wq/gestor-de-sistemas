-- =============================================================
-- Systems PEX — Onboarding V2 (segunda versión del formulario)
--
-- AMPLÍA el módulo de onboarding: cada proyecto puede tener enlaces
-- de V1 y V2, cada uno con su token, respuestas, estado, historial y
-- archivos. Reutiliza toda la infraestructura existente. NO toca V1
-- (las filas actuales quedan como version=1).
-- =============================================================

alter table public.onboarding
  add column if not exists version int not null default 1;

-- Un formulario por (proyecto, versión), en vez de uno por proyecto.
alter table public.onboarding drop constraint if exists onboarding_proyecto_id_key;
create unique index if not exists idx_onboarding_proyecto_version
  on public.onboarding (proyecto_id, version);

-- --- asegurar: crea/obtiene el enlace de la versión indicada ---
drop function if exists public.onboarding_asegurar(uuid);
create or replace function public.onboarding_asegurar(p_proyecto uuid, p_version int default 1)
returns public.onboarding
language plpgsql security invoker set search_path=public as $$
declare fila public.onboarding;
begin
  select * into fila from public.onboarding
   where proyecto_id = p_proyecto and version = p_version;
  if found then return fila; end if;

  insert into public.onboarding (proyecto_id, token, version)
  values (p_proyecto, replace(gen_random_uuid()::text, '-', ''), p_version)
  returning * into fila;
  return fila;
end $$;

grant execute on function public.onboarding_asegurar(uuid, int) to authenticated;

-- --- obtener: ahora devuelve también la versión (para el esquema) ---
create or replace function public.onboarding_obtener(p_token text)
returns json
language sql security definer set search_path=public stable as $$
  select json_build_object(
    'proyecto',   p.nombre,
    'cliente',    p.cliente,
    'estado',     o.estado,
    'respuestas', o.respuestas,
    'enviadoEn',  o.enviado_en,
    'version',    o.version
  )
  from public.onboarding o
  join public.proyectos p on p.id = o.proyecto_id
  where o.token = p_token;
$$;

grant execute on function public.onboarding_obtener(text) to anon, authenticated;

-- --- reiniciar: apunta a la versión indicada ---
drop function if exists public.onboarding_reiniciar(uuid);
create or replace function public.onboarding_reiniciar(p_proyecto uuid, p_version int default 1)
returns int
language plpgsql security definer set search_path = public as $$
declare
  fila     public.onboarding;
  v_ver    int := 0;
  v_nombre text;
  v_uid    uuid := auth.uid();
begin
  if not public.has_project_access(p_proyecto) then
    raise exception 'Sin permiso para reiniciar este onboarding';
  end if;

  select * into fila from public.onboarding
   where proyecto_id = p_proyecto and version = p_version;
  if not found then
    raise exception 'Este proyecto no tiene formulario de onboarding';
  end if;

  select nombre into v_nombre from public.profiles where id = v_uid;

  if fila.respuestas is not null and fila.respuestas <> '{}'::jsonb then
    select coalesce(max(version), 0) + 1 into v_ver
      from public.onboarding_versiones where onboarding_id = fila.id;

    insert into public.onboarding_versiones(
      onboarding_id, proyecto_id, version, respuestas, estado,
      enviado_en, archivado_por, archivado_por_nombre)
    values (fila.id, fila.proyecto_id, v_ver, fila.respuestas, fila.estado,
            fila.enviado_en, v_uid, v_nombre);
  end if;

  update public.onboarding
     set respuestas     = '{}'::jsonb,
         estado         = 'pendiente',
         enviado_en     = null,
         actualizado_en = now()
   where id = fila.id;

  insert into public.auditoria(user_id, user_nombre, accion, entidad,
                               entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre, 'Sistema'), 'editado', 'proyecto',
          p_proyecto, p_proyecto,
          case when v_ver > 0
               then 'Onboarding reiniciado · versión ' || v_ver || ' archivada'
               else 'Onboarding reiniciado' end);

  return v_ver;
end $$;

grant execute on function public.onboarding_reiniciar(uuid, int) to authenticated;
