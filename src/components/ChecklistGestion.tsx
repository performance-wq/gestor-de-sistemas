"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem } from "@/lib/types";
import { ProgressBar } from "./ProgressBar";
import { CompartirAvance } from "./CompartirAvance";
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

const SELECT =
  "id, categoria, titulo, orden, completado, completado_por_nombre, completado_en";

// Checklist operativo interno del proyecto. Módulo independiente:
// no toca onboarding, sistemas ni performance.
export function ChecklistGestion({ proyectoId }: { proyectoId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("checklist_items")
        .select(SELECT)
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

  const total = items.length;
  const completos = items.filter((i) => i.completado).length;
  const pct = total ? Math.round((completos / total) * 100) : 0;

  async function toggle(item: ChecklistItem) {
    const nuevo = !item.completado;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completado: nuevo } : i)),
    );
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ completado: nuevo })
      .eq("id", item.id)
      .select(SELECT)
      .single();
    if (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, completado: !nuevo } : i)),
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
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      {/* Resumen + control expandir/contraer */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">✅</span>
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Avance del Proyecto
            </h2>
            <p className="text-sm text-muted">
              {completos} de {total} tareas completadas
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-3 sm:max-w-md">
          <ProgressBar className="flex-1" pct={pct} />
          <span className="w-10 shrink-0 text-right text-sm font-semibold">
            {pct}%
          </span>
          <button
            onClick={() => setAbierto((v) => !v)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50"
          >
            {abierto ? "Ocultar" : "Ver checklist"}
          </button>
        </div>
      </div>

      {/* Lista única, numerada, en columnas balanceadas */}
      {abierto && (
        <ul className="mt-5 [column-gap:1.75rem] columns-1 sm:columns-2 lg:columns-4">
          {items.map((it) => (
            <li key={it.id} className="mb-2 break-inside-avoid">
              <button
                onClick={() => toggle(it)}
                title={
                  it.completado && it.completadoPorNombre
                    ? `${it.titulo} · Completado por ${it.completadoPorNombre}${
                        it.completadoEn
                          ? ` · ${formatFechaHora(it.completadoEn)}`
                          : ""
                      }`
                    : it.titulo
                }
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-slate-100 ${
                  it.completado ? "text-muted" : ""
                }`}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">
                  {it.orden}.
                </span>
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    it.completado
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {it.completado ? "✓" : ""}
                </span>
                <span
                  className={`truncate ${it.completado ? "line-through" : ""}`}
                >
                  {it.titulo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Compartir avance con el cliente (vista pública de solo lectura) */}
      <CompartirAvance proyectoId={proyectoId} />
    </section>
  );
}
