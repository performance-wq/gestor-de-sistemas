-- =============================================================
-- System PEX — Corrección de permisos y visibilidad (auditoría)
--
-- ADITIVO / no destructivo: no borra ni resetea datos. Solo ajusta
-- políticas RLS y funciones de permiso para que:
--   1) Una tarea asignada sea visible para su responsable (y su proyecto).
--   2) Un ejecutor NO vea tareas de otros ni proyectos no autorizados.
--   3) Solo gestores (admin/pm/coordinación) creen tareas y proyectos.
-- =============================================================

-- ---------- 1) Acceso a proyecto: incluir "tengo una tarea aquí" ----------
-- Antes, ser responsable de una tarea no daba acceso al proyecto, así que la
-- tarea (y su proyecto) quedaban invisibles. Ahora el proyecto donde tienes
-- una tarea asignada cuenta como proyecto autorizado.
create or replace function public.has_project_access(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    exists (select 1 from public.profiles where id = auth.uid() and activo)
    and (
      public.puede_ver_todo()
      or exists (
        select 1 from public.proyectos p
        where p.id = pid
          and (p.creado_por = auth.uid()
               or p.responsable_implementacion = auth.uid())
      )
      or exists (
        select 1 from public.asignaciones a
        where a.proyecto_id = pid and a.user_id = auth.uid()
      )
      or exists (
        select 1 from public.tasks t
        where t.proyecto_id = pid and t.responsable_id = auth.uid()
      )
    );
$$;

-- ---------- 2) Lectura de tareas: por responsable, sin exponer las ajenas ----------
-- Gestores (ve-todo) ven todas; el resto ve solo las que ejecuta o creó.
-- Así una tarea asignada SIEMPRE aparece para su responsable, y un ejecutor
-- nunca ve tareas de otros aunque comparta proyecto.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    public.puede_ver_todo()
    or responsable_id = auth.uid()
    or creado_por = auth.uid()
  );

-- Historial y comentarios: visibles si puedes ver la tarea (misma regla).
drop policy if exists task_history_select on public.task_history;
create policy task_history_select on public.task_history for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (public.puede_ver_todo()
           or t.responsable_id = auth.uid()
           or t.creado_por = auth.uid())
  ));

drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (public.puede_ver_todo()
           or t.responsable_id = auth.uid()
           or t.creado_por = auth.uid())
  ));

drop policy if exists task_attachments_select on public.task_attachments;
create policy task_attachments_select on public.task_attachments for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (public.puede_ver_todo()
           or t.responsable_id = auth.uid()
           or t.creado_por = auth.uid())
  ));

-- ---------- 3) Crear tareas: solo gestores ----------
-- task_crear ya valida acceso al proyecto; ahora exige además el rol gestor.
create or replace function public.task_crear(
  p_proyecto_id         uuid,
  p_titulo              text,
  p_tipo                text default 'solicitud',
  p_responsable_id      uuid default null,
  p_prioridad           text default 'normal',
  p_deadline            date default null,
  p_sistema_id          uuid default null,
  p_descripcion         text default '',
  p_requiere_validacion boolean default false
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
     responsable_id, creado_por, deadline, requiere_validacion)
  values
    (p_proyecto_id, p_sistema_id, btrim(p_titulo), coalesce(p_descripcion,''),
     p_tipo, p_prioridad, p_responsable_id, v_uid, p_deadline,
     coalesce(p_requiere_validacion,false))
  returning id into v_id;

  insert into public.task_history (task_id, actor_id, accion, valor_nuevo)
  values (v_id, v_uid, 'creada', btrim(p_titulo));

  if p_responsable_id is not null and p_responsable_id <> v_uid then
    insert into public.notifications (user_id, task_id, tipo, texto)
    values (p_responsable_id, v_id, 'asignada',
            'Se te asignó una tarea: ' || btrim(p_titulo));
  end if;

  return v_id;
end;
$$;

-- ---------- 4) Crear proyectos: solo gestores ----------
-- crear_proyecto es SECURITY INVOKER, sujeto a esta política.
drop policy if exists proyectos_insert on public.proyectos;
create policy proyectos_insert on public.proyectos for insert to authenticated
  with check (creado_por = auth.uid() and public.puede_gestionar_tareas());
