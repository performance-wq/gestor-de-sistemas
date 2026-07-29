-- =============================================================
-- Systems PEX — Checklist jerárquico (flujo de implementación)
--
-- Reestructura el checklist en tareas PRINCIPALES + GRUPOS con
-- SUBTAREAS. Los grupos se completan solos cuando todas sus subtareas
-- están hechas. Se aplica a TODOS los proyectos (migración preserva lo
-- ya marcado) y a los futuros (plantilla). No cambia la lógica de
-- marcar/%, ni el enlace compartido, ni otra funcionalidad.
-- =============================================================

alter table public.checklist_items
  add column if not exists es_grupo boolean not null default false,
  add column if not exists grupo    text;

-- ---------- BEFORE UPDATE: sellar quién/cuándo (NO en los grupos) ----------
create or replace function public.fn_checklist_stamp()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.es_grupo then
    return new; -- los grupos son roll-up: no se atribuyen
  end if;
  if tg_op = 'UPDATE' and new.completado is distinct from old.completado then
    if new.completado then
      new.completado_por := auth.uid();
      select nombre into new.completado_por_nombre
        from public.profiles where id = auth.uid();
      new.completado_en := now();
    else
      new.completado_por := null;
      new.completado_por_nombre := null;
      new.completado_en := null;
    end if;
  end if;
  return new;
end $$;

-- ---------- AFTER: recomputar la cabecera del grupo ----------
-- Un grupo está completo si NINGUNA de sus subtareas está pendiente.
create or replace function public.fn_checklist_grupo()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_grupo text := coalesce(new.grupo, old.grupo);
  v_pid   uuid := coalesce(new.proyecto_id, old.proyecto_id);
  v_todas boolean;
begin
  -- Solo reacciona a cambios en SUBTAREAS (no en cabeceras ni sueltas).
  if coalesce(new.es_grupo, old.es_grupo, false) or v_grupo is null then
    return coalesce(new, old);
  end if;

  select not exists (
    select 1 from public.checklist_items
    where proyecto_id = v_pid and grupo = v_grupo
      and es_grupo = false and completado = false
  ) into v_todas;

  update public.checklist_items
     set completado = v_todas
   where proyecto_id = v_pid and grupo = v_grupo and es_grupo = true
     and completado is distinct from v_todas;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_checklist_grupo on public.checklist_items;
create trigger trg_checklist_grupo
  after insert or update or delete on public.checklist_items
  for each row execute function public.fn_checklist_grupo();

-- ---------- Plantilla nueva (proyectos futuros) ----------
create or replace function public.checklist_crear(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.checklist_items where proyecto_id = p_proyecto) then
    return;
  end if;

  insert into public.checklist_items
    (proyecto_id, categoria, titulo, orden, es_grupo, grupo) values
    (p_proyecto,'General','Solicitud de Información',            1, false, null),
    (p_proyecto,'General','Ingreso a la Comunidad',              2, false, null),
    (p_proyecto,'General','Primera Reunión de Configuración',    3, true,  'config'),
    (p_proyecto,'General','Configuración de Facebook',           4, false, 'config'),
    (p_proyecto,'General','Configuración de Instagram',          5, false, 'config'),
    (p_proyecto,'General','Configuración de WhatsApp',           6, false, 'config'),
    (p_proyecto,'General','Configuración del Dominio',           7, false, 'config'),
    (p_proyecto,'General','Configuración de Google',             8, false, 'config'),
    (p_proyecto,'General','Inducción a la Plataforma',           9, true,  'induccion'),
    (p_proyecto,'General','Explicación de la Plataforma',       10, false, 'induccion'),
    (p_proyecto,'General','Ingreso a la Plataforma',            11, false, 'induccion'),
    (p_proyecto,'General','Acceso desde Celular',               12, false, 'induccion'),
    (p_proyecto,'General','Acceso a Tutoriales',                13, false, 'induccion'),
    (p_proyecto,'General','Sistemas Implementados',             14, false, null),
    (p_proyecto,'General','Segunda Reunión de Explicación',     15, true,  'explicacion'),
    (p_proyecto,'General','Sistema de IA',                      16, false, 'explicacion'),
    (p_proyecto,'General','Sistema de Seguimiento',             17, false, 'explicacion'),
    (p_proyecto,'General','Sistema de Nutrición',               18, false, 'explicacion'),
    (p_proyecto,'General','Sistema de Agendamiento',            19, false, 'explicacion'),
    (p_proyecto,'General','Sistema Community + IA',             20, false, 'explicacion'),
    (p_proyecto,'General','Sistema Landing Pages',              21, false, 'explicacion'),
    (p_proyecto,'General','Sistema de Fidelización',            22, false, 'explicacion'),
    (p_proyecto,'General','Proyecto Entregado',                 23, false, null);
