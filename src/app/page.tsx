"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { proyectoStats } from "@/lib/progress";
import { ESTADOS, estadoStyles, formatFecha } from "@/lib/ui";
import type { Estado } from "@/lib/types";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { NuevoProyectoModal } from "@/components/NuevoProyectoModal";

type Filtro = Estado | "Todos";

export default function Dashboard() {
  const { proyectos, cargado } = useStore();
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [modal, setModal] = useState(false);

  const visibles = useMemo(
    () =>
      filtro === "Todos"
        ? proyectos
        : proyectos.filter((p) => p.estado === filtro),
    [proyectos, filtro],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-1 text-sm text-muted">
            {proyectos.length} proyecto{proyectos.length === 1 ? "" : "s"} · CRM
            GoHighLevel
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          + Nuevo proyecto
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["Todos", ...ESTADOS] as Filtro[]).map((f) => {
          const activo = filtro === f;
          return (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activo
                  ? "bg-foreground text-white"
                  : "bg-surface text-muted ring-1 ring-inset ring-border hover:text-foreground"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div className="mt-6">
        {!cargado ? (
          <div className="py-20 text-center text-sm text-muted">Cargando…</div>
        ) : visibles.length === 0 ? (
          <EmptyState
            hayProyectos={proyectos.length > 0}
            onNuevo={() => setModal(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((p) => {
              const stats = proyectoStats(p);
              return (
                <Link
                  key={p.id}
                  href={`/proyecto/${p.id}`}
                  className="group flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-tight group-hover:text-accent">
                      {p.nombre}
                    </h3>
                    <EstadoBadge estado={p.estado} />
                  </div>

                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted">
                        {stats.completos}/{stats.total} puntos
                      </span>
                      <span className="font-semibold">{stats.pct}%</span>
                    </div>
                    <ProgressBar
                      pct={stats.pct}
                      color={estadoStyles[p.estado].bar}
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span>Inicio: {formatFecha(p.fechaIncorporacion)}</span>
                    <span>·</span>
                    <span>{p.sistemas.length} sistemas</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {modal && <NuevoProyectoModal onClose={() => setModal(false)} />}
    </div>
  );
}

function EmptyState({
  hayProyectos,
  onNuevo,
}: {
  hayProyectos: boolean;
  onNuevo: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
        📁
      </div>
      <h3 className="mt-4 font-medium">
        {hayProyectos ? "Sin proyectos en este filtro" : "Aún no hay proyectos"}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        {hayProyectos
          ? "Prueba con otro estado o crea uno nuevo."
          : "Crea tu primer proyecto y se cargarán los 6 sistemas de la plantilla automáticamente."}
      </p>
      <button
        onClick={onNuevo}
        className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        + Nuevo proyecto
      </button>
    </div>
  );
}
