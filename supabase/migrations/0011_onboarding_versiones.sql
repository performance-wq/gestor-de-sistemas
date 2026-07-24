-- =============================================================
-- Systems PEX — Reinicio seguro del onboarding + historial
--
-- "Reiniciar respuestas" NO borra información: archiva la versión
-- actual en onboarding_versiones y deja el formulario vacío,
-- conservando SIEMPRE el mismo enlace (token) del proyecto.
-- =============================================================

create table if not exists public.onboarding_versiones (
  id                   uuid primary key default gen_random_uuid(),
  onboarding_id        uuid not null references public.onboarding(id) on delete cascade,
  proyecto_id          uuid not null references public.proyectos(id) on delete cascade,
  version              int  not null,
  respuestas           jsonb not null,
  estado               text,          -- estado que tenía al archivarse
  enviado_en           timestamptz,
  archivado_en         timestamptz not null default now(),
  archivado_por        uuid references public.profiles(id) on delete set null,
  archivado_por_nombre text,
  unique (onboarding_id, version)
);

create index if not exists idx_onb_ver_proyecto
  on public.onboarding_versiones(proyecto_id, version desc);

alter table public.onboarding_versiones enable row level security;

-- Solo lectura para quien tiene acceso al proyecto. Las escrituras van
-- por el RPC (security definer), nunca directo desde el cliente.
drop policy if exists onb_ver_select on public.onboarding_versiones;
create policy onb_ver_select on public.onboarding_versiones
  for select to authenticated
  using (public.has_project_access(proyecto_id));

-- -------------------------------------------------------------
-- onboarding_reiniciar: archiva y vacía. Devuelve el número de
-- versión archivada (0 si no había respuestas que guardar).
-- SECURITY DEFINER + chequeo explícito de permiso, para poder
-- escribir en versiones y auditoría sin depender del rol.
-- -------------------------------------------------------------
create or replace function public.onboarding_reiniciar(p_proyecto uuid)
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

  select * into fila from public.onboarding where proyecto_id = p_proyecto;
  if not found then
    raise exception 'Este proyecto no tiene formulario de onboarding';
  end if;

  select nombre into v_nombre from public.profiles where id = v_uid;

  -- Archivar solo si hay algo que conservar.
  if fila.respuestas is not null and fila.respuestas <> '{}'::jsonb then
    select coalesce(max(version), 0) + 1 into v_ver
      from public.onboarding_versiones where onboarding_id = fila.id;

    insert into public.onboarding_versiones(
      onboarding_id, proyecto_id, version, respuestas, estado,
      enviado_en, archivado_por, archivado_por_nombre)
    values (fila.id, fila.proyecto_id, v_ver, fila.respuestas, fila.estado,
            fila.enviado_en, v_uid, v_nombre);
  end if;

  -- Vaciar dejando el MISMO token: el cliente puede volver a llenarlo.
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

grant execute on function public.onboarding_reiniciar(uuid) to authenticated;
