-- =============================================================
-- System PEX — Cronometro operativo con sesiones tipificadas
--
-- El tiempo de trabajo se mide SOLO por cronometro real, distinguiendo
-- sesiones de ejecucion / revision / correccion. ADITIVO sobre la
-- gestion de tareas; no toca proyectos, onboarding, sistemas, etc.
--
--   ejecucion  -> trabajo del responsable (primera vez)
--   correccion -> trabajo del responsable tras volver de revision
--   revision   -> trabajo del gestor revisando la tarea (en_revision)
--
-- Un usuario no puede tener dos cronometros activos a la vez: al iniciar
-- uno, se pausan automaticamente sus sesiones abiertas en otras tareas.
-- =============================================================

alter table public.task_time_logs
  add column if not exists tipo text not null default 'ejecucion'
    check (tipo in ('ejecucion','revision','correccion'));

-- -------------------------------------------------------------
-- tiempo_evento: registra inicio/pausa/reanudacion/fin, deriva el tipo
-- de sesion, garantiza un solo cronometro activo y pone la tarea en
-- proceso al iniciar ejecucion/correccion.
-- (drop previo: la version base devolvia void; ahora devuelve text)
-- -------------------------------------------------------------
drop function if exists public.tiempo_evento(uuid, text);
create or replace function public.tiempo_evento(p_task_id uuid, p_evento text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_last      text;
  v_last_tipo text;
  v_tipo      text;
  v_estado    text;
  v_resp      uuid;
  r           record;
begin
  if v_uid is null then raise exception 'No autenticado.'; end if;
  if p_evento not in ('inicio','pausa','reanudacion','fin') then
    raise exception 'Evento invalido.';
  end if;

  select estado, responsable_id into v_estado, v_resp
    from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not (public.puede_ver_todo()
          or v_resp = v_uid
          or exists (select 1 from public.tasks t where t.id = p_task_id and t.creado_por = v_uid)) then
    raise exception 'Sin acceso a esa tarea.';
  end if;

  select evento, tipo into v_last, v_last_tipo
    from public.task_time_logs
   where task_id = p_task_id and user_id = v_uid
   order by created_at desc limit 1;

  -- Validar transicion.
  if p_evento = 'inicio' then
    if v_last in ('inicio','reanudacion') then
      raise exception 'El cronometro ya esta en curso.';
    end if;
  elsif p_evento = 'reanudacion' then
    if v_last is distinct from 'pausa' then
      raise exception 'Solo puedes reanudar desde una pausa.';
    end if;
  elsif p_evento = 'pausa' then
    if v_last is distinct from 'inicio' and v_last is distinct from 'reanudacion' then
      raise exception 'Solo puedes pausar cuando esta en curso.';
    end if;
  elsif p_evento = 'fin' then
    if v_last is null or v_last = 'fin' then
      raise exception 'No hay una sesion abierta para finalizar.';
    end if;
  end if;

  -- Derivar el tipo de sesion.
  if p_evento = 'inicio' then
    if v_estado = 'en_revision' and public.puede_ver_todo() then
      v_tipo := 'revision';
    elsif exists (select 1 from public.task_time_logs
                  where task_id = p_task_id and user_id = v_uid
                    and evento = 'fin' and tipo in ('ejecucion','correccion')) then
      v_tipo := 'correccion';
    else
      v_tipo := 'ejecucion';
    end if;
  else
    v_tipo := coalesce(v_last_tipo, 'ejecucion');
  end if;

  -- Un solo cronometro activo: pausar sesiones abiertas en OTRAS tareas.
  if p_evento in ('inicio','reanudacion') then
    for r in (
      with ult as (
        select distinct on (task_id) task_id, evento, tipo
        from public.task_time_logs
        where user_id = v_uid
        order by task_id, created_at desc
      )
      select task_id, tipo from ult
      where evento in ('inicio','reanudacion') and task_id <> p_task_id
    ) loop
      insert into public.task_time_logs (task_id, user_id, evento, tipo)
      values (r.task_id, v_uid, 'pausa', r.tipo);
    end loop;
  end if;

  -- Al iniciar ejecucion/correccion, la tarea pasa a En proceso.
  if p_evento = 'inicio' and v_tipo in ('ejecucion','correccion')
     and v_estado in ('pendiente','reabierta') then
    update public.tasks set estado = 'en_proceso' where id = p_task_id;
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'estado', 'estado', v_estado, 'en_proceso');
  end if;

  insert into public.task_time_logs (task_id, user_id, evento, tipo)
  values (p_task_id, v_uid, p_evento, v_tipo);

  return v_tipo;
end;
$$;

