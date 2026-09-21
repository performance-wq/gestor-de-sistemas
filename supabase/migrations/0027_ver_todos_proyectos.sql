-- =============================================================
-- System PEX — Todos los roles ven todos los proyectos (solo LECTURA)
--
-- Decisión de negocio: cualquier usuario activo puede VER todos los
-- proyectos y su contenido (sistemas, puntos, checklist, onboarding).
-- La ESCRITURA no cambia: sigue gobernada por has_project_access /
-- is_admin / RPCs, así que los ejecutores ven todo pero no editan lo
-- que no les corresponde. ADITIVO: no borra datos.
--
-- Técnica: se AÑADEN políticas permisivas de SELECT abiertas a usuarios
-- activos; como RLS combina políticas con OR, esto solo amplía lectura
-- y no toca las políticas de escritura existentes.
-- =============================================================

-- Proyectos: lectura para todo usuario activo (reemplaza la de acceso).
drop policy if exists proyectos_select on public.proyectos;
create policy proyectos_select on public.proyectos for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- Sistemas: SELECT abierto (sistemas_all sigue rigiendo la escritura).
drop policy if exists sistemas_ver_todos on public.sistemas;
create policy sistemas_ver_todos on public.sistemas for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- Puntos: SELECT abierto (puntos_all sigue rigiendo la escritura).
drop policy if exists puntos_ver_todos on public.puntos;
create policy puntos_ver_todos on public.puntos for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- Checklist: SELECT abierto (la escritura conserva su política).
drop policy if exists checklist_ver_todos on public.checklist_items;
create policy checklist_ver_todos on public.checklist_items for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

-- Onboarding: SELECT abierto para usuarios activos (interno; el flujo
-- público del cliente usa sus propias RPCs/políticas anon, intactas).
drop policy if exists onboarding_ver_todos on public.onboarding;
create policy onboarding_ver_todos on public.onboarding for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));

drop policy if exists onboarding_versiones_ver_todos on public.onboarding_versiones;
create policy onboarding_versiones_ver_todos on public.onboarding_versiones for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.activo));
