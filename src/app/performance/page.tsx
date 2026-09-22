"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { esGestor, listarMiembros, listarTareas, type Miembro, type Tarea } from "@/lib/tasks";
import {
  calcularPerformance,
  formatDuracion,
} from "@/lib/performance";
import {
  calcularHorasHombre,
  formatHM,
  listarEventosTiempo,
  type RegistroTiempo,
} from "@/lib/tiempo";

// Dashboard de Performance Gerencial (independiente del Tablero operativo).
// Solo gestores. Mide productividad, tiempos, carga, cuellos y alertas a
// partir de las marcas de tiempo de las tareas. Las "horas hombre" quedan
// preparadas para cuando exista el cronómetro por tarea.
export default function Performance() {
  const { usuario, proyectos, cargado } = useStore();
  const router = useRouter();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [eventos, setEventos] = useState<RegistroTiempo[]>([]);
  const [cargando, setCargando] = useState(true);

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
    listarEventosTiempo().then(setEventos);
  }, [permitido]);

  const horas = useMemo(() => calcularHorasHombre(eventos), [eventos]);

  const proyectoNombre = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of proyectos) m[p.id] = p.nombre;
    return m;
  }, [proyectos]);

  const sistemaNombre = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of proyectos)
      for (const s of p.sistemas) m[s.id] = s.nombre;
    return m;
  }, [proyectos]);

  const data = useMemo(
    () => calcularPerformance(tareas, miembros, proyectoNombre, sistemaNombre),
    [tareas, miembros, proyectoNombre, sistemaNombre],
  );

  // Ranking: combina tareas terminadas (mes), tiempo promedio y cumplimiento.
  const ranking = useMemo(() => {
    return [...data.colaboradores]
      .map((c) => {
        const velocidad = c.tiempoPromedio ? 1 / c.tiempoPromedio : 0;
        const score =
          c.cerradasMes * 10 +
          (c.cumplimiento ?? 0) / 10 +
          velocidad * 1e8;
        return { ...c, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [data.colaboradores]);

  if (cargado && !permitido)
    return (
      <div className="py-20 text-center text-sm text-muted">
        No tienes acceso a esta sección.
      </div>
    );

  const maxCargaProy = Math.max(1, ...data.proyectos.map((p) => p.abiertas));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Performance gerencial
        </h1>
        <p className="mt-1 text-sm text-muted">
          Productividad, tiempos y eficiencia del equipo.
        </p>
      </div>

      {cargando ? (
        <div className="py-20 text-center text-sm text-muted">Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Abiertas" valor={String(data.totalAbiertas)} />
            <Kpi label="Cerradas (mes)" valor={String(data.totalCerradasMes)} tono="text-emerald-600" />
            <Kpi label="Vencidas" valor={String(data.vencidas)} tono={data.vencidas ? "text-red-600" : "text-foreground"} />
            <Kpi label="Resolución prom." valor={formatDuracion(data.resolucionGlobal)} tono="text-accent" />
          </div>

          {/* 10. Alertas (arriba, para que salten a la vista) */}
          {data.alertas.length > 0 && (
            <Panel titulo="Alertas">
              <div className="space-y-2">
                {data.alertas.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${
                      a.nivel === "alta"
                        ? "bg-red-50 text-red-700 ring-red-200"
                        : "bg-amber-50 text-amber-800 ring-amber-200"
                    }`}
                  >
                    <span>{a.nivel === "alta" ? "🔴" : "🟠"}</span>
                    <span>{a.texto}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* 1. Horas hombre (cronómetro real) */}
            <Panel titulo="Horas hombre" nota="Tiempo efectivo registrado por tarea">
              {miembros.length === 0 ? (
                <Vacio />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-1.5 text-left font-medium">Colaborador</th>
                      <th className="py-1.5 text-right font-medium">Hoy</th>
                      <th className="py-1.5 text-right font-medium">Semana</th>
                      <th className="py-1.5 text-right font-medium">Mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miembros.map((m) => {
                      const h = horas.get(m.id);
                      return (
                        <tr key={m.id} className="border-t border-border">
                          <td className="py-2">{m.nombre}</td>
                          <td className="py-2 text-right tabular-nums">{formatHM(h?.hoyMs ?? 0)}</td>
                          <td className="py-2 text-right tabular-nums">{formatHM(h?.semanaMs ?? 0)}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{formatHM(h?.mesMs ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-muted">
                Se acumula desde el cronómetro (Iniciar · Pausar · Reanudar ·
                Finalizar) en el detalle de cada tarea.
              </p>
            </Panel>

            {/* 2. Productividad por colaborador */}
            <Panel titulo="Productividad por colaborador">
              {data.colaboradores.length === 0 ? (
                <Vacio />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-1.5 text-left font-medium">Colaborador</th>
                      <th className="py-1.5 text-right font-medium">Hoy</th>
                      <th className="py-1.5 text-right font-medium">Semana</th>
                      <th className="py-1.5 text-right font-medium">Mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.colaboradores.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-2">{c.nombre}</td>
                        <td className="py-2 text-right tabular-nums">{c.cerradasHoy}</td>
                        <td className="py-2 text-right tabular-nums">{c.cerradasSemana}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{c.cerradasMes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            {/* 3. Tiempo promedio por tipo */}
            <Panel titulo="Tiempo promedio por tipo de tarea">
              <BarrasTiempo filas={data.porTipo} />
            </Panel>

            {/* 4. Tiempo promedio por sistema */}
            <Panel titulo="Tiempo promedio por sistema">
              <BarrasTiempo filas={data.porSistema} />
            </Panel>

            {/* 5. Tiempo promedio por proyecto */}
            <Panel titulo="Proyectos (carga y tiempo)">
              {data.proyectos.length === 0 ? (
                <Vacio />
              ) : (
                <div className="space-y-2">
                  {data.proyectos.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 truncate">{p.nombre}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${(p.abiertas / maxCargaProy) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums">
                        {p.abiertas}
                      </span>
                      <span className="w-14 shrink-0 text-right text-xs text-muted">
                        {formatDuracion(p.promedioResolucion)}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted">
                    Barra = tareas abiertas · derecha = tiempo promedio de
                    resolución.
                  </p>
                </div>
              )}
            </Panel>

            {/* 6. Carga de trabajo */}
            <Panel titulo="Carga de trabajo">
              {data.colaboradores.length === 0 ? (
                <Vacio />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-1.5 text-left font-medium">Colaborador</th>
                      <th className="py-1.5 text-right font-medium">Activas</th>
                      <th className="py-1.5 text-right font-medium">Revisión</th>
                      <th className="py-1.5 text-right font-medium">Pendientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.colaboradores.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-2">{c.nombre}</td>
                        <td className="py-2 text-right tabular-nums">{c.activas}</td>
                        <td className="py-2 text-right tabular-nums">{c.enRevision}</td>
                        <td className="py-2 text-right tabular-nums">{c.pendientes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            {/* 7. Cuellos de botella */}
            <Panel titulo="Cuellos de botella">
              <div className="grid grid-cols-3 gap-3">
                {data.cuellos.map((c) => (
                  <div
                    key={c.estado}
                    className="rounded-xl border border-border p-4 text-center"
                  >
                    <div
                      className={`text-2xl font-semibold ${
                        c.estado === "bloqueada" && c.n > 0
                          ? "text-rose-600"
                          : c.estado === "en_revision" && c.n >= 5
                            ? "text-amber-600"
                            : "text-foreground"
                      }`}
                    >
                      {c.n}
                    </div>
                    <div className="mt-1 text-xs text-muted">{c.label}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* 8. Ranking de productividad */}
            <Panel titulo="Ranking de productividad" nota="Indicador operativo, no competencia">
              {ranking.length === 0 ? (
                <Vacio />
              ) : (
                <div className="space-y-1.5">
                  {ranking.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-slate-50"
                    >
                      <span className="w-5 text-center font-semibold text-muted">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{c.nombre}</span>
                      <span className="text-xs text-muted">
                        {c.cerradasMes} cerradas
                      </span>
                      <span className="w-14 text-right text-xs text-muted">
                        {formatDuracion(c.tiempoPromedio)}
                      </span>
                      <span className="w-10 text-right text-xs tabular-nums">
                        {c.cumplimiento !== null ? `${c.cumplimiento}%` : "—"}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted">
                    Cerradas (mes) · tiempo promedio · cumplimiento de fecha.
                  </p>
                </div>
              )}
            </Panel>

            {/* 9. Tiempo promedio de resolución */}
            <Panel titulo="Tiempo promedio de resolución">
              <div className="mb-3 rounded-xl border border-border p-4">
                <div className="text-2xl font-semibold text-accent">
                  {formatDuracion(data.resolucionGlobal)}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Promedio general (creación → cierre)
                </div>
              </div>
              <BarrasTiempo filas={data.resolucionPorPrioridad} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function BarrasTiempo({
  filas,
}: {
  filas: { clave: string; etiqueta: string; n: number; promedio: number | null }[];
}) {
  if (filas.length === 0) return <Vacio />;
  const max = Math.max(1, ...filas.map((f) => f.promedio ?? 0));
  return (
    <div className="space-y-2">
      {filas.map((f) => (
        <div key={f.clave} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate">{f.etiqueta}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${((f.promedio ?? 0) / max) * 100}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs text-muted">
            {formatDuracion(f.promedio)}
          </span>
          <span className="w-8 shrink-0 text-right text-[11px] text-muted">
            ({f.n})
          </span>
        </div>
      ))}
    </div>
  );
}

function Vacio() {
  return (
    <p className="py-6 text-center text-sm text-muted">
      Aún no hay datos suficientes.
    </p>
  );
}

function Kpi({
  label,
  valor,
  tono = "text-foreground",
}: {
  label: string;
  valor: string;
  tono?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className={`text-2xl font-semibold ${tono}`}>{valor}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}

function Panel({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {nota && <span className="text-[11px] text-muted">{nota}</span>}
      </div>
      {children}
    </div>
  );
}