grant execute on function public.tiempo_evento(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- tarea_terminar: el ejecutor finaliza su trabajo. Cierra su cronometro,
-- y enruta la tarea a En revision (si requiere validacion) o Cerrada.
-- -------------------------------------------------------------
create or replace function public.tarea_terminar(p_task_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_last      text;
  v_last_tipo text;
  t           public.tasks%rowtype;
  v_nuevo     text;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not (t.responsable_id = v_uid or public.puede_ver_todo()) then
    raise exception 'No autorizado para terminar esta tarea.';
  end if;
  if t.estado in ('cerrada','cancelada','en_revision') then
    raise exception 'La tarea ya fue terminada o esta en revision.';
  end if;

  select evento, tipo into v_last, v_last_tipo
    from public.task_time_logs
   where task_id = p_task_id and user_id = v_uid
   order by created_at desc limit 1;
  if v_last in ('inicio','reanudacion') then
    insert into public.task_time_logs (task_id, user_id, evento, tipo)
    values (p_task_id, v_uid, 'fin', coalesce(v_last_tipo, 'ejecucion'));
  end if;

  v_nuevo := case when t.requiere_validacion then 'en_revision' else 'cerrada' end;
  update public.tasks
     set estado = v_nuevo,
         cerrada_at = case when v_nuevo = 'cerrada' then now() else cerrada_at end
   where id = p_task_id;
  insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
  values (p_task_id, v_uid, 'estado', 'estado', t.estado, v_nuevo);

  if v_nuevo = 'en_revision' then
    insert into public.notifications (user_id, task_id, tipo, texto)
    select p.id, p_task_id, 'revision', 'Tarea en revision: ' || t.titulo
      from public.profiles p
     where p.activo and p.rol in ('admin','pm','coordinacion') and p.id <> v_uid;
  end if;

  return v_nuevo;
end;
$$;

grant execute on function public.tarea_terminar(uuid) to authenticated;

-- -------------------------------------------------------------
-- revision_terminar: el gestor finaliza la revision. Cierra su cronometro
-- de revision y aprueba (Cerrada) o solicita correcciones (En proceso).
-- -------------------------------------------------------------
create or replace function public.revision_terminar(
  p_task_id uuid, p_resultado text, p_motivo text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_last      text;
  v_last_tipo text;
  t           public.tasks%rowtype;
  v_nuevo     text;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not public.puede_gestionar_tareas() then
    raise exception 'Solo un gestor puede finalizar la revision.';
  end if;
  if t.estado <> 'en_revision' then
    raise exception 'La tarea no esta en revision.';
  end if;
  if p_resultado not in ('aprobar','correcciones') then
    raise exception 'Resultado invalido.';
  end if;

  select evento, tipo into v_last, v_last_tipo
    from public.task_time_logs
   where task_id = p_task_id and user_id = v_uid
   order by created_at desc limit 1;
  if v_last in ('inicio','reanudacion') then
    insert into public.task_time_logs (task_id, user_id, evento, tipo)
    values (p_task_id, v_uid, 'fin', coalesce(v_last_tipo, 'revision'));
  end if;

  if p_resultado = 'aprobar' then
    v_nuevo := 'cerrada';
    update public.tasks set estado = 'cerrada', cerrada_at = now() where id = p_task_id;
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo, nota)
    values (p_task_id, v_uid, 'estado', 'estado', 'en_revision', 'cerrada', p_motivo);
  else
    v_nuevo := 'en_proceso';
    update public.tasks set estado = 'en_proceso', cerrada_at = null where id = p_task_id;
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo, nota)
    values (p_task_id, v_uid, 'reabierta', 'estado', 'en_revision', 'en_proceso (correcciones)', p_motivo);
    if t.responsable_id is not null and t.responsable_id <> v_uid then
      insert into public.notifications (user_id, task_id, tipo, texto)
      values (t.responsable_id, p_task_id, 'correcciones', 'Correcciones solicitadas: ' || t.titulo);
    end if;
  end if;

  return v_nuevo;
end;
$$;

grant execute on function public.revision_terminar(uuid, text, text) to authenticated;

-- -------------------------------------------------------------
-- task_transicion: reforzar que el ejecutor no mueva una tarea que esta
-- En revision (solo el gestor la resuelve con revision_terminar).
-- -------------------------------------------------------------
create or replace function public.task_transicion(
  p_task_id uuid,
  p_estado  text,
  p_nota    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_gestor boolean := public.puede_gestionar_tareas();
  t        public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not public.has_project_access(t.proyecto_id) then
    raise exception 'Sin acceso a ese proyecto.';
  end if;
  if p_estado = t.estado then return; end if;
  if not public.transicion_valida(t.estado, p_estado) then
    raise exception 'Transicion no permitida: % -> %', t.estado, p_estado;
  end if;

  if not v_gestor then
    if p_estado in ('cancelada','reabierta') then
      raise exception 'No autorizado a ese cambio de estado.';
    end if;
    if t.estado = 'en_revision' then
      raise exception 'La revision la gestiona un responsable.';
    end if;
    if p_estado = 'cerrada' then
      if t.requiere_validacion then
        raise exception 'Esta tarea requiere validacion: terminala y pasara a revision.';
      end if;
    end if;
  end if;

  insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo, nota)
  values (p_task_id, v_uid, 'estado', 'estado', t.estado, p_estado, p_nota);

  update public.tasks
     set estado = p_estado,
         cerrada_at = case when p_estado = 'cerrada' then now()
                           when p_estado in ('reabierta','en_proceso','pendiente') then null
                           else cerrada_at end
   where id = p_task_id;

  if p_estado = 'en_revision' then
    insert into public.notifications (user_id, task_id, tipo, texto)
    select p.id, p_task_id, 'revision', 'Tarea en revision: ' || t.titulo
      from public.profiles p
     where p.activo and p.rol in ('admin','pm','coordinacion') and p.id <> v_uid;
  end if;
end;
$$;

grant execute on function public.task_transicion(uuid, text, text) to authenticated;