end $$;

-- ---------- Migrar un proyecto existente a la nueva estructura ----------
-- Preserva completado + atribución de las tareas que tienen equivalente
-- (por su 'orden' anterior). Insertar conserva la atribución original
-- (el trigger de sellado solo actúa en UPDATE).
create or replace function public.checklist_migrar_v2(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_old jsonb;
begin
  select jsonb_object_agg(orden::text, jsonb_build_object(
           'c', completado, 'p', completado_por,
           'n', completado_por_nombre, 'e', completado_en))
    into v_old
    from public.checklist_items where proyecto_id = p_proyecto;

  delete from public.checklist_items where proyecto_id = p_proyecto;

  -- t.src = 'orden' anterior del que hereda el estado (null = empieza vacío).
  insert into public.checklist_items
    (proyecto_id, categoria, titulo, orden, es_grupo, grupo,
     completado, completado_por, completado_por_nombre, completado_en)
  select p_proyecto, 'General', t.titulo, t.orden, t.es_grupo, t.grupo,
         coalesce(((v_old -> t.src) ->> 'c')::boolean, false),
         nullif((v_old -> t.src) ->> 'p','')::uuid,
         (v_old -> t.src) ->> 'n',
         nullif((v_old -> t.src) ->> 'e','')::timestamptz
  from (values
    ('Solicitud de Información',          1, false, null::text, '1'::text),
    ('Ingreso a la Comunidad',           2, false, null,       '2'),
    ('Primera Reunión de Configuración', 3, true,  'config',    null),
    ('Configuración de Facebook',        4, false, 'config',   '7'),
    ('Configuración de Instagram',       5, false, 'config',   '8'),
    ('Configuración de WhatsApp',        6, false, 'config',   '11'),
    ('Configuración del Dominio',        7, false, 'config',   '10'),
    ('Configuración de Google',          8, false, 'config',   '9'),
    ('Inducción a la Plataforma',        9, true,  'induccion', null),
    ('Explicación de la Plataforma',    10, false, 'induccion','3'),
    ('Ingreso a la Plataforma',         11, false, 'induccion','4'),
    ('Acceso desde Celular',            12, false, 'induccion','5'),
    ('Acceso a Tutoriales',             13, false, 'induccion','6'),
    ('Sistemas Implementados',          14, false, null,        null),
    ('Segunda Reunión de Explicación',  15, true,  'explicacion', null),
    ('Sistema de IA',                   16, false, 'explicacion', null),
    ('Sistema de Seguimiento',          17, false, 'explicacion', null),
    ('Sistema de Nutrición',            18, false, 'explicacion', null),
    ('Sistema de Agendamiento',         19, false, 'explicacion', null),
    ('Sistema Community + IA',          20, false, 'explicacion', null),
    ('Sistema Landing Pages',           21, false, 'explicacion', null),
    ('Sistema de Fidelización',         22, false, 'explicacion', null),
    ('Proyecto Entregado',              23, false, null,        null)
  ) as t(titulo, orden, es_grupo, grupo, src);

  -- Recalcular cabeceras de grupo por si el trigger no cubrió todo.
  update public.checklist_items g
     set completado = not exists (
       select 1 from public.checklist_items s
       where s.proyecto_id = g.proyecto_id and s.grupo = g.grupo
         and s.es_grupo = false and s.completado = false)
   where g.proyecto_id = p_proyecto and g.es_grupo = true;
end $$;

-- ---------- Ejecutar migración en TODOS los proyectos existentes ----------
do $$
declare r record;
begin
  for r in select id from public.proyectos loop
    perform public.checklist_migrar_v2(r.id);
  end loop;
end $$;

-- ---------- Vista pública: incluir jerarquía ----------
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
        'completadoEn', c.completado_en,
        'esGrupo',      c.es_grupo,
        'grupo',        c.grupo
      ) order by c.orden)
      from public.checklist_items c
      where c.proyecto_id = p.id
    ), '[]'::json)
  )
  from public.progreso_enlaces e
  join public.proyectos p on p.id = e.proyecto_id
  where e.token = p_token and e.activo;
$$;
