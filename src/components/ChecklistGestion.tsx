"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem } from "@/lib/types";
import { ProgressBar } from "./ProgressBar";
import { formatFechaHora } from "@/lib/ui";

interface Fila {
  id: string;
  categoria: string;
  titulo: string;
  orden: number;
  completado: boolean;
  completado_por_nombre: string | null;
  completado_en: string | null;
}

function map(f: Fila): ChecklistItem {
  return {
    id: f.id,
    categoria: f.categoria,
    titulo: f.titulo,
    orden: f.orden,
    completado: f.completado,
    completadoPorNombre: f.completado_por_nombre,
    completadoEn: f.completado_en,
  };
}

// Checklist operativo interno del proyecto. Módulo independiente:
// no toca onboarding, sistemas ni performance.
export function ChecklistGestion({ proyectoId }: { proyectoId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("checklist_items")
        .select(
          "id, categoria, titulo, orden, completado, completado_por_nombre, completado_en",
        )
        .eq("proyecto_id", proyectoId)
        .order("orden", { ascending: true });
      if (!vivo) return;
      setItems(((data as Fila[]) ?? []).map(map));
      setCargado(true);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, proyectoId]);

  // Agrupar por categoría preservando el orden de aparición.
  const columnas = useMemo(() => {
    const grupos: { categoria: string; items: ChecklistItem[] }[] = [];
    for (const it of items) {
      let g = grupos.find((x) => x.categoria === it.categoria);
      if (!g) {
        g = { categoria: it.categoria, items: [] };
        grupos.push(g);
      }
      g.items.push(it);
    }
    return grupos;
  }, [items]);

  const total = items.length;
  const completos = items.filter((i) => i.completado).length;
  const pct = total ? Math.round((completos / total) * 100) : 0;

  async function toggle(item: ChecklistItem) {
    const nuevo = !item.completado;
    // Optimista.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completado: nuevo } : i)),
    );
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ completado: nuevo })
      .eq("id", item.id)
      .select(
        "id, categoria, titulo, orden, completado, completado_por_nombre, completado_en",
      )
      .single();
    if (error) {
      // Revertir en caso de fallo.
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, completado: !nuevo } : i,
        ),
      );
      return;
    }
    if (data)
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? map(data as Fila) : i)),
      );
  }

  if (!cargado)
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        Cargando checklist…
      </div>
    );

  if (total === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">✅</span>
          <h2 className="text-lg font-semibold">Checklist de gestión</h2>
        </div>
        <span className="text-sm text-muted">
          {completos}/{total} completados
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar className="flex-1" pct={pct} />
        <span className="w-10 shrink-0 text-right text-sm font-semibold">
          {pct}%
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {columnas.map((col) => {
          const hechos = col.items.filter((i) => i.completado).length;
          return (
            <div
              key={col.categoria}
              className="flex flex-col rounded-xl border border-border bg-background/50 p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight">
                  {col.categoria}
                </h3>
                <span className="shrink-0 text-xs text-muted">
                  {hechos}/{col.items.length}
                </span>
              </div>
              <ul className="space-y-1">
                {col.items.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => toggle(it)}
                      title={
                        it.completado && it.completadoPorNombre
                          ? `Completado por ${it.completadoPorNombre}${
                              it.completadoEn
                                ? ` · ${formatFechaHora(it.completadoEn)}`
                                : ""
                            }`
                          : "Marcar como completado"
                      }
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 ${
                        it.completado ? "text-muted" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                          it.completado
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {it.completado ? "✓" : ""}
                      </span>
                      <span
                        className={`leading-snug ${
                          it.completado ? "line-through" : ""
                        }`}
                      >
                        {it.titulo}
                      </span>
                    </button>
                    {it.completado && it.completadoPorNombre && (
                      <p className="pl-8 text-[11px] text-muted">
                        {it.completadoPorNombre}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
