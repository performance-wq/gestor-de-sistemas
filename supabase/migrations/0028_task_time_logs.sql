-- =============================================================
-- System PEX — Registro de tiempo por tarea (arquitectura preparada)
--
-- Tabla base para el futuro cronómetro por tarea (inicio · pausa ·
-- reanudación · fin). AÚN NO se usa desde la app: el Dashboard de
-- Performance la deja lista para que, cuando se active el registro de
-- tiempo, se calculen horas hombre, tiempo por tarea/sistema/proyecto,
-- costos y rentabilidad sin rehacer nada. ADITIVO: tabla nueva y
-- aislada; no toca ninguna funcionalidad existente.
-- =============================================================

create table if not exists public.task_time_logs (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  evento     text not null check (evento in ('inicio','pausa','reanudacion','fin')),
  created_at timestamptz not null default now()
);
create index if not exists idx_task_time_logs_task on public.task_time_logs(task_id, created_at);
create index if not exists idx_task_time_logs_user on public.task_time_logs(user_id, created_at);

alter table public.task_time_logs enable row level security;

-- Lectura: gestores ven todo; cada quien ve sus propios registros.
drop policy if exists task_time_logs_select on public.task_time_logs;
create policy task_time_logs_select on public.task_time_logs for select to authenticated
  using (public.puede_ver_todo() or user_id = auth.uid());

-- Escritura: cada quien registra su propio tiempo.
drop policy if exists task_time_logs_insert on public.task_time_logs;
create policy task_time_logs_insert on public.task_time_logs for insert to authenticated
  with check (user_id = auth.uid());
