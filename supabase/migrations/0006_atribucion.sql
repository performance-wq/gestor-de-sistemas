-- =============================================================
-- Systems PEX — Atribución "Subido por X" (nombre denormalizado)
-- =============================================================
alter table public.proyectos
  add column if not exists actualizado_por_nombre text;
alter table public.puntos
  add column if not exists actualizado_por_nombre text;

-- El trigger BEFORE ahora también sella el nombre de quien edita.
create or replace function public.fn_set_actualizado()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.profiles where id = auth.uid();
  new.actualizado_por := auth.uid();
  new.actualizado_por_nombre := v_nombre;
  new.actualizado_en := now();
  return new;
end $$;
