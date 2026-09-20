-- =============================================================
-- System PEX — Ajuste de inmutabilidad del historial (Fase 3, fix)
--
-- La versión inicial (0022) prohibía UPDATE *y* DELETE en task_history.
-- Eso rompía los borrados en cascada legítimos: al eliminar un proyecto
-- (solo admin) o una tarea, el cascade intenta borrar su task_history y
-- el trigger lo abortaba con "El historial es inmutable".
--
-- El historial ya está protegido contra borrado directo por RLS (no hay
-- policy de DELETE para 'authenticated'). La inmutabilidad que importa es
-- que NADIE pueda EDITAR una entrada para falsear el registro. Por eso el
-- trigger pasa a cubrir solo UPDATE; el DELETE queda permitido para que el
-- cascade de la tarea/proyecto padre funcione.
-- =============================================================

create or replace function public.task_history_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial es inmutable: una entrada no puede modificarse.';
end;
$$;

drop trigger if exists trg_task_history_noupd on public.task_history;
create trigger trg_task_history_noupd
  before update on public.task_history
  for each row execute function public.task_history_inmutable();
