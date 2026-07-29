"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem } from "@/lib/types";
import { ProgressBar } from "./ProgressBar";
import { CompartirAvance } from "./CompartirAvance";
import { formatFechaHora } from "@/lib/ui";
import {
  bloques,
  contarHojas,
  estructurar,
  recomputarGrupos,
  type Nodo,
} from "@/lib/checklist";

interface Fila {
  id: string;
  categoria: string;
  titulo: string;
  orden: number;
  completado: boolean;
  es_grupo: boolean;
  grupo: string | null;
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
    esGrupo: f.es_grupo,
    grupo: f.grupo,
    completadoPorNombre: f.completado_por_nombre,
    completadoEn: f.completado_en,
  };
}

const SELECT =
  "id, categoria, titulo, orden, completado, es_grupo, grupo, completado_por_nombre, completado_en";

// Checklist operativo interno (jerárquico). Módulo independiente:
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
      setItems(recomputarGrupos(((data as Fila[]) ?? []).map(map)));
      setCargado(true);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, proyectoId]);

  const { total, completas, pct } = contarHojas(items);
  const listaBloques = useMemo(
    () => bloques(estructurar(items)),
    [items],
  );

  async function toggle(item: ChecklistItem) {
    if (item.esGrupo) return; // los grupos se completan solos
    const nuevo = !item.completado;
    setItems((prev) =>
      recomputarGrupos(
        prev.map((i) => (i.id === item.id ? { ...i, completado: nuevo } : i)),
      ),
    );
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ completado: nuevo })
      .eq("id", item.id)
      .select(SELECT)
      .single();
    if (error) {
      setItems((prev) =>
        recomputarGrupos(
          prev.map((i) =>
            i.id === item.id ? { ...i, completado: !nuevo } : i,
          ),
        ),
      );
      return;
    }
    if (data)
      setItems((prev) =>
        recomputarGrupos(
          prev.map((i) => (i.id === item.id ? map(data as Fila) : i)),
        ),
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
              {completas} de {total} tareas completadas
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

      {/* Lista jerárquica en columnas (los bloques no se cortan) */}
      {abierto && (
        <div className="mt-5 [column-gap:2rem] columns-1 lg:columns-2">
          {listaBloques.map((b) => (
            <div key={b.principal.item.id} className="mb-3 break-inside-avoid">
              {b.principal.item.esGrupo ? (
                <CabeceraGrupo nodo={b.principal} />
              ) : (
                <FilaTarea
                  nodo={b.principal}
                  onToggle={() => toggle(b.principal.item)}
                />
              )}
              {b.subs.map((s) => (
                <FilaTarea
                  key={s.item.id}
                  nodo={s}
                  sub
                  onToggle={() => toggle(s.item)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Compartir avance con el cliente (vista pública de solo lectura) */}
      <CompartirAvance proyectoId={proyectoId} />
    </section>
  );
}

// Tarea marcable (principal suelta o subtarea).
function FilaTarea({
  nodo,
  sub,
  onToggle,
}: {
  nodo: Nodo;
  sub?: boolean;
  onToggle: () => void;
}) {
  const it = nodo.item;
  return (
    <button
      onClick={onToggle}
      title={
        it.completado && it.completadoPorNombre
          ? `${it.titulo} · Completado por ${it.completadoPorNombre}${
              it.completadoEn ? ` · ${formatFechaHora(it.completadoEn)}` : ""
            }`
          : it.titulo
      }
      className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition-colors hover:bg-slate-100 ${
        sub ? "pl-8" : "pl-2"
      } ${it.completado ? "text-muted" : ""}`}
    >
      <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted">
        {nodo.numero}
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
      <span className={`truncate ${it.completado ? "line-through" : ""}`}>
        {it.titulo}
      </span>
    </button>
  );
}

// Cabecera de grupo: no se marca a mano; refleja el roll-up de sus subtareas.
function CabeceraGrupo({ nodo }: { nodo: Nodo }) {
  const it = nodo.item;
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">
        {nodo.numero}
      </span>
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
          it.completado
            ? "bg-emerald-100 text-emerald-600"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {it.completado ? "✓" : "•"}
      </span>
      <span
        className={`text-sm font-semibold ${
          it.completado ? "text-emerald-700" : "text-foreground"
        }`}
      >
        {it.titulo}
      </span>
    </div>
  );
}
