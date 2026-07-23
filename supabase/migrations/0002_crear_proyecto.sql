-- =============================================================
-- RPC: crear_proyecto — crea un proyecto y auto-carga la plantilla
-- (6 sistemas con sus puntos, según plantilla_config).
-- SECURITY INVOKER: corre como el usuario, sujeto a RLS.
-- =============================================================
create or replace function public.crear_proyecto(
  p_nombre              text,
  p_estado              estado_proyecto default 'Pendiente',
  p_fecha_incorporacion date default null
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

  insert into public.proyectos (nombre, estado, fecha_incorporacion, creado_por)
  values (p_nombre, p_estado, p_fecha_incorporacion, auth.uid())
  returning id into v_proyecto_id;

  -- 1. Seguimiento
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Seguimiento', 1) returning id into v_sistema_id;
  for i in 1..v_cfg.seguimiento loop
    insert into public.puntos (sistema_id, nombre, orden)
      values (v_sistema_id, 'Punto ' || i, i);
  end loop;

  -- 2. Nutrición
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Nutrición', 2) returning id into v_sistema_id;
  for i in 1..v_cfg.nutricion loop
    insert into public.puntos (sistema_id, nombre, orden)
      values (v_sistema_id, 'Punto ' || i, i);
  end loop;

  -- 3. Agendamiento (4 puntos fijos)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Agendamiento', 3) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden) values
    (v_sistema_id, '24h antes',          true, 1),
    (v_sistema_id, '3h antes',           true, 2),
    (v_sistema_id, '30min antes',        true, 3),
    (v_sistema_id, 'En la cita/reserva', true, 4);

  -- 4. Fidelización
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Fidelización', 4) returning id into v_sistema_id;
  for i in 1..v_cfg.fidelizacion loop
    insert into public.puntos (sistema_id, nombre, orden)
      values (v_sistema_id, 'Punto ' || i, i);
  end loop;

  -- 5. Inteligencia (prompts)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Inteligencia (prompts)', 5) returning id into v_sistema_id;
  for i in 1..v_cfg.inteligencia loop
    insert into public.puntos (sistema_id, nombre, orden)
      values (v_sistema_id, 'Punto ' || i, i);
  end loop;

  -- 6. Landing Page
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Landing Page', 6) returning id into v_sistema_id;
  for i in 1..v_cfg.landing loop
    insert into public.puntos (sistema_id, nombre, orden)
      values (v_sistema_id, 'Bloque ' || i, i);
  end loop;

  return v_proyecto_id;
end;
$$;
