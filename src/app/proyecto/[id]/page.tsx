"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { proyectoStats, sistemaStats } from "@/lib/progress";
import { ESTADOS, estadoStyles, formatFecha } from "@/lib/ui";
import type { Estado } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DatosControl } from "@/components/DatosControl";

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
  if (!proyecto) return <div className="py-20 text-center text-muted">Cargando…</div>;

  const stats = proyectoStats(proyecto);

  return (
    <div>
      <Breadcrumb items={[{ label: "Proyectos", href: "/dashboard" }, { label: proyecto.nombre }]} />

      {/* Cabecera del proyecto */}
      <div className="mt-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {proyecto.nombre}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {proyecto.cliente && <span>Cliente: {proyecto.cliente}</span>}
              {proyecto.nicho && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {proyecto.nicho}
                </span>
              )}
              <span>Incorporación: {formatFecha(proyecto.fechaIncorporacion)}</span>
              <span>Cierre: {formatFecha(proyecto.fechaCierre)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={proyecto.estado}
              onChange={(e) =>
                actualizarProyecto(proyecto.id, {
                  estado: e.target.value as Estado,
                })
              }
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {ESTADOS.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (
                  confirm(`¿Eliminar el proyecto "${proyecto.nombre}"? Esta acción no se puede deshacer.`)
                ) {
                  eliminarProyecto(proyecto.id);
                  router.push("/dashboard");
                }
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted">
              Avance general · {stats.completos}/{stats.total} puntos completos
            </span>
            <span className="font-semibold">{stats.pct}%</span>
          </div>
          <ProgressBar pct={stats.pct} color={estadoStyles[proyecto.estado].bar} />
        </div>
      </div>

      {/* Sistemas */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sistemas</h2>
      </div>

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

      {/* Datos de control */}
      <div className="mt-8">
        <DatosControl proyecto={proyecto} />
      </div>
    </div>
  );
}
