"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProgressBar } from "@/components/ProgressBar";
import { estadoStyles, formatFecha, formatFechaHora } from "@/lib/ui";
import type { ChecklistItem, Estado } from "@/lib/types";
import { bloques, contarHojas, estructurar, type Nodo } from "@/lib/checklist";

interface Tarea {
  orden: number;
  titulo: string;
  completado: boolean;
  completadoEn: string | null;
  esGrupo?: boolean;
  grupo?: string | null;
}
interface Datos {
  proyecto: string;
  cliente: string | null;
  estado: Estado;
  fechaIncorporacion: string;
  items: Tarea[];
}

export default function ProgresoPublico() {
  const { token } = useParams<{ token: string }>();
  const supabase = createClient();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<"cargando" | "ok" | "invalido">(
    "cargando",
  );

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("progreso_obtener", {
      p_token: token,
    });
    if (error || !data) {
      setEstado((e) => (e === "ok" ? "ok" : "invalido"));
      return;
    }
    setDatos(data as Datos);
    setEstado("ok");
  }, [supabase, token]);

  useEffect(() => {
    cargar();
    // Auto-refresco: refleja los cambios del equipo sin recargar.
    const t = setInterval(cargar, 25000);
    return () => clearInterval(t);
  }, [cargar]);

  if (estado === "cargando")
    return (
      <Centro>
        <p className="text-muted">Cargando el avance del proyecto…</p>
      </Centro>
    );

  if (estado === "invalido" || !datos)
    return (
      <Centro>
        <div className="text-4xl">🔒</div>
        <h1 className="mt-4 text-xl font-semibold">Enlace no disponible</h1>
        <p className="mt-2 max-w-md text-muted">
          Este enlace de seguimiento no es válido o fue desactivado. Solicita
          uno nuevo a tu equipo de Systems PEX.
        </p>
      </Centro>
    );

  const itemsCl: ChecklistItem[] = datos.items.map((t) => ({
    id: String(t.orden),
    categoria: "",
    titulo: t.titulo,
    orden: t.orden,
    completado: t.completado,
    esGrupo: !!t.esGrupo,
    grupo: t.grupo,
    completadoEn: t.completadoEn,
  }));
  const { total, completas, pendientes, pct } = contarHojas(itemsCl);
  const nodos = bloques(estructurar(itemsCl));
  const badge = estadoStyles[datos.estado];

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Marca */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight text-muted">
            Systems PEX
          </span>
        </div>

        {/* Encabezado */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">
            Avance del Proyecto
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {datos.proyecto}
          </h1>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {datos.cliente && (
              <Dato etiqueta="Cliente" valor={datos.cliente} />
            )}
            <Dato
              etiqueta="Incorporación"
              valor={formatFecha(datos.fechaIncorporacion)}
            />
            <div className="flex items-center gap-2">
              <dt className="text-muted">Estado:</dt>
              <dd>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.badge}`}
                >
                  {datos.estado}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <div className="mb-1.5 flex items-end justify-between">
              <span className="text-sm text-muted">
                {completas} de {total} tareas completadas
              </span>
              <span className="text-2xl font-semibold">{pct}%</span>
            </div>
            <ProgressBar pct={pct} color={badge.bar} />
            <div className="mt-2 flex gap-4 text-xs text-muted">
              <span>✓ {completas} completadas</span>
              <span>○ {pendientes} pendientes</span>
            </div>
          </div>
        </div>

        {/* Checklist jerárquico (solo lectura) */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <ul className="divide-y divide-border">
            {nodos.map((b) => (
              <li key={b.principal.item.id}>
                <TareaVista nodo={b.principal} />
                {b.subs.map((s) => (
                  <TareaVista key={s.item.id} nodo={s} sub />
                ))}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Este avance se actualiza automáticamente conforme tu equipo avanza en
          el proyecto.
        </p>
      </div>
    </div>
  );
}

// Fila de tarea de solo lectura, con sangría para subtareas y estilo de grupo.
function TareaVista({ nodo, sub }: { nodo: Nodo; sub?: boolean }) {
  const it = nodo.item;
  const grupo = it.esGrupo;
  return (
    <div
      className={`flex items-start gap-3 py-3 pr-4 sm:pr-5 ${
        sub ? "pl-10 sm:pl-12" : "pl-4 sm:pl-5"
      } ${grupo ? "bg-slate-50/60" : ""}`}
    >
      <span className="mt-0.5 w-7 shrink-0 text-right text-xs tabular-nums text-muted">
        {nodo.numero}
      </span>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          it.completado
            ? "bg-emerald-100 text-emerald-600"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {it.completado ? "✓" : grupo ? "•" : "○"}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            grupo
              ? `font-semibold ${it.completado ? "text-emerald-700" : "text-foreground"}`
              : it.completado
                ? "text-muted line-through"
                : "font-medium"
          }`}
        >
          {it.titulo}
        </p>
        {!grupo && it.completado && it.completadoEn && (
          <p className="mt-0.5 text-xs text-emerald-600">
            Completada · {formatFechaHora(it.completadoEn)}
          </p>
        )}
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted">{etiqueta}:</dt>
      <dd className="truncate font-medium">{valor}</dd>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
