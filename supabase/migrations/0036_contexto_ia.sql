-- =============================================================
-- Systems PEX — Módulo "Contexto IA"
--
-- Por cada SERVICIO del cliente se genera un enlace único. El cliente
-- (sin cuenta) responde una conversación simulada: el "cliente final"
-- pregunta y el negocio responde como lo haría por WhatsApp, con texto,
-- fotos y videos. Sirve para alinear la IA de GoHighLevel.
--
-- turnos = [{ "cliente": text, "negocio": text,
--             "archivos": [{path,nombre,tipo}], "extra": bool }]
-- ADITIVO: tabla nueva + RPCs públicos acotados al token + políticas de
-- Storage solo bajo  contexto/<token>/...  del bucket privado 'assets'.
-- =============================================================

create table if not exists public.contexto_servicios (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  categoria      text not null default '',
  nombre         text not null,
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  turnos         jsonb not null default '[]'::jsonb,
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','completado')),
  orden          int not null default 0,
  enviado_en     timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_contexto_proyecto on public.contexto_servicios(proyecto_id);
create index if not exists idx_contexto_token on public.contexto_servicios(token);

alter table public.contexto_servicios enable row level security;

-- --- Acceso interno (equipo Systems PEX) ----------------------
drop policy if exists ctx_select on public.contexto_servicios;
create policy ctx_select on public.contexto_servicios for select to authenticated
  using (public.has_project_access(proyecto_id));

drop policy if exists ctx_insert on public.contexto_servicios;
create policy ctx_insert on public.contexto_servicios for insert to authenticated
  with check (public.has_project_access(proyecto_id));

drop policy if exists ctx_update on public.contexto_servicios;
create policy ctx_update on public.contexto_servicios for update to authenticated
  using (public.has_project_access(proyecto_id))
  with check (public.has_project_access(proyecto_id));

drop policy if exists ctx_delete on public.contexto_servicios;
create policy ctx_delete on public.contexto_servicios for delete to authenticated
  using (public.has_project_access(proyecto_id));

-- Igual que el resto de la app (0027): todo usuario activo puede VER.
drop policy if exists ctx_ver_todos on public.contexto_servicios;
create policy ctx_ver_todos on public.contexto_servicios for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- --- API pública (cliente sin cuenta, solo con su token) -------
create or replace function public.contexto_token_valido(p_token text)
returns boolean
language sql security definer set search_path=public stable as $$
  select exists (select 1 from public.contexto_servicios
                  where token = p_token and estado = 'pendiente');
$$;

create or replace function public.contexto_obtener(p_token text)
returns json
language sql security definer set search_path=public stable as $$
  select json_build_object(
    'proyecto',  p.nombre,
    'cliente',   p.cliente,
    'categoria', c.categoria,
    'servicio',  c.nombre,
    'estado',    c.estado,
    'turnos',    c.turnos,
    'enviadoEn', c.enviado_en
  )
  from public.contexto_servicios c
  join public.proyectos p on p.id = c.proyecto_id
  where c.token = p_token;
$$;

create or replace function public.contexto_guardar(p_token text, p_turnos jsonb)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if jsonb_typeof(p_turnos) <> 'array' then return false; end if;
  update public.contexto_servicios
     set turnos = p_turnos, actualizado_en = now()
   where token = p_token and estado = 'pendiente';
  return found;
end $$;

create or replace function public.contexto_enviar(p_token text, p_turnos jsonb)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if jsonb_typeof(p_turnos) <> 'array' then return false; end if;
  update public.contexto_servicios
     set turnos = p_turnos, estado = 'completado',
         enviado_en = now(), actualizado_en = now()
   where token = p_token and estado = 'pendiente';
  return found;
end $$;

grant execute on function public.contexto_token_valido(text)      to anon, authenticated;
grant execute on function public.contexto_obtener(text)           to anon, authenticated;
grant execute on function public.contexto_guardar(text, jsonb)    to anon, authenticated;
grant execute on function public.contexto_enviar(text, jsonb)     to anon, authenticated;

-- --- Storage: fotos/videos del cliente ------------------------
drop policy if exists contexto_subir_anon on storage.objects;
create policy contexto_subir_anon on storage.objects for insert to anon
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'contexto'
    and public.contexto_token_valido((storage.foldername(name))[2])
  );

drop policy if exists contexto_leer_anon on storage.objects;
create policy contexto_leer_anon on storage.objects for select to anon
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'contexto'
    and public.contexto_token_valido((storage.foldername(name))[2])
  );

-- --- Auditoría: conversación enviada por el cliente ------------
create or replace function public.fn_auditar_contexto()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.estado = 'completado' and old.estado is distinct from 'completado' then
    insert into public.auditoria(user_id, user_nombre, accion, entidad,
                                 entidad_id, proyecto_id, detalle)
    values (null, 'Cliente', 'editado', 'proyecto', new.proyecto_id,
            new.proyecto_id, 'Contexto IA enviado: ' || new.nombre);
  end if;
  return new;
end $$;

drop trigger if exists tg_auditar_contexto on public.contexto_servicios;
create trigger tg_auditar_contexto after update on public.contexto_servicios
  for each row execute function public.fn_auditar_contexto();
