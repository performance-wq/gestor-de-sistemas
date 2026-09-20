"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ESTADOS_ABIERTOS,
  ESTADOS_TAREA,
  listarMiembros,
  listarTareasProyecto,
  type Miembro,
  type Tarea,
  type TareaEstado,
} from "@/lib/tasks";
import { ListaTareas } from "./ListaTareas";
import { NuevaTareaModal } from "./NuevaTareaModal";
import { TareaDetalle } from "./TareaDetalle";

type FiltroEstado = TareaEstado | "abiertas" | "todas";

// Fase "Seguimiento" del proyecto: tareas ligadas a este proyecto (por id).
// Crear tarea aquí preselecciona y bloquea el proyecto.
export function SeguimientoProyecto({ proyectoId }: { proyectoId: string }) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fEstado, setFEstado] = useState<FiltroEstado>("abiertas");
  const [nueva, setNueva] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const t = await listarTareasProyecto(proyectoId);
    setTareas(t);
    setCargando(false);
  }, [proyectoId]);

  useEffect(() => {
    cargar();
    listarMiembros().then(setMiembros);
  }, [cargar]);

  const nombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of miembros) m[x.id] = x.nombre;
    return m;
  }, [miembros]);

  const visibles = useMemo(() => {
    return tareas.filter((t) => {
      if (fEstado === "abiertas") return ESTADOS_ABIERTOS.includes(t.estado);
      if (fEstado === "todas") return true;
      return t.estado === fEstado;
    });
  }, [tareas, fEstado]);

  const abiertas = tareas.filter((t) => ESTADOS_ABIERTOS.includes(t.estado));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Seguimiento</h2>
          <p className="mt-0.5 text-sm text-muted">
            Tareas del proyecto · {abiertas.length} abierta
            {abiertas.length === 1 ? "" : "s"} de {tareas.length}
          </p>
        </div>
        <button
          onClick={() => setNueva(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          + Nueva tarea
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={fEstado}
          onChange={(e) => setFEstado(e.target.value as FiltroEstado)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted outline-none focus:border-accent focus:text-foreground"
        >
          <option value="abiertas">Abiertas</option>
          <option value="todas">Todas</option>
          {ESTADOS_TAREA.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {cargando ? (
          <div className="py-12 text-center text-sm text-muted">Cargando…</div>
        ) : (
          <ListaTareas
            tareas={visibles}
            nombrePorId={nombrePorId}
            mostrarProyecto={false}
            onOpen={(id) => setDetalle(id)}
          />
        )}
      </div>

      {nueva && (
        <NuevaTareaModal
          proyectoIdFijo={proyectoId}
          onClose={() => setNueva(false)}
          onCreated={() => cargar()}
        />
      )}
      {detalle && (
        <TareaDetalle
          tareaId={detalle}
          onClose={() => setDetalle(null)}
          onChanged={() => cargar()}
        />
      )}
    </div>
  );
}
