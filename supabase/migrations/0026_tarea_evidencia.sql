-- =============================================================
-- System PEX — Evidencia (1 imagen) en tareas
--
-- ADITIVO: nueva columna opcional tasks.evidencia (path en bucket
-- 'assets'). Se puede subir al crear y reemplazar/eliminar al editar,
-- sin afectar descripción ni los demás campos. La imagen se sirve por
-- URL firmada (bucket privado). Historial registra alta/cambio/quita.
-- =============================================================

alter table public.tasks
  add column if not exists evidencia text;

-- ---------- task_crear: acepta evidencia opcional ----------
drop function if exists public.task_crear(uuid, text, text, uuid, text, date, uuid, text, boolean);
create or replace function public.task_crear(
  p_proyecto_id         uuid,
  p_titulo              text,
  p_tipo                text default 'solicitud',
  p_responsable_id      uuid default null,
  p_prioridad           text default 'normal',
  p_deadline            date default null,
  p_sistema_id          uuid default null,
  p_descripcion         text default '',
  p_requiere_validacion boolean default false,
  p_evidencia           text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado.';
  end if;
  if not public.puede_gestionar_tareas() then
    raise exception 'No autorizado para crear tareas.';
  end if;
  if not public.has_project_access(p_proyecto_id) then
    raise exception 'Sin acceso a ese proyecto.';
  end if;
  if coalesce(btrim(p_titulo),'') = '' then
    raise exception 'El título es obligatorio.';
  end if;

  insert into public.tasks
    (proyecto_id, sistema_id, titulo, descripcion, tipo, prioridad,
     responsable_id, creado_por, deadline, requiere_validacion, evidencia)
  values
    (p_proyecto_id, p_sistema_id, btrim(p_titulo), coalesce(p_descripcion,''),
     p_tipo, p_prioridad, p_responsable_id, v_uid, p_deadline,
     coalesce(p_requiere_validacion,false), p_evidencia)
  returning id into v_id;

  insert into public.task_history (task_id, actor_id, accion, valor_nuevo)
  values (v_id, v_uid, 'creada', btrim(p_titulo));

  if p_evidencia is not null then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_nuevo)
    values (v_id, v_uid, 'editada', 'evidencia', 'imagen adjunta');
  end if;

  if p_responsable_id is not null and p_responsable_id <> v_uid then
    insert into public.notifications (user_id, task_id, tipo, texto)
    values (p_responsable_id, v_id, 'asignada',
            'Se te asignó una tarea: ' || btrim(p_titulo));
  end if;

  return v_id;
end;
$$;

grant execute on function public.task_crear(uuid, text, text, uuid, text, date, uuid, text, boolean, text) to authenticated;

-- ---------- task_editar: reemplazar / quitar evidencia ----------
drop function if exists public.task_editar(uuid, text, text, text, text, uuid, date, uuid, boolean, boolean, boolean);
create or replace function public.task_editar(
  p_task_id        uuid,
  p_titulo         text default null,
  p_descripcion    text default null,
  p_tipo           text default null,
  p_prioridad      text default null,
  p_responsable_id uuid default null,
  p_deadline       date default null,
  p_sistema_id     uuid default null,
  p_set_responsable boolean default false,
  p_set_deadline    boolean default false,
  p_set_sistema     boolean default false,
  p_evidencia       text default null,
  p_set_evidencia   boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t     public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not public.puede_gestionar_tareas() then
    raise exception 'No autorizado para editar esta tarea.';
  end if;
  if not public.has_project_access(t.proyecto_id) then
    raise exception 'Sin acceso a ese proyecto.';
  end if;

  if p_titulo is not null and btrim(p_titulo) <> t.titulo then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'titulo', t.titulo, btrim(p_titulo));
    update public.tasks set titulo = btrim(p_titulo) where id = p_task_id;
  end if;

  if p_descripcion is not null and p_descripcion <> t.descripcion then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'descripcion', t.descripcion, p_descripcion);
    update public.tasks set descripcion = p_descripcion where id = p_task_id;
  end if;

  if p_tipo is not null and p_tipo <> t.tipo then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'tipo', t.tipo, p_tipo);
    update public.tasks set tipo = p_tipo where id = p_task_id;
  end if;

  if p_prioridad is not null and p_prioridad <> t.prioridad then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'prioridad', t.prioridad, p_prioridad);
    update public.tasks set prioridad = p_prioridad where id = p_task_id;
  end if;

  if p_set_responsable and p_responsable_id is distinct from t.responsable_id then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'asignada', 'responsable',
            t.responsable_id::text, p_responsable_id::text);
    update public.tasks set responsable_id = p_responsable_id where id = p_task_id;
    if p_responsable_id is not null and p_responsable_id <> v_uid then
      insert into public.notifications (user_id, task_id, tipo, texto)
      values (p_responsable_id, p_task_id, 'asignada',
              'Se te asignó una tarea: ' || t.titulo);
    end if;
  end if;

  if p_set_deadline and p_deadline is distinct from t.deadline then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'deadline', t.deadline::text, p_deadline::text);
    update public.tasks set deadline = p_deadline where id = p_task_id;
  end if;

  if p_set_sistema and p_sistema_id is distinct from t.sistema_id then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'sistema', t.sistema_id::text, p_sistema_id::text);
    update public.tasks set sistema_id = p_sistema_id where id = p_task_id;
  end if;

  if p_set_evidencia and p_evidencia is distinct from t.evidencia then
    insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_task_id, v_uid, 'editada', 'evidencia',
            case when t.evidencia is null then null else 'imagen' end,
            case when p_evidencia is null then 'sin imagen' else 'imagen adjunta' end);
    update public.tasks set evidencia = p_evidencia where id = p_task_id;
  end if;
end;
$$;

grant execute on function public.task_editar(uuid, text, text, text, text, uuid, date, uuid, boolean, boolean, boolean, text, boolean) to authenticated;
