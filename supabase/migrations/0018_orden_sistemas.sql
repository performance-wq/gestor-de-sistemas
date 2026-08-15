-- =============================================================
-- Systems PEX — Orden oficial de los sistemas (Fase 2)
--
-- SOLO cambia el campo 'orden' de public.sistemas. No toca puntos,
-- copies, archivos, estados, %, ni ningún otro dato. El front ya
-- ordena los sistemas por 'orden' (store.mapProyecto), así que basta
-- con fijar el orden en la BD.
--
-- Orden oficial:
--   1 Seguimiento · 2 Nutrición · 3 Agendamiento · 4 Inteligencia
--   5 Fidelización · 6 Landing Page · 7 Community + IA
-- Los sistemas personalizados (cualquier otro nombre) se numeran a
-- continuación (8, 9, …) conservando su orden relativo actual.
-- =============================================================

-- No auditar este reordenamiento masivo (evita ruido en Actividad).
alter table public.sistemas disable trigger trg_auditar_sistemas;

with ranked as (
  select
    id,
    row_number() over (
      partition by proyecto_id
      order by
        case nombre
          when 'Seguimiento'    then 1
          when 'Nutrición'      then 2
          when 'Agendamiento'   then 3
          when 'Inteligencia'   then 4
          when 'Fidelización'   then 5
          when 'Landing Page'   then 6
          when 'Community + IA' then 7
          else 100
        end,
        orden, created_at, id
    ) as nuevo
  from public.sistemas
)
update public.sistemas s
   set orden = r.nuevo
  from ranked r
 where s.id = r.id
   and s.orden is distinct from r.nuevo;

alter table public.sistemas enable trigger trg_auditar_sistemas;

-- -------------------------------------------------------------
-- Plantilla de proyectos NUEVOS: mismo orden oficial.
-- (Idéntica a la anterior salvo el 'orden' de Inteligencia=4 y
--  Fidelización=5. Community + IA lo agrega su trigger como 7.)
-- -------------------------------------------------------------
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

  -- 4. Inteligencia (solo texto): Base de Conocimiento + Prompt (3 secciones)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Inteligencia', 4) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo) values
    (v_sistema_id, 'Base de Conocimiento',          true, 1, 'texto'),
    (v_sistema_id, 'Prompt · Personalidad',         true, 2, 'texto'),
    (v_sistema_id, 'Prompt · Objetivos',            true, 3, 'texto'),
    (v_sistema_id, 'Prompt · Información Adicional', true, 4, 'texto');

  -- 5. Fidelización (2 puntos fijos, estandar, con programación)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Fidelización', 5) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo, programacion) values
    (v_sistema_id, 'Review / Testimonio', true, 1, 'estandar', 'Después de 1 día'),
    (v_sistema_id, 'Programa de Lealtad', true, 2, 'estandar', 'Después de 3 días');

  -- 6. Landing Page (copy + url)
  insert into public.sistemas (proyecto_id, nombre, orden)
    values (v_proyecto_id, 'Landing Page', 6) returning id into v_sistema_id;
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo)
    values (v_sistema_id, 'Landing', true, 1, 'landing');

  return v_proyecto_id;
end;
$$;
