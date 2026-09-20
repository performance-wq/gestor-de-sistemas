-- =============================================================
-- System PEX — Modelo operativo de tareas (Fase 3)
--
-- Añade la capa de gestión de tareas, seguimiento, historial
-- inmutable, comentarios/evidencia y notificaciones. ADITIVO:
-- no toca proyectos, sistemas, puntos ni datos existentes.
--
-- Relación SIEMPRE por id interno (tasks.proyecto_id). Permisos
-- reforzados a nivel de datos: las mutaciones pasan por funciones
-- SECURITY DEFINER que validan el rol; el cliente NO escribe
-- directo en las tablas (RLS deniega insert/update/delete).
-- =============================================================

-- ---------- tasks ----------
create table if not exists public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  proyecto_id          uuid not null references public.proyectos(id) on delete cascade,
  sistema_id           uuid references public.sistemas(id) on delete set null,
  titulo               text not null,
  descripcion          text not null default '',
  tipo                 text not null default 'solicitud'
                         check (tipo in ('soporte','incidencia','ajuste','solicitud','observacion')),
  prioridad            text not null default 'normal'
                         check (prioridad in ('critica','alta','normal','baja')),
  estado               text not null default 'pendiente'
                         check (estado in ('pendiente','en_proceso','en_revision',
                                           'cerrada','bloqueada','reabierta','cancelada')),
  responsable_id       uuid references public.profiles(id) on delete set null,
  creado_por           uuid references public.profiles(id) on delete set null,
  deadline             date,
  requiere_validacion  boolean not null default false,
  reabierta_count      int not null default 0,
  cerrada_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_tasks_proyecto     on public.tasks(proyecto_id);
create index if not exists idx_tasks_responsable   on public.tasks(responsable_id);
create index if not exists idx_tasks_estado        on public.tasks(estado);

-- ---------- task_history (auditoría inmutable, autogenerada) ----------
create table if not exists public.task_history (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks(id) on delete cascade,
  actor_id       uuid references public.profiles(id) on delete set null,
  accion         text not null,            -- creada | estado | editada | comentario | reabierta | asignada
  campo          text,                     -- campo modificado (si aplica)
  valor_anterior text,
  valor_nuevo    text,
  nota           text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_task_history_task on public.task_history(task_id, created_at);

-- ---------- task_comments (comentarios / evidencia del equipo) ----------
create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  autor_id   uuid references public.profiles(id) on delete set null,
  cuerpo     text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at);

-- ---------- task_attachments (evidencias: imagen/video/archivo/enlace) ----------
create table if not exists public.task_attachments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  comment_id uuid references public.task_comments(id) on delete cascade,
  autor_id   uuid references public.profiles(id) on delete set null,
  tipo       text not null default 'archivo'
               check (tipo in ('imagen','video','archivo','enlace')),
  nombre     text,
  path       text,          -- path en bucket privado 'assets'
  url        text,          -- enlace externo
  created_at timestamptz not null default now()
);
create index if not exists idx_task_attachments_task on public.task_attachments(task_id);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete cascade,
  tipo       text not null default 'info',
  texto      text not null,
  leida      boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, leida, created_at);

-- =============================================================
-- Trigger: updated_at automático en tasks
-- =============================================================
create or replace function public.tasks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch
  before update on public.tasks
  for each row execute function public.tasks_touch_updated_at();

-- =============================================================
-- Inmutabilidad del historial: prohibir update/delete
-- =============================================================
create or replace function public.task_history_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial es inmutable y no puede modificarse ni eliminarse.';
end;
$$;
drop trigger if exists trg_task_history_noupd on public.task_history;
create trigger trg_task_history_noupd
  before update or delete on public.task_history
  for each row execute function public.task_history_inmutable();

-- =============================================================
-- Helpers de permisos
-- =============================================================
-- ¿Puede gestionar tareas (crear/editar/asignar/validar/cerrar todo)?
-- Admin, PM y Coordinación. (implementación y subcuenta = ejecutor)
create or replace function public.puede_gestionar_tareas()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and activo
      and rol in ('admin','pm','coordinacion')
  );
