"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  ESTADOS_ABIERTOS,
  ESTADOS_TAREA,
  PRIORIDADES,
  chipEstado,
  chipPrioridad,
  esGestor,
  etiquetaEstado,
  etiquetaPrioridad,
  listarMiembros,
  listarTareas,
  type Miembro,
  type Tarea,
} from "@/lib/tasks";

// Tablero de indicadores operativos (Fase 8). Todo se calcula en cliente a
// partir de las tareas visibles según la RLS del usuario.
export default function Tablero() {
  const { usuario, proyectos, cargado } = useStore();
  const router = useRouter();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);

  // El Tablero es solo para gestores (admin/pm/coordinación). Un ejecutor que
  // llegue por URL directa es redirigido a Proyectos.
  const permitido = esGestor(usuario?.rol);
  useEffect(() => {
    if (cargado && !permitido) router.replace("/dashboard");
  }, [cargado, permitido, router]);

  useEffect(() => {
    if (!permitido) return;
    listarTareas().then((t) => {
      setTareas(t);
      setCargando(false);
    });
    listarMiembros().then(setMiembros);
  }, [permitido]);

  if (cargado && !permitido)
    return (
      <div className="py-20 text-center text-sm text-muted">
        No tienes acceso a esta sección.
      </div>
    );

  const hoy = new Date().toISOString().slice(0, 10);
  const abiertas = useMemo(
    () => tareas.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)),
    [tareas],
  );
  const vencidas = useMemo(
    () =>
      abiertas.filter((t) => t.deadline && t.deadline < hoy),
    [abiertas, hoy],
  );
  const enRevision = abiertas.filter((t) => t.estado === "en_revision");
  const criticas = abiertas.filter((t) => t.prioridad === "critica");
  const misAbiertas = abiertas.filter((t) => t.responsableId === usuario?.id);

  const porEstado = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tareas) m[t.estado] = (m[t.estado] ?? 0) + 1;
    return m;
  }, [tareas]);

  const porPrioridad = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of abiertas) m[t.prioridad] = (m[t.prioridad] ?? 0) + 1;
    return m;
  }, [abiertas]);

  const porResponsable = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of abiertas) {
      const k = t.responsableId ?? "nadie";
      m[k] = (m[k] ?? 0) + 1;
    }
    const nombre: Record<string, string> = { nadie: "Sin asignar" };
    for (const x of miembros) nombre[x.id] = x.nombre;
    return Object.entries(m)
      .map(([id, n]) => ({ id, nombre: nombre[id] ?? "—", n }))
      .sort((a, b) => b.n - a.n);
  }, [abiertas, miembros]);

  const porProyecto = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of abiertas) m[t.proyectoId] = (m[t.proyectoId] ?? 0) + 1;
    const nombre: Record<string, string> = {};
    for (const p of proyectos) nombre[p.id] = p.nombre;
    return Object.entries(m)
      .map(([id, n]) => ({ id, nombre: nombre[id] ?? "—", n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [abiertas, proyectos]);

  const maxResp = Math.max(1, ...porResponsable.map((r) => r.n));
  const maxProy = Math.max(1, ...porProyecto.map((r) => r.n));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tablero</h1>
        <p className="mt-1 text-sm text-muted">
          Indicadores operativos en tiempo real.
        </p>
      </div>

      {cargando ? (
        <div className="py-20 text-center text-sm text-muted">Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Abiertas" valor={abiertas.length} tono="text-foreground" />
            <Kpi label="Vencidas" valor={vencidas.length} tono="text-red-600" />
            <Kpi label="En revisión" valor={enRevision.length} tono="text-amber-600" />
            <Kpi label="Críticas" valor={criticas.length} tono="text-rose-600" />
            <Kpi label="Mis tareas" valor={misAbiertas.length} tono="text-accent" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Por estado */}
            <Panel titulo="Por estado">
              <div className="flex flex-wrap gap-2">
                {ESTADOS_TAREA.map((e) => (
                  <span
                    key={e.valor}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${chipEstado(
                      e.valor,
                    )}`}
                  >
                    {etiquetaEstado(e.valor)} · {porEstado[e.valor] ?? 0}
                  </span>
                ))}
              </div>
            </Panel>

            {/* Por prioridad (abiertas) */}
            <Panel titulo="Por prioridad (abiertas)">
              <div className="flex flex-wrap gap-2">
                {PRIORIDADES.map((p) => (
                  <span
                    key={p.valor}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${chipPrioridad(
                      p.valor,
                    )}`}
                  >
                    {etiquetaPrioridad(p.valor)} · {porPrioridad[p.valor] ?? 0}
                  </span>
                ))}
              </div>
            </Panel>

            {/* Por responsable */}
            <Panel titulo="Carga por responsable (abiertas)">
              {porResponsable.length === 0 ? (
                <p className="text-sm text-muted">Sin tareas abiertas.</p>
              ) : (
                <div className="space-y-2">
                  {porResponsable.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 truncate">{r.nombre}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(r.n / maxResp) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right font-medium">
                        {r.n}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Por proyecto */}
            <Panel titulo="Proyectos con más tareas abiertas">
              {porProyecto.length === 0 ? (
                <p className="text-sm text-muted">Sin tareas abiertas.</p>
              ) : (
                <div className="space-y-2">
                  {porProyecto.map((r) => (
                    <Link
                      key={r.id}
                      href={`/proyecto/${r.id}#seguimiento`}
                      className="flex items-center gap-3 text-sm hover:text-accent"
                    >
                      <span className="w-32 shrink-0 truncate">{r.nombre}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${(r.n / maxProy) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right font-medium">
                        {r.n}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-6">
            <Link
              href="/tareas"
              className="text-sm font-medium text-accent hover:underline"
            >
              Ver todas las tareas →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: number;
  tono: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className={`text-3xl font-semibold ${tono}`}>{valor}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}

function Panel({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
      {children}
    </div>
  );
}
