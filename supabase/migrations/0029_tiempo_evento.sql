-- =============================================================
-- System PEX — Cronómetro por tarea (registro de tiempo)
--
-- RPC que registra un evento de tiempo (inicio/pausa/reanudacion/fin)
-- en task_time_logs validando la transición, para que el estado del
-- cronómetro sea consistente aunque la UI esté desfasada. Cada quien
-- registra SU propio tiempo. La tabla task_time_logs ya existe (0028).
-- ADITIVO.
-- =============================================================

create or replace function public.tiempo_evento(p_task_id uuid, p_evento text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_last text;
begin
  if v_uid is null then
    raise exception 'No autenticado.';
  end if;
  if p_evento not in ('inicio','pausa','reanudacion','fin') then
    raise exception 'Evento inválido.';
  end if;
  -- Debe poder ver la tarea (responsable, creador o gestor).
  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (public.puede_ver_todo()
           or t.responsable_id = v_uid
           or t.creado_por = v_uid)
  ) then
    raise exception 'Sin acceso a esa tarea.';
  end if;

  select evento into v_last
    from public.task_time_logs
   where task_id = p_task_id and user_id = v_uid
   order by created_at desc
   limit 1;

  if p_evento = 'inicio' then
    if v_last in ('inicio','reanudacion') then
      raise exception 'El cronómetro ya está en curso.';
    end if;
  elsif p_evento = 'reanudacion' then
    if v_last is distinct from 'pausa' then
      raise exception 'Solo puedes reanudar desde una pausa.';
    end if;
  elsif p_evento = 'pausa' then
    if v_last is distinct from 'inicio' and v_last is distinct from 'reanudacion' then
      raise exception 'Solo puedes pausar cuando está en curso.';
    end if;
  elsif p_evento = 'fin' then
    if v_last is null or v_last = 'fin' then
      raise exception 'No hay una sesión abierta para finalizar.';
    end if;
  end if;

  insert into public.task_time_logs (task_id, user_id, evento)
  values (p_task_id, v_uid, p_evento);
end;
$$;

grant execute on function public.tiempo_evento(uuid, text) to authenticated;