$$;

-- Transición de estado genérica permitida (independiente del rol).
create or replace function public.transicion_valida(actual text, siguiente text)
returns boolean language sql immutable as $$
  select case actual
    when 'pendiente'   then siguiente in ('en_proceso','bloqueada','cancelada')
    when 'en_proceso'  then siguiente in ('en_revision','cerrada','bloqueada','cancelada','pendiente')
    when 'en_revision' then siguiente in ('cerrada','en_proceso','cancelada')
    when 'bloqueada'   then siguiente in ('pendiente','en_proceso','cancelada')
    when 'reabierta'   then siguiente in ('en_proceso','en_revision','cerrada','bloqueada','cancelada')
    when 'cerrada'     then siguiente in ('reabierta')
    when 'cancelada'   then siguiente in ('reabierta')
    else false
  end;
$$;

-- =============================================================
-- RPC: task_crear
-- Crea una tarea SIEMPRE ligada a un proyecto existente (por id).
-- Nunca crea proyectos. Requiere acceso al proyecto.
-- =============================================================
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

  -- Notifica al responsable (si existe y no es quien la crea).
  if p_responsable_id is not null and p_responsable_id <> v_uid then
    insert into public.notifications (user_id, task_id, tipo, texto)
    values (p_responsable_id, v_id, 'asignada',
            'Se te asignó una tarea: ' || btrim(p_titulo));
  end if;

  return v_id;
end;
$$;

-- =============================================================
-- RPC: task_editar (solo gestores: admin/pm/coordinación)
-- Edita metadatos y registra cada cambio en el historial.
-- Los ejecutores NO pueden editar estos campos.
-- =============================================================
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
  p_set_sistema     boolean default false
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
end;
$$;

-- =============================================================
-- RPC: task_transicion (cambio de estado con reglas por rol)
-- =============================================================
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
    raise exception 'Transición no permitida: % -> %', t.estado, p_estado;
  end if;

  -- Restricciones del ejecutor (implementación / subcuenta).
  if not v_gestor then
    if p_estado in ('cancelada','reabierta') then
      raise exception 'No autorizado a ese cambio de estado.';
    end if;
    if p_estado = 'cerrada' then
      if t.requiere_validacion then
        raise exception 'Esta tarea requiere validación: envíala a revisión.';
      end if;
      if t.estado = 'en_revision' then
        raise exception 'La validación la realiza un responsable.';
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

  -- Al entrar en revisión, avisa a los gestores del proyecto.
  if p_estado = 'en_revision' then
    insert into public.notifications (user_id, task_id, tipo, texto)
    select p.id, p_task_id, 'revision',
           'Tarea en revisión: ' || t.titulo
      from public.profiles p
     where p.activo and p.rol in ('admin','pm','coordinacion') and p.id <> v_uid;
  end if;
end;
$$;

