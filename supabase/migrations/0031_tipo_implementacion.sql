-- =============================================================
-- System PEX — Nuevo tipo de tarea: "implementacion"
--
-- Cambio PUNTUAL y ADITIVO: solo amplia el catalogo de tipos de
-- tarea con 'implementacion'. No toca permisos, estados, asignaciones,
-- cronometro, notificaciones, flujo de revision ni las tareas existentes
-- (conservan su tipo). El unico control a nivel de BD del tipo es este
-- check; ninguna RPC valida el tipo contra una lista fija.
-- =============================================================

alter table public.tasks drop constraint if exists tasks_tipo_check;
alter table public.tasks
  add constraint tasks_tipo_check
  check (tipo in ('soporte','incidencia','ajuste','solicitud','observacion','implementacion'));
