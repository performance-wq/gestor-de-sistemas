-- =============================================================
-- Systems PEX — Checklist de Gestión del Proyecto
--
-- Módulo interno independiente (NO onboarding, NO sistemas, NO
-- performance). Cada proyecto tiene SU propio checklist, generado
-- automáticamente al crearse a partir de una plantilla. La estructura
-- es dinámica: agregar/quitar/reordenar/renombrar = filas de esta tabla.
-- =============================================================

create table if not exists public.checklist_items (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references public.proyectos(id) on delete cascade,
  categoria             text not null,
  titulo                text not null,
  orden                 int  not null default 0,
  completado            boolean not null default false,
  completado_por        uuid references public.profiles(id) on delete set null,
  completado_por_nombre text,
  completado_en         timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_checklist_proyecto
  on public.checklist_items(proyecto_id, orden);

alter table public.checklist_items enable row level security;

-- Mismo modelo de acceso que sistemas/puntos: quien tiene acceso al
-- proyecto puede ver y gestionar su checklist.
drop policy if exists checklist_all on public.checklist_items;
create policy checklist_all on public.checklist_items for all to authenticated
  using (public.has_project_access(proyecto_id))
  with check (public.has_project_access(proyecto_id));

-- -------------------------------------------------------------
-- Sella quién/cuándo completó cada paso (atribución automática).
-- -------------------------------------------------------------
create or replace function public.fn_checklist_stamp()
returns trigger language plpgsql security definer set search_path=public as $$
begin
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

drop trigger if exists trg_checklist_stamp on public.checklist_items;
create trigger trg_checklist_stamp
  before update on public.checklist_items
  for each row execute function public.fn_checklist_stamp();

-- -------------------------------------------------------------
-- Plantilla: genera el checklist de un proyecto (idempotente).
-- Editar aquí = cambiar la plantilla de los PRÓXIMOS proyectos.
-- -------------------------------------------------------------
create or replace function public.checklist_crear(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.checklist_items where proyecto_id = p_proyecto) then
    return; -- ya tiene checklist
  end if;

  insert into public.checklist_items (proyecto_id, categoria, titulo, orden) values
    (p_proyecto, 'Solicitud de Información', 'Formulario de solicitud de datos enviado', 1),
    (p_proyecto, 'Comunidad', 'Agregar al cliente a la comunidad', 2),
    (p_proyecto, 'Capacitación Inicial', 'Video de explicación de la plataforma', 3),
    (p_proyecto, 'Capacitación Inicial', 'Video de ingreso a la plataforma', 4),
    (p_proyecto, 'Capacitación Inicial', 'Cómo acceder desde el celular', 5),
    (p_proyecto, 'Capacitación Inicial', 'Cómo acceder a los tutoriales', 6),
    (p_proyecto, 'Configuración de Cuentas', 'Facebook', 7),
    (p_proyecto, 'Configuración de Cuentas', 'Instagram', 8),
    (p_proyecto, 'Configuración de Cuentas', 'Google', 9),
    (p_proyecto, 'Configuración de Cuentas', 'Dominio', 10),
    (p_proyecto, 'Configuración de Cuentas', 'WhatsApp', 11),
    (p_proyecto, 'Configuración de Cuentas', 'Teléfono (opcional)', 12),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Explicación general de lo que se implementó', 13),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo funcionan las conversaciones', 14),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo funcionan las oportunidades', 15),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo apagar un flujo', 16),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo enviar seguimientos', 17),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo retroalimentar la IA', 18),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo utilizar la agenda', 19),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo crear una cita', 20),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo editar una automatización', 21),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo editar una Landing Page', 22),
    (p_proyecto, 'Después de Implementar los Sistemas', 'Cómo escanear el código QR', 23);
end $$;

grant execute on function public.checklist_crear(uuid) to authenticated;

-- -------------------------------------------------------------
-- Auto-generar el checklist al crear un proyecto.
-- (Trigger desacoplado: no toca la RPC crear_proyecto.)
-- -------------------------------------------------------------
create or replace function public.fn_checklist_nuevo_proyecto()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.checklist_crear(new.id);
  return new;
end $$;

drop trigger if exists trg_checklist_nuevo on public.proyectos;
create trigger trg_checklist_nuevo
  after insert on public.proyectos
  for each row execute function public.fn_checklist_nuevo_proyecto();

-- -------------------------------------------------------------
-- Backfill: generar el checklist para los proyectos existentes.
-- -------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from public.proyectos loop
    perform public.checklist_crear(r.id);
  end loop;
end $$;
