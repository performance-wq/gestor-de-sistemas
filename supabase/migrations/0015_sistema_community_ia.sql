-- =============================================================
-- Systems PEX — Séptimo sistema: "Community + IA"
--
-- Documenta la comunicación del Community Manager apoyada por IA.
-- Se agrega AUTOMÁTICAMENTE a todos los proyectos (existentes y
-- nuevos) sin tocar datos previos ni el resto de la app.
--
-- Enfoque DESACOPLADO (igual que el checklist): una función
-- idempotente + trigger AFTER INSERT en proyectos + backfill. NO se
-- modifica la RPC crear_proyecto. Para agregar más sistemas por
-- defecto en el futuro basta con replicar este patrón.
-- =============================================================

create or replace function public.sistema_community_ia_crear(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_sistema_id uuid;
  v_orden      int;
begin
  -- Idempotente: si el proyecto ya tiene el sistema, no hace nada.
  if exists (
    select 1 from public.sistemas
    where proyecto_id = p_proyecto and nombre = 'Community + IA'
  ) then
    return;
  end if;

  -- Se coloca al final (después del último sistema del proyecto).
  select coalesce(max(orden), 0) + 1 into v_orden
    from public.sistemas where proyecto_id = p_proyecto;

  insert into public.sistemas (proyecto_id, nombre, orden)
    values (p_proyecto, 'Community + IA', v_orden)
    returning id into v_sistema_id;

  -- Dos puntos de contacto iniciales, orientados a texto (copy).
  -- La tabla puntos ya soporta imagen/video/url si en el futuro se
  -- cambia el tipo a 'estandar' o 'landing'.
  insert into public.puntos (sistema_id, nombre, fijo, orden, tipo) values
    (v_sistema_id, 'Respuestas de Comentarios', true, 1, 'texto'),
    (v_sistema_id, 'Mensajes Internos (DM)',    true, 2, 'texto');
end $$;

grant execute on function public.sistema_community_ia_crear(uuid) to authenticated;

-- Auto-agregar el sistema al crear un proyecto (además de los 6 de la RPC).
create or replace function public.fn_sistema_community_nuevo()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.sistema_community_ia_crear(new.id);
  return new;
end $$;

drop trigger if exists trg_sistema_community_nuevo on public.proyectos;
create trigger trg_sistema_community_nuevo
  after insert on public.proyectos
  for each row execute function public.fn_sistema_community_nuevo();

-- Backfill: agregarlo a todos los proyectos existentes.
do $$
declare r record;
begin
  for r in select id from public.proyectos loop
    perform public.sistema_community_ia_crear(r.id);
  end loop;
end $$;
