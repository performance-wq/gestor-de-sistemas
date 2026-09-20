"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFechaHora } from "@/lib/ui";
import {
  etiquetaEstado,
  listarHistorialProyecto,
  listarMiembros,
  type Miembro,
  type TareaEstado,
  type TareaHistorial,
} from "@/lib/tasks";

// Fase "Historial" del proyecto: línea de tiempo inmutable de todas las
// tareas del proyecto (creación, cambios de estado, ediciones, comentarios).
export function HistorialProyecto({ proyectoId }: { proyectoId: string }) {
  const [items, setItems] = useState<(TareaHistorial & { tareaTitulo: string })[]>(
    [],
  );
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    listarHistorialProyecto(proyectoId).then((h) => {
      setItems(h);
      setCargando(false);
    });
    listarMiembros().then(setMiembros);
  }, [proyectoId]);

  const nombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of miembros) m[x.id] = x.nombre;
    return m;
  }, [miembros]);

  return (
    <div>
      <h2 className="text-lg font-semibold">Historial</h2>
      <p className="mt-0.5 text-sm text-muted">
        Registro automático e inmutable de la actividad de las tareas.
      </p>

      <div className="mt-4">
        {cargando ? (
          <div className="py-12 text-center text-sm text-muted">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-sm text-muted">
            Aún no hay actividad registrada.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((h, i) => (
              <div
                key={h.id}
                className={`flex items-start gap-3 px-4 py-3 text-sm ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">
                    {h.actorId ? nombrePorId[h.actorId] ?? "—" : "Sistema"}
                  </span>{" "}
                  <span className="text-muted">{descripcion(h)}</span>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {h.tareaTitulo}
                  </div>
                  {h.nota && (
                    <div className="mt-0.5 text-xs italic text-muted">
                      “{h.nota}”
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {formatFechaHora(h.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function descripcion(h: TareaHistorial): string {
  switch (h.accion) {
    case "creada":
      return "creó la tarea";
    case "estado":
      return `cambió el estado: ${etiquetaEstado(
        (h.valorAnterior as TareaEstado) ?? "",
      )} → ${etiquetaEstado((h.valorNuevo as TareaEstado) ?? "")}`;
    case "asignada":
      return "actualizó el responsable";
    case "reabierta":
      return "reabrió la tarea";
    case "comentario":
      return "comentó";
    case "editada":
      return `editó ${h.campo ?? "un campo"}`;
    default:
      return h.accion;
  }
}
