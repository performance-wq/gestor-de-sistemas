"use client";

import { avatarColor, formatFecha, inicial } from "@/lib/ui";
import {
  chipEstado,
  chipPrioridad,
  etiquetaEstado,
  etiquetaPrioridad,
  etiquetaTipo,
  type Tarea,
} from "@/lib/tasks";

// Lista compacta de tareas reutilizable (Gestión de tareas y Seguimiento del
// proyecto). Presentacional: recibe los datos ya resueltos y avisa al abrir.
export function ListaTareas({
  tareas,
  nombrePorId,
  proyectoNombrePorId,
  mostrarProyecto = true,
  onOpen,
}: {
  tareas: Tarea[];
  nombrePorId: Record<string, string>;
  proyectoNombrePorId?: Record<string, string>;
  mostrarProyecto?: boolean;
  onOpen: (id: string) => void;
}) {
  if (tareas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-sm text-muted">
        No hay tareas para este filtro.
      </div>
    );
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {tareas.map((t, i) => {
        const vencida =
          t.deadline &&
          t.deadline < hoy &&
          t.estado !== "cerrada" &&
          t.estado !== "cancelada";
        const responsable = t.responsableId
          ? nombrePorId[t.responsableId]
          : undefined;
        const empresa =
          mostrarProyecto && proyectoNombrePorId
            ? proyectoNombrePorId[t.proyectoId] ?? "—"
            : undefined;
        return (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            {/* Avatar del responsable */}
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(
                responsable,
              )}`}
              title={responsable ?? "Sin asignar"}
            >
              {inicial(responsable)}
            </span>

            <div className="min-w-0 flex-1">
              {/* Responsable primero, luego empresa */}
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {responsable ?? "Sin asignar"}
                </span>
                {empresa && (
                  <span className="truncate text-xs text-muted">
                    · 🏢 {empresa}
                  </span>
                )}
              </div>
              {/* Título */}
              <div className="mt-0.5 flex items-center gap-2">
                <span className="truncate text-sm text-foreground/90">
                  {t.titulo}
                </span>
                {t.reabiertaCount > 0 && (
                  <span className="shrink-0 text-xs text-violet-600">
                    ↻{t.reabiertaCount}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                  {etiquetaTipo(t.tipo)}
                </span>
                {t.deadline && (
                  <span className={vencida ? "font-medium text-red-600" : ""}>
                    📅 {formatFecha(t.deadline)}
                    {vencida ? " (vencida)" : ""}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${chipPrioridad(
                t.prioridad,
              )}`}
            >
              {etiquetaPrioridad(t.prioridad)}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${chipEstado(
                t.estado,
              )}`}
            >
              {etiquetaEstado(t.estado)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
