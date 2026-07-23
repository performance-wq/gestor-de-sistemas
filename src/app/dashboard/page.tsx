"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { proyectoStats } from "@/lib/progress";
import { ESTADOS, NICHOS, estadoStyles, formatFecha } from "@/lib/ui";
import type { Estado } from "@/lib/types";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { NuevoProyectoModal } from "@/components/NuevoProyectoModal";

type FiltroEstado = Estado | "Todos";

export default function Dashboard() {
  const { proyectos, cargado } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [fEstado, setFEstado] = useState<FiltroEstado>("Todos");
  const [fNicho, setFNicho] = useState<string>("Todos");
  const [modal, setModal] = useState(false);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (fEstado !== "Todos" && p.estado !== fEstado) return false;
      if (fNicho !== "Todos" && (p.nicho ?? "") !== fNicho) return false;
      if (q) {
        const campos = [p.nombre, p.cliente, p.palabrasClave, p.nicho]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!campos.includes(q)) return false;
      }
      return true;
    });
  }, [proyectos, busqueda, fEstado, fNicho]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-1 text-sm text-muted">
            {proyectos.length} proyecto{proyectos.length === 1 ? "" : "s"} ·
            implementaciones CRM
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          + Nuevo proyecto
        </button>
      </div>

      {/* Buscador */}
      <div className="mt-6">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            🔍
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cliente o palabras clave…"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["Todos", ...ESTADOS] as FiltroEstado[]).map((f) => {
          const activo = fEstado === f;
          return (
            <button
              key={f}
              onClick={() => setFEstado(f)}
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
        <span className="mx-1 h-5 w-px bg-border" />
        <select
          value={fNicho}
          onChange={(e) => setFNicho(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted outline-none focus:border-accent focus:text-foreground"
        >
          <option value="Todos">Todos los nichos</option>
          {NICHOS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
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
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold leading-tight group-hover:text-accent">
                        {p.nombre}
                      </h3>
                      {p.cliente && (
                        <p className="truncate text-xs text-muted">{p.cliente}</p>
                      )}
                    </div>
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

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {p.nicho && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        {p.nicho}
                      </span>
                    )}
                    <span>Inicio: {formatFecha(p.fechaIncorporacion)}</span>
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
        {hayProyectos
          ? "Sin resultados para esta búsqueda o filtro"
          : "Aún no hay proyectos"}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        {hayProyectos
          ? "Prueba con otros filtros o crea un proyecto nuevo."
          : "Crea tu primer proyecto y se cargarán los sistemas de la plantilla automáticamente."}
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
