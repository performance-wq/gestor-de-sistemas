"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { proyectoStats, sistemaStats } from "@/lib/progress";
import { ESTADOS, estadoStyles, formatFecha } from "@/lib/ui";
import type { Estado } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DatosControl } from "@/components/DatosControl";
import { OnboardingPanel } from "@/components/OnboardingPanel";

type Fase = "onboarding" | "implementacion" | "performance";

const FASES: { id: Fase; n: number; label: string; hint: string }[] = [
  { id: "onboarding", n: 1, label: "Onboarding", hint: "Información del cliente" },
  { id: "implementacion", n: 2, label: "Implementación", hint: "Sistemas" },
  { id: "performance", n: 3, label: "Performance", hint: "Resultados" },
];

export default function ProyectoView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    cargado,
    getProyecto,
    actualizarProyecto,
    eliminarProyecto,
    agregarSistema,
  } = useStore();
  const [nuevoSistema, setNuevoSistema] = useState("");
  const [fase, setFase] = useState<Fase>("implementacion");

  // Recuerda la fase en el hash de la URL (sin Suspense ni recargas).
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Fase;
    if (FASES.some((f) => f.id === h)) setFase(h);
  }, []);
  function irAFase(f: Fase) {
    setFase(f);
    history.replaceState(null, "", `#${f}`);
  }

  const proyecto = getProyecto(id);

  if (cargado && !proyecto) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Este proyecto no existe.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-accent">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }
  if (!proyecto)
    return <div className="py-20 text-center text-muted">Cargando…</div>;

  const stats = proyectoStats(proyecto);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Proyectos", href: "/dashboard" },
          { label: proyecto.nombre },
        ]}
      />

      {/* ---------- Encabezado compacto ---------- */}
      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        {/* Izquierda: nombre + empresa + acciones */}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {proyecto.nombre}
          </h1>
          {proyecto.nicho && (
            <p className="mt-0.5 text-sm text-muted">{proyecto.nicho}</p>
          )}
          <div className="mt-3">
            <button
              onClick={() => {
                if (
                  confirm(
                    `¿Eliminar el proyecto "${proyecto.nombre}"? Esta acción no se puede deshacer.`,
                  )
                ) {
                  eliminarProyecto(proyecto.id);
                  router.push("/dashboard");
                }
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Eliminar proyecto
            </button>
          </div>
        </div>

        {/* Derecha: tarjeta de datos */}
        <div className="w-full shrink-0 rounded-xl border border-border bg-background/60 p-4 md:w-72">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Estado</span>
            <select
              value={proyecto.estado}
              onChange={(e) =>
                actualizarProyecto(proyecto.id, {
                  estado: e.target.value as Estado,
                })
              }
              className="rounded-lg border border-border bg-white px-2 py-1 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {ESTADOS.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <FilaDato etiqueta="Cliente" valor={proyecto.cliente || "—"} />
            <FilaDato
              etiqueta="Incorporación"
              valor={formatFecha(proyecto.fechaIncorporacion)}
            />
            <FilaDato etiqueta="Cierre" valor={formatFecha(proyecto.fechaCierre)} />
          </dl>
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted">Avance general</span>
              <span className="font-semibold">{stats.pct}%</span>
            </div>
            <ProgressBar pct={stats.pct} color={estadoStyles[proyecto.estado].bar} />
            <p className="mt-1 text-xs text-muted">
              {stats.completos}/{stats.total} puntos completos
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Navegación por fases ---------- */}
      <div className="mt-6 flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-sm">
        {FASES.map((f) => {
          const activa = fase === f.id;
          return (
            <button
              key={f.id}
              onClick={() => irAFase(f.id)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activa
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:bg-slate-50 hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                  activa ? "bg-white/25" : "bg-slate-100 text-slate-500"
                }`}
              >
                {f.n}
              </span>
              <span className="truncate">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------- Contenido de la fase ---------- */}
      <div className="mt-6">
        {fase === "onboarding" && (
          <OnboardingPanel
            proyectoId={proyecto.id}
            proyectoNombre={proyecto.nombre}
            cliente={proyecto.cliente}
          />
        )}

        {fase === "implementacion" && (
          <div>
            <h2 className="text-lg font-semibold">Sistemas</h2>
            <p className="mt-0.5 text-sm text-muted">
              Todo lo que implementamos para el cliente.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {proyecto.sistemas.map((s) => {
                const st = sistemaStats(s);
                return (
                  <Link
                    key={s.id}
                    href={`/proyecto/${proyecto.id}/sistema/${s.id}`}
                    className="group flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight group-hover:text-accent">
                        {s.nombre}
                      </h3>
                      <span className="text-sm font-semibold text-muted">
                        {st.pct}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {st.completos}/{st.total} puntos completos
                    </p>
                    <ProgressBar className="mt-4" pct={st.pct} />
                  </Link>
                );
              })}

              {/* Agregar sistema */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!nuevoSistema.trim()) return;
                  agregarSistema(proyecto.id, nuevoSistema);
                  setNuevoSistema("");
                }}
                className="flex flex-col justify-center rounded-xl border border-dashed border-border bg-surface/50 p-5"
              >
                <label className="mb-2 text-sm font-medium text-muted">
                  + Agregar sistema
                </label>
                <div className="flex gap-2">
                  <input
                    value={nuevoSistema}
                    onChange={(e) => setNuevoSistema(e.target.value)}
                    placeholder="Nombre del sistema"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Añadir
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {fase === "performance" && (
          <div>
            <h2 className="text-lg font-semibold">Performance</h2>
            <p className="mt-0.5 text-sm text-muted">
              Medimos el impacto del proyecto tras la implementación.
            </p>
            <div className="mt-4">
              <DatosControl proyecto={proyecto} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{etiqueta}</dt>
      <dd className="truncate font-medium">{valor}</dd>
    </div>
  );
}
