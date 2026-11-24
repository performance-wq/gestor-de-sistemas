"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatFechaHora } from "@/lib/ui";
import { ProgressBar } from "./ProgressBar";
import {
  CONTROL_CALIDAD,
  PUNTOS_REQUERIDOS,
  obsKey,
  type PuntoCalidad,
  type RolCalidad,
} from "@/lib/control-calidad";

interface Fila {
  item_key: string;
  rol: RolCalidad;
  ok: boolean;
  nota: string | null;
  marcado_por_nombre: string | null;
  marcado_en: string | null;
}

const SELECT = "item_key, rol, ok, nota, marcado_por_nombre, marcado_en";
const k = (key: string, rol: RolCalidad) => `${rol}:${key}`;

const ROLES: { id: RolCalidad; label: string }[] = [
  { id: "implementadora", label: "Implementadora" },
  { id: "supervisora", label: "Supervisora" },
];

// Proceso "Control de calidad": doble checklist (implementadora y
// supervisora) sistema por sistema. Módulo independiente.
export function ControlCalidad({ proyectoId }: { proyectoId: string }) {
  const supabase = createClient();
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from("control_calidad")
        .select(SELECT)
        .eq("proyecto_id", proyectoId);
      if (!vivo) return;
      if (error) setError("No se pudo cargar el control de calidad.");
      const mapa: Record<string, Fila> = {};
      for (const f of (data as Fila[]) ?? []) mapa[k(f.item_key, f.rol)] = f;
      setFilas(mapa);
      setCargado(true);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, proyectoId]);

  async function guardar(
    key: string,
    rol: RolCalidad,
    cambios: { ok?: boolean; nota?: string | null },
  ) {
    const id = k(key, rol);
    const previa = filas[id];
    const optimista: Fila = {
      item_key: key,
      rol,
      ok: cambios.ok ?? previa?.ok ?? false,
      nota: cambios.nota !== undefined ? cambios.nota : previa?.nota ?? null,
      marcado_por_nombre: previa?.marcado_por_nombre ?? null,
      marcado_en: previa?.marcado_en ?? null,
    };
    setFilas((p) => ({ ...p, [id]: optimista }));
    setError(null);
    const { data, error } = await supabase
      .from("control_calidad")
      .upsert(
        {
          proyecto_id: proyectoId,
          item_key: key,
          rol,
          ok: optimista.ok,
          nota: optimista.nota,
        },
        { onConflict: "proyecto_id,item_key,rol" },
      )
      .select(SELECT)
      .single();
    if (error) {
      setFilas((p) => {
        const n = { ...p };
        if (previa) n[id] = previa;
        else delete n[id];
        return n;
      });
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    if (data) setFilas((p) => ({ ...p, [id]: data as Fila }));
  }

  const avance = useMemo(() => {
    const total = PUNTOS_REQUERIDOS.length;
    const de = (rol: RolCalidad) =>
      PUNTOS_REQUERIDOS.filter((p) => filas[k(p.key, rol)]?.ok).length;
    const imp = de("implementadora");
    const sup = de("supervisora");
    return {
      total,
      imp,
      sup,
      pctImp: total ? Math.round((imp / total) * 100) : 0,
      pctSup: total ? Math.round((sup / total) * 100) : 0,
    };
  }, [filas]);

  if (!cargado)
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        Cargando control de calidad…
      </div>
    );

  const estado =
    avance.sup === avance.total
      ? {
          txt: "Aprobado · ya se puede enviar el link de agenda de la 2.ª sesión",
          cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
        }
      : avance.imp === avance.total
        ? {
            txt: "Listo para la supervisora · mueve la oportunidad a «6. Control de calidad»",
            cls: "bg-amber-50 text-amber-700 border-amber-200",
          }
        : {
            txt: "En revisión de la implementadora",
            cls: "bg-slate-50 text-slate-600 border-border",
          };

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🛡️</span>
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Control de calidad
            </h2>
            <p className="text-sm text-muted">
              Primero lo pasa la implementadora y luego la supervisora,
              sistema por sistema.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Barra
            label="Implementadora"
            hechos={avance.imp}
            total={avance.total}
            pct={avance.pctImp}
          />
          <Barra
            label="Supervisora"
            hechos={avance.sup}
            total={avance.total}
            pct={avance.pctSup}
          />
        </div>
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm font-medium ${estado.cls}`}
        >
          {estado.txt}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {/* Sistemas */}
      {CONTROL_CALIDAD.map((s) => {
        const req = s.puntos.filter((p) => !p.opcional);
        const okImp = req.filter((p) => filas[k(p.key, "implementadora")]?.ok).length;
        const okSup = req.filter((p) => filas[k(p.key, "supervisora")]?.ok).length;
        return (
          <section
            key={s.id}
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h3 className="font-semibold">{s.nombre}</h3>
              <span className="text-xs text-muted">
                Implementadora {okImp}/{req.length} · Supervisora {okSup}/
                {req.length}
              </span>
            </div>

            <div className="hidden grid-cols-[1fr_7.5rem_7.5rem] gap-2 border-b border-border bg-background/60 px-5 py-2 text-xs font-medium text-muted sm:grid">
              <span>Punto a revisar</span>
              {ROLES.map((r) => (
                <span key={r.id} className="text-center">
                  {r.label}
                </span>
              ))}
            </div>

            <ul className="divide-y divide-border">
              {s.puntos.map((p) => (
                <FilaPunto
                  key={p.key}
                  punto={p}
                  filas={filas}
                  onToggle={(rol) =>
                    guardar(p.key, rol, { ok: !filas[k(p.key, rol)]?.ok })
                  }
                />
              ))}
            </ul>

            <Observacion
              key={filas[k(obsKey(s.id), "supervisora")]?.marcado_en ?? "nuevo"}
              valor={filas[k(obsKey(s.id), "supervisora")]?.nota ?? ""}
              autor={filas[k(obsKey(s.id), "supervisora")]}
              onGuardar={(nota) =>
                guardar(obsKey(s.id), "supervisora", { nota: nota || null })
              }
            />
          </section>
        );
      })}
    </div>
  );
}

function Barra({
  label,
  hechos,
  total,
  pct,
}: {
  label: string;
  hechos: number;
  total: number;
  pct: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {hechos}/{total} · <span className="font-semibold text-foreground">{pct}%</span>
        </span>
      </div>
      <ProgressBar pct={pct} />
    </div>
  );
}

function FilaPunto({
  punto,
  filas,
  onToggle,
}: {
  punto: PuntoCalidad;
  filas: Record<string, Fila>;
  onToggle: (rol: RolCalidad) => void;
}) {
  return (
    <li className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_7.5rem_7.5rem] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {punto.texto}
          {punto.opcional && (
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-muted">
              opcional
            </span>
          )}
        </p>
        {punto.detalle && (
          <p className="mt-0.5 text-xs text-muted">{punto.detalle}</p>
        )}
      </div>
      <div className="flex gap-2 sm:contents">
        {ROLES.map((r) => {
          const f = filas[k(punto.key, r.id)];
          const ok = !!f?.ok;
          return (
            <button
              key={r.id}
              onClick={() => onToggle(r.id)}
              title={
                ok && f?.marcado_por_nombre
                  ? `Revisado por ${f.marcado_por_nombre}${
                      f.marcado_en ? ` · ${formatFechaHora(f.marcado_en)}` : ""
                    }`
                  : `Marcar como revisado (${r.label})`
              }
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                ok
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-border bg-white text-muted hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                  ok
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {ok ? "✓" : ""}
              </span>
              <span className="sm:hidden">{r.label}</span>
              <span className="hidden sm:inline">{ok ? "Revisado" : "Pendiente"}</span>
            </button>
          );
        })}
      </div>
    </li>
  );
}

function Observacion({
  valor,
  autor,
  onGuardar,
}: {
  valor: string;
  autor?: Fila;
  onGuardar: (nota: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  return (
    <div className="border-t border-border bg-background/40 px-5 py-3">
      <label className="text-xs font-medium text-muted">
        Observaciones de la supervisora
      </label>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          if (texto.trim() !== valor.trim()) onGuardar(texto.trim());
        }}
        rows={2}
        placeholder="Qué debe corregir la implementadora en este sistema…"
        className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {autor?.nota && autor.marcado_por_nombre && (
        <p className="mt-1 text-[11px] text-muted">
          {autor.marcado_por_nombre}
          {autor.marcado_en ? ` · ${formatFechaHora(autor.marcado_en)}` : ""}
        </p>
      )}
    </div>
  );
}
