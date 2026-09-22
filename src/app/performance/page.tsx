"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  esGestor,
  listarMiembros,
  listarTareas,
  type Miembro,
  type Tarea,
} from "@/lib/tasks";
import { calcularPerformance, formatHM } from "@/lib/performance";
import { listarEventosTiempo, type RegistroTiempo } from "@/lib/tiempo";

// Dashboard de Performance Gerencial. Mide el TIEMPO REAL de trabajo
// (cronómetro), no el tiempo calendario. Solo gestores.
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
    Promise.all([listarTareas(), listarMiembros(), listarEventosTiempo()]).then(
      ([t, m, ev]) => {
        setTareas(t);
        setMiembros(m);
        setEventos(ev);
        setCargando(false);
      },
    );
  }, [permitido]);

  const proyectoNombre = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of proyectos) m[p.id] = p.nombre;
    return m;
  }, [proyectos]);
  const sistemaNombre = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of proyectos) for (const s of p.sistemas) m[s.id] = s.nombre;
    return m;
  }, [proyectos]);

  const data = useMemo(
    () =>
      calcularPerformance(tareas, miembros, eventos, proyectoNombre, sistemaNombre),
    [tareas, miembros, eventos, proyectoNombre, sistemaNombre],
  );

  if (cargado && !permitido)
    return (
      <div className="py-20 text-center text-sm text-muted">
        No tienes acceso a esta sección.
      </div>
    );

  const maxSis = Math.max(1, ...data.porSistema.map((s) => s.operativoMs));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Performance gerencial
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tiempo real de trabajo (cronómetro), productividad y eficiencia.
        </p>
      </div>

      {cargando ? (
        <div className="py-20 text-center text-sm text-muted">Cargando…</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Abiertas" valor={String(data.totalAbiertas)} />
            <Kpi
              label="Trabajado (mes)"
              valor={formatHM(data.operativoMesMs)}
              tono="text-accent"
            />
            <Kpi
              label="Prom. por tarea"
              valor={
                data.operativoPromedioTareaMs !== null
                  ? formatHM(data.operativoPromedioTareaMs)
                  : "—"
              }
            />
            <Kpi
              label="Vencidas"
              valor={String(data.vencidas)}
              tono={data.vencidas ? "text-red-600" : "text-foreground"}
            />
          </div>

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
            {/* Horas hombre */}
            <Panel titulo="Horas hombre" nota="Tiempo real de cronómetro">
              <Tabla
                cols={["Colaborador", "Hoy", "Semana", "Mes"]}
                filas={data.colaboradores.map((c) => [
                  c.nombre,
                  formatHM(c.hoyMs),
                  formatHM(c.semanaMs),
                  formatHM(c.mesMs),
                ])}
              />
            </Panel>

            {/* Productividad / eficiencia */}
            <Panel titulo="Productividad y eficiencia">
              <Tabla
                cols={["Colaborador", "Terminadas (mes)", "Prom/tarea"]}
                filas={data.colaboradores.map((c) => [
                  c.nombre,
                  String(c.cerradasMes),
                  c.promedioTareaMs !== null ? formatHM(c.promedioTareaMs) : "—",
                ])}
              />
            </Panel>

            {/* Carga de trabajo */}
            <Panel titulo="Carga de trabajo">
              <Tabla
                cols={["Colaborador", "Activas", "Revisión", "Pendientes"]}
                filas={data.colaboradores.map((c) => [
                  c.nombre,
                  String(c.activas),
                  String(c.enRevision),
                  String(c.pendientes),
                ])}
              />
            </Panel>

            {/* Cuellos */}
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

            {/* Tiempo operativo por sistema */}
            <Panel titulo="Tiempo real por sistema">
              {data.porSistema.length === 0 ? (
                <Vacio />
              ) : (
                <div className="space-y-2">
                  {data.porSistema.map((s) => (
                    <div key={s.etiqueta} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate">{s.etiqueta}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(s.operativoMs / maxSis) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs text-muted">
                        {formatHM(s.operativoMs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Tareas con más tiempo (desglose) */}
            <Panel titulo="Tareas con más tiempo (ejecutor / revisor)">
              {data.topTareas.length === 0 ? (
                <Vacio />
              ) : (
                <div className="space-y-2.5">
                  {data.topTareas.map((t) => (
                    <div key={t.id} className="text-sm">
                      <div className="truncate font-medium">{t.titulo}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span className="truncate">{t.proyecto}</span>
                        <span>· Ejecutor {formatHM(t.ejecutorMs)}</span>
                        <span>· Revisor {formatHM(t.revisorMs)}</span>
                        <span className="font-medium text-foreground">
                          · Total {formatHM(t.totalMs)}
                        </span>
                        {t.nCorrecciones > 0 && (
                          <span>· {t.nCorrecciones} corrección(es)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <p className="mt-6 text-xs text-muted">
            Todos los tiempos provienen del cronómetro por tarea (ejecución +
            corrección para el ejecutor, revisión para el supervisor). No se usa
            el tiempo entre creación y cierre.
          </p>
        </>
      )}
    </div>
  );
}

function Tabla({ cols, filas }: { cols: string[]; filas: string[][] }) {
  if (filas.length === 0) return <Vacio />;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted">
          {cols.map((c, i) => (
            <th
              key={c}
              className={`py-1.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, r) => (
          <tr key={r} className="border-t border-border">
            {f.map((v, i) => (
              <td
                key={i}
                className={`py-2 tabular-nums ${
                  i === 0 ? "text-left" : "text-right"
                } ${i === f.length - 1 ? "font-semibold" : ""}`}
              >
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Vacio() {
  return (
    <p className="py-6 text-center text-sm text-muted">
      Aún no hay tiempo registrado.
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
