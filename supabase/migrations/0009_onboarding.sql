-- =============================================================
-- Systems PEX — Módulo de Onboarding Inteligente
-- Cada proyecto tiene UN enlace único e irrepetible. El cliente
-- responde sin cuenta; el acceso está acotado a su propio token.
-- =============================================================

create table if not exists public.onboarding (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null unique references public.proyectos(id) on delete cascade,
  token        text not null unique,
  respuestas   jsonb not null default '{}'::jsonb,
  estado       text  not null default 'pendiente'
               check (estado in ('pendiente','completado')),
  enviado_en   timestamptz,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_onboarding_token on public.onboarding(token);

alter table public.onboarding enable row level security;

-- --- Acceso interno (usuarios de Systems PEX) -----------------
drop policy if exists onb_select on public.onboarding;
create policy onb_select on public.onboarding for select to authenticated
  using (public.has_project_access(proyecto_id));

drop policy if exists onb_insert on public.onboarding;
create policy onb_insert on public.onboarding for insert to authenticated
  with check (public.has_project_access(proyecto_id));

drop policy if exists onb_update on public.onboarding;
create policy onb_update on public.onboarding for update to authenticated
  using (public.has_project_access(proyecto_id))
  with check (public.has_project_access(proyecto_id));

drop policy if exists onb_delete on public.onboarding;
create policy onb_delete on public.onboarding for delete to authenticated
  using (public.is_admin());

-- --- Crear / obtener el enlace del proyecto (interno) ---------
-- Idempotente: si ya existe devuelve el mismo token (nunca se reutiliza
-- un token entre proyectos porque es único por fila).
create or replace function public.onboarding_asegurar(p_proyecto uuid)
returns public.onboarding
language plpgsql security invoker set search_path=public as $$
declare
  fila public.onboarding;
begin
  select * into fila from public.onboarding where proyecto_id = p_proyecto;
  if found then return fila; end if;

  insert into public.onboarding (proyecto_id, token)
  values (p_proyecto, replace(gen_random_uuid()::text, '-', ''))
  returning * into fila;
  return fila;
end $$;

grant execute on function public.onboarding_asegurar(uuid) to authenticated;

-- --- API pública para el cliente (sin cuenta) ------------------
-- Solo puede tocar la fila cuyo token conoce.

create or replace function public.onboarding_token_valido(p_token text)
returns boolean
language sql security definer set search_path=public stable as $$
  select exists (
    select 1 from public.onboarding
    where token = p_token and estado = 'pendiente'
  );
$$;

create or replace function public.onboarding_obtener(p_token text)
returns json
language sql security definer set search_path=public stable as $$
  select json_build_object(
    'proyecto',   p.nombre,
    'cliente',    p.cliente,
    'estado',     o.estado,
    'respuestas', o.respuestas,
    'enviadoEn',  o.enviado_en
  )
  from public.onboarding o
  join public.proyectos p on p.id = o.proyecto_id
  where o.token = p_token;
$$;

create or replace function public.onboarding_guardar(p_token text, p_respuestas jsonb)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.onboarding
     set respuestas = p_respuestas,
         actualizado_en = now()
   where token = p_token and estado = 'pendiente';
  return found;
end $$;

create or replace function public.onboarding_enviar(p_token text, p_respuestas jsonb)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.onboarding
     set respuestas = p_respuestas,
         estado = 'completado',
         enviado_en = now(),
         actualizado_en = now()
   where token = p_token and estado = 'pendiente';
  return found;
end $$;

grant execute on function public.onboarding_obtener(text)        to anon, authenticated;
grant execute on function public.onboarding_guardar(text, jsonb) to anon, authenticated;
grant execute on function public.onboarding_enviar(text, jsonb)  to anon, authenticated;
grant execute on function public.onboarding_token_valido(text)   to anon, authenticated;

-- --- Storage: subida directa del cliente ----------------------
-- Solo dentro de  onboarding/<token>/...  y solo si el token existe
-- y el formulario sigue abierto. Nada más del bucket queda expuesto.
drop policy if exists onboarding_subir_anon on storage.objects;
create policy onboarding_subir_anon on storage.objects for insert to anon
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'onboarding'
    and public.onboarding_token_valido((storage.foldername(name))[2])
  );

drop policy if exists onboarding_leer_anon on storage.objects;
create policy onboarding_leer_anon on storage.objects for select to anon
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'onboarding'
    and public.onboarding_token_valido((storage.foldername(name))[2])
  );

-- --- Auditoría: registrar el envío del onboarding --------------
create or replace function public.fn_auditar_onboarding()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.estado = 'completado' and old.estado is distinct from 'completado' then
    insert into public.auditoria(user_id, user_nombre, accion, entidad,
                                 entidad_id, proyecto_id, detalle)
    values (null, 'Cliente', 'editado', 'proyecto', new.proyecto_id,
            new.proyecto_id, 'Onboarding completado por el cliente');
  end if;
  return new;
end $$;

drop trigger if exists tg_auditar_onboarding on public.onboarding;
create trigger tg_auditar_onboarding after update on public.onboarding
  for each row execute function public.fn_auditar_onboarding();
