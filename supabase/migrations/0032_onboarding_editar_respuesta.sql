-- =============================================================
-- Systems PEX - Editar una respuesta recibida del onboarding
--
-- Permite que un gestor corrija/complete una respuesta despues de que
-- el cliente envio el formulario, SIN pedirle que lo llene de nuevo y
-- SIN destruir el valor anterior: cada edicion queda registrada con
-- usuario, fecha, pregunta, valor anterior y valor nuevo (auditoria).
--
-- ADITIVO: no toca V1, ni el flujo de envio, ni las demas RPCs. La
-- edicion aplica por (proyecto, version), asi funciona igual en V1/V2.
-- =============================================================

create table if not exists public.onboarding_ediciones (
  id                 uuid primary key default gen_random_uuid(),
  onboarding_id      uuid not null references public.onboarding(id) on delete cascade,
  proyecto_id        uuid not null references public.proyectos(id) on delete cascade,
  pregunta_id        text not null,
  valor_anterior     jsonb,
  valor_nuevo        jsonb,
  editado_por        uuid references public.profiles(id) on delete set null,
  editado_por_nombre text,
  editado_en         timestamptz not null default now()
);

create index if not exists idx_onb_edic
  on public.onboarding_ediciones(onboarding_id, pregunta_id, editado_en desc);

alter table public.onboarding_ediciones enable row level security;

-- Solo lectura para quien tiene acceso al proyecto. Las escrituras van
-- por el RPC (security definer), nunca directo desde el cliente.
drop policy if exists onb_edic_select on public.onboarding_ediciones;
create policy onb_edic_select on public.onboarding_ediciones
  for select to authenticated
  using (public.has_project_access(proyecto_id));

-- -------------------------------------------------------------
-- onboarding_editar_respuesta: actualiza UNA respuesta (texto) del
-- formulario indicado y registra la edicion. Devuelve el jsonb de
-- respuestas ya actualizado. El valor viaja como texto (respuestas de
-- texto/textarea/url/email/tel); no toca archivos.
-- -------------------------------------------------------------
create or replace function public.onboarding_editar_respuesta(
  p_proyecto uuid,
  p_version  int,
  p_pregunta text,
  p_valor    text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  fila     public.onboarding;
  v_uid    uuid := auth.uid();
  v_nombre text;
  v_anterior jsonb;
  v_nuevo    jsonb := to_jsonb(p_valor);
begin
  if not public.has_project_access(p_proyecto) then
    raise exception 'Sin permiso para editar este onboarding';
  end if;
  if p_pregunta is null or length(trim(p_pregunta)) = 0 then
    raise exception 'Pregunta invalida';
  end if;

  select * into fila from public.onboarding
   where proyecto_id = p_proyecto and version = p_version;
  if not found then
    raise exception 'Este proyecto no tiene formulario de onboarding';
  end if;

  select nombre into v_nombre from public.profiles where id = v_uid;
  v_anterior := coalesce(fila.respuestas, '{}'::jsonb) -> p_pregunta;

  update public.onboarding
     set respuestas     = jsonb_set(coalesce(respuestas, '{}'::jsonb),
                                    array[p_pregunta], v_nuevo, true),
         actualizado_en = now()
   where id = fila.id
   returning respuestas into v_nuevo;

  insert into public.onboarding_ediciones(
    onboarding_id, proyecto_id, pregunta_id,
    valor_anterior, valor_nuevo, editado_por, editado_por_nombre)
  values (fila.id, fila.proyecto_id, p_pregunta,
          v_anterior, to_jsonb(p_valor), v_uid, v_nombre);

  insert into public.auditoria(user_id, user_nombre, accion, entidad,
                               entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre, 'Sistema'), 'editado', 'proyecto',
          p_proyecto, p_proyecto,
          'Respuesta de onboarding editada: ' || p_pregunta);

  return v_nuevo;
end $$;

grant execute on function public.onboarding_editar_respuesta(uuid, int, text, text) to authenticated;

-- -------------------------------------------------------------
-- Ampliar el limite de tamano por archivo del bucket 'assets' a 500 MB,
-- para que el cliente pueda subir videos reales de su negocio en el
-- onboarding. OJO: el limite GLOBAL del proyecto (Storage > Settings)
-- tambien debe ser >= 500 MB, o el API sigue rechazando archivos grandes.
-- 524288000 = 500 * 1024 * 1024.
-- -------------------------------------------------------------
update storage.buckets set file_size_limit = 524288000 where id = 'assets';
