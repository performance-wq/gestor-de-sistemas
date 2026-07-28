-- =============================================================
-- Systems PEX — Checklist: títulos compactos (solo texto)
--
-- Acorta los títulos para que cada tarea quepa en una sola línea.
-- Actualiza la plantilla (próximos proyectos) y las filas existentes
-- por 'orden'. NO toca 'completado' ni la atribución (el trigger
-- fn_checklist_stamp solo actúa cuando cambia 'completado').
-- =============================================================

create or replace function public.checklist_crear(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.checklist_items where proyecto_id = p_proyecto) then
    return;
  end if;

  insert into public.checklist_items (proyecto_id, categoria, titulo, orden) values
    (p_proyecto, 'General', 'Formulario de solicitud de datos', 1),
    (p_proyecto, 'General', 'Agregar a la comunidad', 2),
    (p_proyecto, 'General', 'Explicación plataforma', 3),
    (p_proyecto, 'General', 'Ingreso a la plataforma', 4),
    (p_proyecto, 'General', 'Acceso desde celular', 5),
    (p_proyecto, 'General', 'Acceso a tutoriales', 6),
    (p_proyecto, 'General', 'Configurar Facebook', 7),
    (p_proyecto, 'General', 'Configurar Instagram', 8),
    (p_proyecto, 'General', 'Configurar Google', 9),
    (p_proyecto, 'General', 'Configurar Dominio', 10),
    (p_proyecto, 'General', 'Configurar WhatsApp', 11),
    (p_proyecto, 'General', 'Configurar Teléfono (opcional)', 12),
    (p_proyecto, 'General', 'Explicar implementación', 13),
    (p_proyecto, 'General', 'Explicar Conversaciones', 14),
    (p_proyecto, 'General', 'Explicar Oportunidades', 15),
    (p_proyecto, 'General', 'Apagar un flujo', 16),
    (p_proyecto, 'General', 'Enviar seguimientos', 17),
    (p_proyecto, 'General', 'Retroalimentar IA', 18),
    (p_proyecto, 'General', 'Usar la Agenda', 19),
    (p_proyecto, 'General', 'Crear una cita', 20),
    (p_proyecto, 'General', 'Editar automatización', 21),
    (p_proyecto, 'General', 'Editar Landing', 22),
    (p_proyecto, 'General', 'Escanear código QR', 23);
end $$;

-- Actualizar las filas ya existentes (todos los proyectos) por 'orden'.
update public.checklist_items ci
   set titulo = m.titulo, categoria = 'General'
  from (values
    (1,'Formulario de solicitud de datos'),
    (2,'Agregar a la comunidad'),
    (3,'Explicación plataforma'),
    (4,'Ingreso a la plataforma'),
    (5,'Acceso desde celular'),
    (6,'Acceso a tutoriales'),
    (7,'Configurar Facebook'),
    (8,'Configurar Instagram'),
    (9,'Configurar Google'),
    (10,'Configurar Dominio'),
    (11,'Configurar WhatsApp'),
    (12,'Configurar Teléfono (opcional)'),
    (13,'Explicar implementación'),
    (14,'Explicar Conversaciones'),
    (15,'Explicar Oportunidades'),
    (16,'Apagar un flujo'),
    (17,'Enviar seguimientos'),
    (18,'Retroalimentar IA'),
    (19,'Usar la Agenda'),
    (20,'Crear una cita'),
    (21,'Editar automatización'),
    (22,'Editar Landing'),
    (23,'Escanear código QR')
  ) as m(orden, titulo)
 where ci.orden = m.orden;
