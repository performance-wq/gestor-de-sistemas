"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { puntoCompleto, sistemaStats } from "@/lib/progress";
import { ProgressBar } from "@/components/ProgressBar";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function SistemaView() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const { cargado, getProyecto, agregarPunto, eliminarSistema } = useStore();
  const [nuevoPunto, setNuevoPunto] = useState("");

  const proyecto = getProyecto(id);
  const sistema = proyecto?.sistemas.find((s) => s.id === sid);

  if (cargado && (!proyecto || !sistema)) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Este sistema no existe.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }
  if (!proyecto || !sistema)
    return <div className="py-20 text-center text-muted">Cargando…</div>;

  const st = sistemaStats(sistema);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Proyectos", href: "/" },
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

      {/* Puntos de contacto */}
      <div className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {sistema.puntos.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Este sistema aún no tiene puntos de contacto.
          </p>
        )}
        {sistema.puntos.map((pt) => {
          const completo = puntoCompleto(pt);
          return (
            <Link
              key={pt.id}
              href={`/proyecto/${proyecto.id}/sistema/${sistema.id}/punto/${pt.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
            >
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
                <p className="truncate font-medium">{pt.nombre}</p>
                <p className="truncate text-xs text-muted">
                  {completo ? pt.copy.slice(0, 80) : "Sin copy — vacío"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-muted">
                {pt.imagen && <span title="Imagen">🖼️</span>}
                {pt.video && <span title="Video">🎬</span>}
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
          );
        })}
      </div>

      {/* Agregar punto */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nuevoPunto.trim()) return;
          agregarPunto(proyecto.id, sistema.id, nuevoPunto);
          setNuevoPunto("");
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
    </div>
  );
}
