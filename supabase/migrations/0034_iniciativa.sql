-- =============================================================
-- System PEX - Responsabilidad por INICIATIVA (tomar tareas)
--
-- Cambia el modelo de "asignacion" a "iniciativa": una tarea puede
-- crearse SIN responsable (disponible) y cualquier usuario operativo
-- autorizado la toma por iniciativa. Al tomarla:
--   - se valida el CODIGO personal del usuario,
--   - queda como responsable (claim atomico anti-duplicado),
--   - pasa a En proceso,
--   - arranca el cronometro operativo,
--   - se registra en el historial.
-- La entrega (tarea_terminar) tambien exige el codigo personal.
--
-- ADITIVO: no toca proyectos, onboarding, performance, revision, etc.
-- Reutiliza el cronometro (tiempo_evento) y el historial existentes.
-- =============================================================

-- ---------- Codigo personal por usuario ----------
alter table public.profiles add column if not exists codigo text;

-- Fijar/actualizar mi propio codigo (minimo 4 caracteres).
create or replace function public.set_mi_codigo(p_codigo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if p_codigo is null or length(btrim(p_codigo)) < 4 then
    raise exception 'El codigo debe tener al menos 4 caracteres.';
  end if;
  update public.profiles set codigo = btrim(p_codigo) where id = auth.uid();
end $$;
grant execute on function public.set_mi_codigo(text) to authenticated;

-- Tengo codigo configurado? (no expone el valor)
create or replace function public.mi_codigo_estado()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(length(btrim(codigo)) > 0, false)
    from public.profiles where id = auth.uid();
$$;
grant execute on function public.mi_codigo_estado() to authenticated;

-- ---------- Visibilidad: todos ven todas las tareas ----------
-- Coherente con "todos ven todos los proyectos" (0027). El modelo de
-- iniciativa necesita que los operativos vean las tareas disponibles y
-- el estado de las tomadas ("En proceso - Juan"). La ESCRITURA sigue por
-- RPC, asi que solo cambia la lectura.
drop policy if exists tasks_ver_todos on public.tasks;
create policy tasks_ver_todos on public.tasks for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

drop policy if exists task_history_ver_todos on public.task_history;
create policy task_history_ver_todos on public.task_history for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

drop policy if exists task_comments_ver_todos on public.task_comments;
create policy task_comments_ver_todos on public.task_comments for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- ---------- Tomar tarea por iniciativa ----------
-- Claim atomico: solo tiene exito si la tarea sigue disponible
-- (responsable_id null y estado pendiente/reabierta). Evita que dos
-- personas la tomen a la vez.
create or replace function public.task_tomar(p_task_id uuid, p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_cod    text;
  v_nombre text;
  v_estado text;
  v_resp   uuid;
  v_rows   int;
begin
  if v_uid is null then raise exception 'No autenticado.'; end if;

  select codigo, nombre into v_cod, v_nombre
    from public.profiles where id = v_uid and activo;
  if not found then raise exception 'Usuario no activo.'; end if;
  if v_cod is null or length(btrim(v_cod)) = 0 then
    raise exception 'Configura tu codigo de usuario antes de tomar tareas.';
  end if;
  if btrim(p_codigo) is distinct from v_cod then
    raise exception 'Codigo incorrecto.';
  end if;

  select estado, responsable_id into v_estado, v_resp
    from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;

  update public.tasks
     set responsable_id = v_uid,
         estado = 'en_proceso',
         cerrada_at = null
   where id = p_task_id
     and responsable_id is null
     and estado in ('pendiente','reabierta');
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select estado, responsable_id into v_estado, v_resp
      from public.tasks where id = p_task_id;
    if v_resp is not null then
      raise exception 'La tarea ya fue tomada por %.',
        coalesce((select nombre from public.profiles where id = v_resp), 'otra persona');
    else
      raise exception 'Esta tarea no esta disponible para tomar.';
    end if;
  end if;

  -- Historial: iniciativa + cambio de estado.
  insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
  values (p_task_id, v_uid, 'iniciativa', 'responsable', null, v_nombre);
  insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
  values (p_task_id, v_uid, 'estado', 'estado', v_estado, 'en_proceso');

  -- Arranca el cronometro operativo (reutiliza toda la logica de sesiones).
  perform public.tiempo_evento(p_task_id, 'inicio');

  return 'ok';
end $$;
grant execute on function public.task_tomar(uuid, text) to authenticated;

-- ---------- Entregar tarea (ahora exige el codigo personal) ----------
drop function if exists public.tarea_terminar(uuid);
create or replace function public.tarea_terminar(p_task_id uuid, p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_cod       text;
  v_last      text;
  v_last_tipo text;
  t           public.tasks%rowtype;
  v_nuevo     text;
begin
  if v_uid is null then raise exception 'No autenticado.'; end if;

  select codigo into v_cod from public.profiles where id = v_uid and activo;
  if v_cod is null or length(btrim(v_cod)) = 0 then
    raise exception 'Configura tu codigo de usuario antes de entregar tareas.';
  end if;
  if btrim(p_codigo) is distinct from v_cod then
    raise exception 'Codigo incorrecto.';
  end if;

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
end $$;
grant execute on function public.tarea_terminar(uuid, text) to authenticated;
