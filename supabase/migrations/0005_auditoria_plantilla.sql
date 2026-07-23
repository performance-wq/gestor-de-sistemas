-- =============================================================
-- Systems PEX — Auditoría (triggers) y plantilla nueva
-- =============================================================

-- ---------- BEFORE: sellar actualizado_por/_en ----------
create or replace function public.fn_set_actualizado()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en  := now();
  return new;
end $$;

drop trigger if exists trg_set_actualizado_proyectos on public.proyectos;
create trigger trg_set_actualizado_proyectos
  before insert or update on public.proyectos
  for each row execute function public.fn_set_actualizado();

drop trigger if exists trg_set_actualizado_puntos on public.puntos;
create trigger trg_set_actualizado_puntos
  before insert or update on public.puntos
  for each row execute function public.fn_set_actualizado();

-- ---------- AFTER: registrar en auditoría ----------
create or replace function public.fn_auditar()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_nombre text;
  v_accion text;
  v_entidad text;
  v_proyecto_id uuid;
  v_detalle text;
  rec record;
begin
  v_accion := case tg_op when 'INSERT' then 'creado'
                         when 'UPDATE' then 'editado'
                         when 'DELETE' then 'eliminado' end;
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;

  v_entidad := case tg_table_name when 'proyectos' then 'proyecto'
                                  when 'sistemas'  then 'sistema'
                                  when 'puntos'    then 'punto' end;

  if tg_table_name = 'proyectos' then
    v_proyecto_id := rec.id;  v_detalle := rec.nombre;
  elsif tg_table_name = 'sistemas' then
    v_proyecto_id := rec.proyecto_id;  v_detalle := rec.nombre;
  else
    select s.proyecto_id into v_proyecto_id from public.sistemas s where s.id = rec.sistema_id;
    v_detalle := rec.nombre;
    if tg_op = 'UPDATE' then
      if new.imagen is distinct from old.imagen and new.imagen is not null then
        v_detalle := rec.nombre || ' · imagen subida';
      elsif new.video is distinct from old.video and new.video is not null then
        v_detalle := rec.nombre || ' · video agregado';
      elsif new.url is distinct from old.url and new.url is not null then
        v_detalle := rec.nombre || ' · landing actualizada';
      elsif new.copy is distinct from old.copy then
        v_detalle := rec.nombre || ' · copy actualizado';
      end if;
    end if;
  end if;

  select nombre into v_nombre from public.profiles where id = v_uid;

  insert into public.auditoria(user_id, user_nombre, accion, entidad, entidad_id, proyecto_id, detalle)
  values (v_uid, coalesce(v_nombre, 'Sistema'), v_accion, v_entidad, rec.id, v_proyecto_id, v_detalle);

  return rec;
end $$;

-- Proyectos: alta, edición y borrado. Sistemas/puntos: edición y borrado
-- (las altas masivas de la plantilla no se auditan para no generar ruido).
drop trigger if exists trg_auditar_proyectos on public.proyectos;
create trigger trg_auditar_proyectos
  after insert or update or delete on public.proyectos
  for each row execute function public.fn_auditar();

drop trigger if exists trg_auditar_sistemas on public.sistemas;
create trigger trg_auditar_sistemas
  after update or delete on public.sistemas
  for each row execute function public.fn_auditar();

drop trigger if exists trg_auditar_puntos on public.puntos;
create trigger trg_auditar_puntos
  after update or delete on public.puntos
  for each row execute function public.fn_auditar();

-- =============================================================
-- crear_proyecto: nueva estructura de plantilla
-- =============================================================
drop function if exists public.crear_proyecto(text, estado_proyecto, date);

create or replace function public.crear_proyecto(
  p_nombre              text,
  p_estado              text default 'Pendiente',
  p_fecha_incorporacion date default null,
  p_cliente             text default null,
  p_nicho               text default null,
  p_palabras_clave      text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proyecto_id uuid;
  v_sistema_id  uuid;
  v_cfg         public.plantilla_config;
  i             int;
begin
  select * into v_cfg from public.plantilla_config where id = true;

  insert into public.proyectos (nombre, estado, fecha_incorporacion, cliente, nicho, palabras_clave, creado_por)
  values (p_nombre, p_estado, p_fecha_incorporacion, p_cliente, p_nicho, p_palabras_clave, auth.uid())
  returning id into v_proyecto_id;

  -- 1. Seguimiento (estandar)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Seguimiento', 1) returning id into v_sistema_id;
  for i in 1..v_cfg.seguimiento loop
    insert into public.puntos (sistema_id, nombre, orden, tipo)
      values (v_sistema_id, 'Punto ' || i, i, 'estandar');
  end loop;

  -- 2. Nutrición (estandar)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Nutrición', 2) returning id into v_sistema_id;
  for i in 1..v_cfg.nutricion loop
    insert into public.puntos (sistema_id, nombre, orden, tipo)
      values (v_sistema_id, 'Punto ' || i, i, 'estandar');
  end loop;

  -- 3. Agendamiento (4 fijos, estandar)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Agendamiento', 3) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo) values
    (v_sistema_id, '24h antes',          true, 1, 'estandar'),
    (v_sistema_id, '3h antes',           true, 2, 'estandar'),
    (v_sistema_id, '30min antes',        true, 3, 'estandar'),
    (v_sistema_id, 'En la cita/reserva', true, 4, 'estandar');

  -- 4. Fidelización (2 puntos fijos, estandar, con programación)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Fidelización', 4) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo, programacion) values
    (v_sistema_id, 'Review / Testimonio', true, 1, 'estandar', 'Después de 1 día'),
    (v_sistema_id, 'Programa de Lealtad', true, 2, 'estandar', 'Después de 3 días');

  -- 5. Inteligencia (solo texto): Base de Conocimiento + Prompt (3 secciones)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Inteligencia', 5) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo) values
    (v_sistema_id, 'Base de Conocimiento',          true, 1, 'texto'),
    (v_sistema_id, 'Prompt · Personalidad',         true, 2, 'texto'),
    (v_sistema_id, 'Prompt · Objetivos',            true, 3, 'texto'),
    (v_sistema_id, 'Prompt · Información Adicional', true, 4, 'texto');

  -- 6. Landing Page (copy + url)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Landing Page', 6) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo)
    values (v_sistema_id, 'Landing', true, 1, 'landing');

  return v_proyecto_id;
end;
$$;
