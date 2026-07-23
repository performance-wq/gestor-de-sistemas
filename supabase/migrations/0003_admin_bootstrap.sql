-- =============================================================
-- Bootstrap de admin: el PRIMER usuario registrado nace como 'admin'
-- (Boyer). Los siguientes nacen como 'subcuenta' y el admin los gestiona.
-- =============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
begin
  select case
           when exists (select 1 from public.profiles where rol = 'admin')
             then 'subcuenta'
           else 'admin'
         end
    into v_rol;

  insert into public.profiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    v_rol
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
