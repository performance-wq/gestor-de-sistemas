-- =============================================================
-- Systems PEX — Catálogo GLOBAL de nichos
--
-- Convierte la lista fija de nichos en un catálogo compartido para
-- que se pueda ampliar al crear proyectos (mismo catálogo para crear,
-- mostrar y filtrar). No toca proyectos, ni el campo 'nicho' (texto)
-- de cada proyecto, ni ninguna otra funcionalidad.
-- =============================================================

create table if not exists public.nichos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  created_at timestamptz not null default now()
);

-- Sin duplicados sin importar mayúsculas/acentos de capitalización:
-- "Construcción" y "construcción" son el mismo nicho.
create unique index if not exists idx_nichos_nombre_lower
  on public.nichos (lower(nombre));

alter table public.nichos enable row level security;

-- Cualquier usuario autenticado puede ver y agregar nichos (catálogo global).
drop policy if exists nichos_select on public.nichos;
create policy nichos_select on public.nichos for select to authenticated
  using (true);

drop policy if exists nichos_insert on public.nichos;
create policy nichos_insert on public.nichos for insert to authenticated
  with check (true);

-- Semilla con los nichos actuales (se conservan tal cual). Idempotente.
insert into public.nichos (nombre) values
  ('Restaurante'),
  ('Estética'),
  ('Bienes Raíces'),
  ('Seguros'),
  ('Consultoría'),
  ('E-commerce'),
  ('Salud'),
  ('Educación'),
  ('Otros')
on conflict do nothing;
