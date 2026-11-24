-- =============================================================
-- Systems PEX — Control de calidad: verificación irreversible
--
-- Una vez verificado un punto (ok = true), solo el propietario
-- (rol admin) puede revertirlo o borrarlo. La implementadora y la
-- supervisora ya no pueden desmarcarlo.
-- =============================================================

create or replace function public.fn_control_calidad_bloqueo()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.is_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and old.ok then
    raise exception 'Solo el propietario puede revertir una verificación.';
  end if;
  if tg_op = 'UPDATE' and old.ok and not new.ok then
    raise exception 'Solo el propietario puede revertir una verificación.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_control_calidad_bloqueo on public.control_calidad;
create trigger trg_control_calidad_bloqueo
  before update or delete on public.control_calidad
  for each row execute function public.fn_control_calidad_bloqueo();