-- =============================================================
-- RPC: task_reabrir (solo gestores) — preserva la tarea original
-- =============================================================
create or replace function public.task_reabrir(
  p_task_id uuid,
  p_motivo  text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t     public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not public.puede_gestionar_tareas() then
    raise exception 'No autorizado para reabrir tareas.';
  end if;
  if t.estado not in ('cerrada','cancelada') then
    raise exception 'Solo se reabren tareas cerradas o canceladas.';
  end if;

  insert into public.task_history (task_id, actor_id, accion, campo, valor_anterior, valor_nuevo, nota)
  values (p_task_id, v_uid, 'reabierta', 'estado', t.estado, 'reabierta', p_motivo);

  update public.tasks
     set estado = 'reabierta',
         reabierta_count = reabierta_count + 1,
         cerrada_at = null
   where id = p_task_id;

  if t.responsable_id is not null and t.responsable_id <> v_uid then
    insert into public.notifications (user_id, task_id, tipo, texto)
    values (t.responsable_id, p_task_id, 'reabierta',
            'Tarea reabierta: ' || t.titulo);
  end if;
end;
$$;

-- =============================================================
-- RPC: task_comentar (cualquiera con acceso al proyecto)
-- =============================================================
create or replace function public.task_comentar(
  p_task_id uuid,
  p_cuerpo  text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t     public.tasks%rowtype;
  v_id  uuid;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tarea no encontrada.'; end if;
  if not public.has_project_access(t.proyecto_id) then
    raise exception 'Sin acceso a ese proyecto.';
  end if;
  if coalesce(btrim(p_cuerpo),'') = '' then
    raise exception 'El comentario no puede estar vacío.';
  end if;

  insert into public.task_comments (task_id, autor_id, cuerpo)
  values (p_task_id, v_uid, btrim(p_cuerpo))
  returning id into v_id;

  insert into public.task_history (task_id, actor_id, accion, valor_nuevo)
  values (p_task_id, v_uid, 'comentario', left(btrim(p_cuerpo), 140));

  return v_id;
end;
$$;

-- =============================================================
-- RPC: notificaciones_marcar_leidas
-- =============================================================
create or replace function public.notificaciones_marcar_leidas(
  p_ids uuid[] default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ids is null then
    update public.notifications set leida = true
     where user_id = auth.uid() and not leida;
  else
    update public.notifications set leida = true
     where user_id = auth.uid() and id = any(p_ids);
  end if;
end;
$$;

-- =============================================================
-- Row Level Security (lectura por acceso a proyecto; escritura por RPC)
-- =============================================================
alter table public.tasks            enable row level security;
alter table public.task_history     enable row level security;
alter table public.task_comments    enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notifications    enable row level security;

-- tasks: SELECT por acceso al proyecto. Sin políticas de escritura => RPC only.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.has_project_access(proyecto_id));

-- task_history: SELECT por acceso al proyecto de la tarea.
drop policy if exists task_history_select on public.task_history;
create policy task_history_select on public.task_history for select to authenticated
  using (public.has_project_access(
    (select t.proyecto_id from public.tasks t where t.id = task_id)));

-- task_comments: SELECT por acceso; INSERT vía RPC (definer). Permitimos
-- además insert directo del propio autor con acceso (por si el cliente
-- inserta comentario simple), pero el flujo estándar usa task_comentar.
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select to authenticated
  using (public.has_project_access(
    (select t.proyecto_id from public.tasks t where t.id = task_id)));

-- task_attachments: SELECT por acceso; INSERT/DELETE por el propio autor con acceso.
drop policy if exists task_attachments_select on public.task_attachments;
create policy task_attachments_select on public.task_attachments for select to authenticated
  using (public.has_project_access(
    (select t.proyecto_id from public.tasks t where t.id = task_id)));

drop policy if exists task_attachments_insert on public.task_attachments;
create policy task_attachments_insert on public.task_attachments for insert to authenticated
  with check (
    autor_id = auth.uid()
    and public.has_project_access(
      (select t.proyecto_id from public.tasks t where t.id = task_id)));

drop policy if exists task_attachments_delete on public.task_attachments;
create policy task_attachments_delete on public.task_attachments for delete to authenticated
  using (autor_id = auth.uid() or public.puede_gestionar_tareas());

-- notifications: cada quien ve/actualiza las suyas.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================
-- Grants de ejecución
-- =============================================================
grant execute on function public.puede_gestionar_tareas() to authenticated;
grant execute on function public.transicion_valida(text, text) to authenticated;
grant execute on function public.task_crear(uuid, text, text, uuid, text, date, uuid, text, boolean) to authenticated;
grant execute on function public.task_editar(uuid, text, text, text, text, uuid, date, uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.task_transicion(uuid, text, text) to authenticated;
grant execute on function public.task_reabrir(uuid, text) to authenticated;
grant execute on function public.task_comentar(uuid, text) to authenticated;
grant execute on function public.notificaciones_marcar_leidas(uuid[]) to authenticated;
