"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "@/lib/store";
import { puntoCompleto, sistemaStats } from "@/lib/progress";
import type { Punto } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Toast } from "@/components/Toast";

export default function SistemaView() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const {
    cargado,
    getProyecto,
    agregarPunto,
    eliminarPunto,
    eliminarSistema,
    reordenarPuntos,
  } = useStore();
  const [nuevoPunto, setNuevoPunto] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const proyecto = getProyecto(id);
  const sistema = proyecto?.sistemas.find((s) => s.id === sid);

  if (cargado && (!proyecto || !sistema)) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Este sistema no existe.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-accent">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }
  if (!proyecto || !sistema)
    return <div className="py-20 text-center text-muted">Cargando…</div>;

  const st = sistemaStats(sistema);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !proyecto || !sistema) return;
    const ids = sistema.puntos.map((p) => p.id);
    const desde = ids.indexOf(String(active.id));
    const hasta = ids.indexOf(String(over.id));
    if (desde < 0 || hasta < 0) return;
    reordenarPuntos(proyecto.id, sistema.id, arrayMove(ids, desde, hasta));
    setToast("Orden guardado");
  }

  function borrar(pt: Punto) {
    if (!proyecto || !sistema) return;
    if (!confirm(`¿Eliminar el punto "${pt.nombre}"? Se borrará su contenido.`))
      return;
    eliminarPunto(proyecto.id, sistema.id, pt.id);
    setToast("Punto eliminado");
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Proyectos", href: "/dashboard" },
          { label: proyecto.nombre, href: `/proyecto/${proyecto.id}` },
          { label: sistema.nombre },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {sistema.nombre}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {st.completos}/{st.total} puntos completos · {st.pct}%
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm(`¿Eliminar el sistema "${sistema.nombre}"?`))
              eliminarSistema(proyecto.id, sistema.id);
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Eliminar sistema
        </button>
      </div>

      <ProgressBar className="mt-4" pct={st.pct} />

      {sistema.puntos.length > 1 && (
        <p className="mt-4 text-xs text-muted">
          Arrastra desde <span className="font-medium">⠿</span> para reordenar ·
          el orden se guarda automáticamente
        </p>
      )}

      {/* Puntos de contacto */}
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {sistema.puntos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Este sistema aún no tiene puntos de contacto.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={sistema.puntos.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {sistema.puntos.map((pt, i) => (
                <FilaPunto
                  key={pt.id}
                  punto={pt}
                  posicion={i + 1}
                  href={`/proyecto/${proyecto.id}/sistema/${sistema.id}/punto/${pt.id}`}
                  onEliminar={() => borrar(pt)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Agregar punto */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nuevoPunto.trim()) return;
          agregarPunto(proyecto.id, sistema.id, nuevoPunto);
          setNuevoPunto("");
          setToast("Punto agregado");
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={nuevoPunto}
          onChange={(e) => setNuevoPunto(e.target.value)}
          placeholder="Nombre del nuevo punto de contacto"
          className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + Añadir punto
        </button>
      </form>

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function FilaPunto({
  punto,
  posicion,
  href,
  onEliminar,
}: {
  punto: Punto;
  posicion: number;
  href: string;
  onEliminar: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: punto.id });
  const completo = puntoCompleto(punto);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-surface px-3 py-4 transition-colors sm:px-4 ${
        isDragging ? "relative z-10 shadow-md" : "hover:bg-slate-50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Reordenar punto"
        title="Arrastrar para reordenar"
        className="shrink-0 cursor-grab touch-none rounded px-1 py-1 text-slate-300 transition-colors hover:text-slate-500 active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="w-4 shrink-0 text-center text-xs font-medium text-muted">
        {posicion}
      </span>

      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
            completo
              ? "bg-emerald-100 text-emerald-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {completo ? "✓" : "○"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{punto.nombre}</p>
          <p className="truncate text-xs text-muted">
            {completo ? punto.copy.slice(0, 80) : "Sin copy — vacío"}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 text-muted sm:flex">
          {punto.imagen && <span title="Imagen">🖼️</span>}
          {punto.video && <span title="Video">🎬</span>}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              completo
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {completo ? "Completo" : "Vacío"}
          </span>
        </div>
      </Link>

      <button
        onClick={onEliminar}
        aria-label="Eliminar punto"
        title="Eliminar punto"
        className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        🗑
      </button>
    </div>
  );
}
