-- =============================================================
-- Systems PEX — Checklist v3 (recorrido del cliente, 21 nov 2026)
--
-- Cambios pedidos por Boyer:
--   1. "Solicitud de Información" pasa a grupo: Formulario del Empresario
--      + Preguntas del Mentor (hace visible el cuello de botella).
--   2. Se agrega "Configuración del Correo" a la primera reunión.
--   3. Los 7 sistemas pasan a "Sistemas Implementados" (el cliente ve
--      avance durante la implementación), en el orden oficial.
--   4. Nuevo paso "Sistemas Verificados" (control de calidad + IA probada).
--   5. "Segunda Reunión de Explicación" = Sesión realizada + Grabación enviada.
--   6. Nuevo paso "Ajustes Finales" antes de "Proyecto Entregado".
--
-- Migración de proyectos existentes: cada ítem nuevo hereda el estado
-- (y la atribución) del primer ítem anterior equivalente que esté
-- marcado. Si el proyecto ya estaba ENTREGADO, todo queda completo.
-- Idempotente: no toca proyectos que ya están en v3.
-- =============================================================

-- ---------- Estructura v3 (fuente única) ----------
-- src = títulos del checklist anterior de los que hereda el estado.
create or replace function public.checklist_v3_estructura()
returns table(titulo text, orden int, es_grupo boolean, grupo text, src text[])
language sql immutable as $$
  values
    ('Solicitud de Información',          1, true,  'info',        '{}'::text[]),
    ('Formulario del Empresario',         2, false, 'info',        '{"Solicitud de Información","Formulario del Empresario"}'),
    ('Preguntas del Mentor',              3, false, 'info',        '{"Solicitud de Información","Preguntas del Mentor"}'),
    ('Ingreso a la Comunidad',            4, false, null,          '{"Ingreso a la Comunidad"}'),
    ('Primera Reunión de Configuración',  5, true,  'config',      '{}'),
    ('Configuración de Facebook',         6, false, 'config',      '{"Configuración de Facebook"}'),
    ('Configuración de Instagram',        7, false, 'config',      '{"Configuración de Instagram"}'),
    ('Configuración de WhatsApp',         8, false, 'config',      '{"Configuración de WhatsApp"}'),
    ('Configuración del Correo',          9, false, 'config',      '{"Configuración del Correo","Primera Reunión de Configuración"}'),
    ('Configuración del Dominio',        10, false, 'config',      '{"Configuración del Dominio"}'),
    ('Configuración de Google',          11, false, 'config',      '{"Configuración de Google"}'),
    ('Inducción a la Plataforma',        12, true,  'induccion',   '{}'),
    ('Explicación de la Plataforma',     13, false, 'induccion',   '{"Explicación de la Plataforma"}'),
    ('Ingreso a la Plataforma',          14, false, 'induccion',   '{"Ingreso a la Plataforma"}'),
    ('Acceso desde Celular',             15, false, 'induccion',   '{"Acceso desde Celular"}'),
    ('Acceso a Tutoriales',              16, false, 'induccion',   '{"Acceso a Tutoriales"}'),
    ('Sistemas Implementados',           17, true,  'implementacion', '{}'),
    ('Sistema de Seguimiento',           18, false, 'implementacion', '{"Sistemas Implementados","Sistema de Seguimiento"}'),
    ('Sistema de Nutrición',             19, false, 'implementacion', '{"Sistemas Implementados","Sistema de Nutrición"}'),
    ('Sistema de Agendamiento',          20, false, 'implementacion', '{"Sistemas Implementados","Sistema de Agendamiento"}'),
    ('Sistema de IA',                    21, false, 'implementacion', '{"Sistemas Implementados","Sistema de IA"}'),
    ('Sistema de Fidelización',          22, false, 'implementacion', '{"Sistemas Implementados","Sistema de Fidelización"}'),
    ('Sistema Landing Pages',            23, false, 'implementacion', '{"Sistemas Implementados","Sistema Landing Pages"}'),
    ('Sistema Community + IA',           24, false, 'implementacion', '{"Sistemas Implementados","Sistema Community + IA"}'),
    ('Sistemas Verificados',             25, false, null,          '{"Sistemas Verificados","Segunda Reunión de Explicación"}'),
    ('Segunda Reunión de Explicación',   26, true,  'explicacion', '{}'),
    ('Sesión de Explicación Realizada',  27, false, 'explicacion', '{"Sesión de Explicación Realizada","Segunda Reunión de Explicación"}'),
    ('Grabación de la Sesión Enviada',   28, false, 'explicacion', '{"Grabación de la Sesión Enviada"}'),
    ('Ajustes Finales',                  29, false, null,          '{"Ajustes Finales"}'),
    ('Proyecto Entregado',               30, false, null,          '{"Proyecto Entregado"}')
$$;

-- ---------- Plantilla para proyectos NUEVOS ----------
create or replace function public.checklist_crear(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.checklist_items where proyecto_id = p_proyecto) then
    return;
  end if;
  insert into public.checklist_items (proyecto_id, categoria, titulo, orden, es_grupo, grupo)
  select p_proyecto, 'General', e.titulo, e.orden, e.es_grupo, e.grupo
  from public.checklist_v3_estructura() e;
end $$;

-- ---------- Migrar un proyecto existente ----------
create or replace function public.checklist_migrar_v3(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_old jsonb;
  v_ent boolean;
begin
  -- Ya migrado → no hacer nada.
  if exists (select 1 from public.checklist_items
             where proyecto_id = p_proyecto and titulo = 'Formulario del Empresario') then
    return;
  end if;
  -- Sin checklist → crear limpio.
  if not exists (select 1 from public.checklist_items where proyecto_id = p_proyecto) then
    perform public.checklist_crear(p_proyecto);
    return;
  end if;

  select jsonb_object_agg(titulo, jsonb_build_object(
           'c', completado, 'p', completado_por,
           'n', completado_por_nombre, 'e', completado_en))
    into v_old
    from public.checklist_items where proyecto_id = p_proyecto;

  v_ent := coalesce(((v_old -> 'Proyecto Entregado') ->> 'c')::boolean, false);

  delete from public.checklist_items where proyecto_id = p_proyecto;

  insert into public.checklist_items
    (proyecto_id, categoria, titulo, orden, es_grupo, grupo,
     completado, completado_por, completado_por_nombre, completado_en)
  select p_proyecto, 'General', e.titulo, e.orden, e.es_grupo, e.grupo,
         (not e.es_grupo) and (x.o is not null or v_ent),
         case when e.es_grupo then null else nullif(x.o ->> 'p','')::uuid end,
         case when e.es_grupo then null else x.o ->> 'n' end,
         case when e.es_grupo then null else nullif(x.o ->> 'e','')::timestamptz end
  from public.checklist_v3_estructura() e
  left join lateral (
    select v_old -> s as o
    from unnest(e.src) with ordinality as u(s, k)
    where coalesce(((v_old -> s) ->> 'c')::boolean, false)
    order by k
    limit 1
  ) x on true;

  -- Cabeceras de grupo = roll-up de sus subtareas.
  update public.checklist_items g
     set completado = not exists (
       select 1 from public.checklist_items s
       where s.proyecto_id = g.proyecto_id and s.grupo = g.grupo
         and s.es_grupo = false and s.completado = false)
   where g.proyecto_id = p_proyecto and g.es_grupo = true;
end $$;

-- ---------- Ejecutar en TODOS los proyectos existentes ----------
do $$
declare r record;
begin
  for r in select id from public.proyectos loop
    perform public.checklist_migrar_v3(r.id);
  end loop;
end $$;
