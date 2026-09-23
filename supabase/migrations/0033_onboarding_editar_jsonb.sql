-- =============================================================
-- Systems PEX - Editar respuestas: ahora tambien archivos (imagenes/videos)
--
-- Amplia onboarding_editar_respuesta para aceptar un valor jsonb, de modo
-- que el gestor pueda corregir tanto respuestas de TEXTO (string jsonb)
-- como listas de ARCHIVOS (array jsonb de {path,nombre,tipo}). La subida
-- real de archivos la hace el cliente contra Storage (bucket 'assets');
-- este RPC solo guarda el jsonb resultante y registra la edicion.
--
-- ADITIVO: misma tabla de auditoria (onboarding_ediciones) y misma logica
-- de permisos (has_project_access). Reemplaza la firma (…, text) por
-- (…, jsonb); PostgREST serializa string o array al mismo parametro.
-- =============================================================

drop function if exists public.onboarding_editar_respuesta(uuid, int, text, text);

create or replace function public.onboarding_editar_respuesta(
  p_proyecto uuid,
  p_version  int,
  p_pregunta text,
  p_valor    jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  fila       public.onboarding;
  v_uid      uuid := auth.uid();
  v_nombre   text;
  v_anterior jsonb;
  v_result   jsonb;
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
                                    array[p_pregunta], p_valor, true),
         actualizado_en = now()
   where id = fila.id
   returning respuestas into v_result;

  insert into public.onboarding_ediciones(
    onboarding_id, proyecto_id, pregunta_id,
    valor_anterior, valor_nuevo, editado_por, editado_por_nombre)
  values (fila.id, fila.proyecto_id, p_pregunta,
          v_anterior, p_valor, v_uid, v_nombre);

  insert into public.auditoria(user_id, user_nombre, accion, entidad,
                               entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre, 'Sistema'), 'editado', 'proyecto',
          p_proyecto, p_proyecto,
          'Respuesta de onboarding editada: ' || p_pregunta);

  return v_result;
end $$;

grant execute on function public.onboarding_editar_respuesta(uuid, int, text, jsonb) to authenticated;
