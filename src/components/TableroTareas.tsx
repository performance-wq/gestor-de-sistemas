"use client";

import { formatFecha, inicial, avatarColor } from "@/lib/ui";
import {
  chipPrioridad,
  etiquetaEstado,
  etiquetaPrioridad,
  etiquetaTipo,
  type Tarea,
  type TareaEstado,
} from "@/lib/tasks";

// Colores por estado para las columnas del tablero.
const COLOR: Record<
  TareaEstado,
  { head: string; borde: string; punto: string }
> = {
  pendiente: {
    head: "bg-slate-100 text-slate-700",
    borde: "border-slate-200",
    punto: "bg-slate-400",
  },
  reabierta: {
    head: "bg-violet-100 text-violet-800",
    borde: "border-violet-200",
    punto: "bg-violet-500",
  },
  en_proceso: {
    head: "bg-blue-100 text-blue-800",
    borde: "border-blue-200",
    punto: "bg-blue-500",
  },
  bloqueada: {
    head: "bg-rose-100 text-rose-800",
    borde: "border-rose-200",
    punto: "bg-rose-500",
  },
  en_revision: {
    head: "bg-amber-100 text-amber-800",
    borde: "border-amber-200",
    punto: "bg-amber-500",
  },
  cerrada: {
    head: "bg-emerald-100 text-emerald-800",
    borde: "border-emerald-200",
    punto: "bg-emerald-500",
  },
  cancelada: {
    head: "bg-slate-100 text-slate-500",
    borde: "border-slate-200",
    punto: "bg-slate-300",
  },
};

// Orden de columnas (flujo natural). Las columnas del núcleo siempre se
// muestran; el resto solo si tienen tareas.
const ORDEN: TareaEstado[] = [
  "pendiente",
  "reabierta",
  "en_proceso",
  "bloqueada",
  "en_revision",
  "cerrada",
  "cancelada",
];
const NUCLEO = new Set<TareaEstado>([
  "pendiente",
  "en_proceso",
  "en_revision",
  "cerrada",
]);

export function TableroTareas({
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
  const porEstado = new Map<TareaEstado, Tarea[]>();
  for (const t of tareas) {
    (porEstado.get(t.estado) ?? porEstado.set(t.estado, []).get(t.estado)!).push(
      t,
    );
  }

  const columnas = ORDEN.filter(
    (e) => NUCLEO.has(e) || (porEstado.get(e)?.length ?? 0) > 0,
  );

  if (tareas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-sm text-muted">
        No hay tareas para este filtro.
      </div>
    );
  }

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {columnas.map((estado) => {
        const items = porEstado.get(estado) ?? [];
        const c = COLOR[estado];
        return (
          <div
            key={estado}
            className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-50/70"
          >
            <div
              className={`flex items-center justify-between gap-2 rounded-t-2xl px-3 py-2.5 ${c.head}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${c.punto}`} />
                <span className="text-sm font-semibold">
                  {etiquetaEstado(estado)}
                </span>
              </div>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold">
                {items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted">
                  Sin tareas
                </p>
              ) : (
                items.map((t) => (
                  <TarjetaTablero
                    key={t.id}
                    tarea={t}
                    responsable={
                      t.responsableId ? nombrePorId[t.responsableId] : undefined
                    }
                    empresa={
                      mostrarProyecto
                        ? proyectoNombrePorId?.[t.proyectoId]
                        : undefined
                    }
                    borde={c.borde}
                    onOpen={onOpen}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TarjetaTablero({
  tarea: t,
  responsable,
  empresa,
  borde,
  onOpen,
}: {
  tarea: Tarea;
  responsable?: string;
  empresa?: string;
  borde: string;
  onOpen: (id: string) => void;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const vencida =
    t.deadline &&
    t.deadline < hoy &&
    t.estado !== "cerrada" &&
    t.estado !== "cancelada";

  return (
    <button
      onClick={() => onOpen(t.id)}
      className={`w-full rounded-xl border ${borde} bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md`}
    >
      {/* Responsable primero */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(
              responsable,
            )}`}
          >
            {inicial(responsable)}
          </span>
          <span className="truncate text-sm font-semibold text-foreground">
            {responsable ?? "Sin asignar"}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${chipPrioridad(
            t.prioridad,
          )}`}
        >
          {etiquetaPrioridad(t.prioridad)}
        </span>
      </div>

      {/* Empresa */}
      {empresa && (
        <p className="mt-1.5 truncate text-xs font-medium text-muted">
          🏢 {empresa}
        </p>
      )}

      {/* Título */}
      <p className="mt-1 line-clamp-2 text-sm text-foreground/90">{t.titulo}</p>

      {/* Meta */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
          {etiquetaTipo(t.tipo)}
        </span>
        {t.reabiertaCount > 0 && (
          <span className="text-violet-600">↻{t.reabiertaCount}</span>
        )}
        {t.deadline && (
          <span className={vencida ? "font-semibold text-red-600" : ""}>
            📅 {formatFecha(t.deadline)}
            {vencida ? " (vencida)" : ""}
          </span>
        )}
      </div>
    </button>
  );
}
