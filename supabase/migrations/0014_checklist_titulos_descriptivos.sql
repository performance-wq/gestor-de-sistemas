-- =============================================================
-- Systems PEX — Checklist: títulos descriptivos completos
--
-- Con 4 columnas hay más ancho, así que se restauran nombres más
-- descriptivos (el tooltip muestra el nombre completo y el texto se
-- trunca con "…" solo si no entra). Actualiza plantilla y filas
-- existentes por 'orden'. NO toca 'completado' ni la atribución.
-- =============================================================

create or replace function public.checklist_crear(p_proyecto uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.checklist_items where proyecto_id = p_proyecto) then
    return;
  end if;

  insert into public.checklist_items (proyecto_id, categoria, titulo, orden) values
    (p_proyecto, 'General', 'Formulario de solicitud de datos', 1),
    (p_proyecto, 'General', 'Agregar al cliente a la comunidad', 2),
    (p_proyecto, 'General', 'Video de explicación de la plataforma', 3),
    (p_proyecto, 'General', 'Video de ingreso a la plataforma', 4),
    (p_proyecto, 'General', 'Acceso desde el celular', 5),
    (p_proyecto, 'General', 'Acceso a los tutoriales', 6),
    (p_proyecto, 'General', 'Configurar Facebook', 7),
    (p_proyecto, 'General', 'Configurar Instagram', 8),
    (p_proyecto, 'General', 'Configurar Google', 9),
    (p_proyecto, 'General', 'Configurar Dominio', 10),
    (p_proyecto, 'General', 'Configurar WhatsApp', 11),
    (p_proyecto, 'General', 'Configurar Teléfono (opcional)', 12),
    (p_proyecto, 'General', 'Explicar la implementación realizada', 13),
    (p_proyecto, 'General', 'Explicar Conversaciones', 14),
    (p_proyecto, 'General', 'Explicar Oportunidades', 15),
    (p_proyecto, 'General', 'Explicar cómo apagar un flujo', 16),
    (p_proyecto, 'General', 'Explicar cómo enviar seguimientos', 17),
    (p_proyecto, 'General', 'Explicar cómo retroalimentar la IA', 18),
    (p_proyecto, 'General', 'Explicar cómo utilizar la Agenda', 19),
    (p_proyecto, 'General', 'Explicar cómo crear una cita', 20),
    (p_proyecto, 'General', 'Explicar cómo editar una automatización', 21),
    (p_proyecto, 'General', 'Explicar cómo editar una Landing Page', 22),
    (p_proyecto, 'General', 'Explicar cómo escanear el código QR', 23);
end $$;

update public.checklist_items ci
   set titulo = m.titulo
  from (values
    (1,'Formulario de solicitud de datos'),
    (2,'Agregar al cliente a la comunidad'),
    (3,'Video de explicación de la plataforma'),
    (4,'Video de ingreso a la plataforma'),
    (5,'Acceso desde el celular'),
    (6,'Acceso a los tutoriales'),
    (7,'Configurar Facebook'),
    (8,'Configurar Instagram'),
    (9,'Configurar Google'),
    (10,'Configurar Dominio'),
    (11,'Configurar WhatsApp'),
    (12,'Configurar Teléfono (opcional)'),
    (13,'Explicar la implementación realizada'),
    (14,'Explicar Conversaciones'),
    (15,'Explicar Oportunidades'),
    (16,'Explicar cómo apagar un flujo'),
    (17,'Explicar cómo enviar seguimientos'),
    (18,'Explicar cómo retroalimentar la IA'),
    (19,'Explicar cómo utilizar la Agenda'),
    (20,'Explicar cómo crear una cita'),
    (21,'Explicar cómo editar una automatización'),
    (22,'Explicar cómo editar una Landing Page'),
    (23,'Explicar cómo escanear el código QR')
  ) as m(orden, titulo)
 where ci.orden = m.orden;
