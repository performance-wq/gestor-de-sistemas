"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatFechaHora } from "@/lib/ui";
import { ProgressBar } from "./ProgressBar";
import { useStore } from "@/lib/store";
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
  const { usuario } = useStore();
  const esPropietario = usuario?.rol === "admin";
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [pendiente, setPendiente] = useState<{
    key: string;
    codigo: string;
    texto: string;
    rol: RolCalidad;
    revertir: boolean;
  } | null>(null);

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
      nota: cambios.nota !== undefined ? cambios.nota : (previa?.nota ?? null),
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
      setError(
        error.message.includes("propietario")
          ? "Solo el propietario puede revertir una verificación."
          : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.",
      );
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
              Primero lo pasa la implementadora y luego la supervisora, sistema
              por sistema.
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
      {CONTROL_CALIDAD.map((s, si) => {
        const abierto = !!abiertos[s.id];
        const req = s.puntos.filter((p) => !p.opcional);
        const okImp = req.filter(
          (p) => filas[k(p.key, "implementadora")]?.ok,
        ).length;
        const okSup = req.filter(
          (p) => filas[k(p.key, "supervisora")]?.ok,
        ).length;
        return (
          <section
            key={s.id}
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
          >
            <button
              onClick={() => setAbiertos((p) => ({ ...p, [s.id]: !p[s.id] }))}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <h3 className="flex items-center gap-2 font-semibold">
                <span
                  className={`text-xs text-muted transition-transform ${abierto ? "rotate-90" : ""}`}
                >
                  ▶
                </span>
                {s.nombre}
                {okSup === req.length && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    Aprobado
                  </span>
                )}
              </h3>
              <span className="text-xs text-muted">
                Implementadora {okImp}/{req.length} · Supervisora {okSup}/
                {req.length}
              </span>
            </button>

            {abierto && (
              <div className="border-t border-border">
                <div className="hidden grid-cols-[1fr_7.5rem_7.5rem] gap-2 border-b border-border bg-background/60 px-5 py-2 text-xs font-medium text-muted sm:grid">
                  <span>Punto a revisar</span>
                  {ROLES.map((r) => (
                    <span key={r.id} className="text-center">
                      {r.label}
                    </span>
                  ))}
                </div>

                <ul className="divide-y divide-border">
                  {s.puntos.map((p, pi) => {
                    const codigo = `${si + 1}.${pi + 1}`;
                    return (
                      <FilaPunto
                        key={p.key}
                        codigo={codigo}
                        punto={p}
                        filas={filas}
                        esPropietario={esPropietario}
                        onToggle={(rol) =>
                          setPendiente({
                            key: p.key,
                            codigo,
                            texto: p.texto,
                            rol,
                            revertir: !!filas[k(p.key, rol)]?.ok,
                          })
                        }
                      />
                    );
                  })}
                </ul>

                <Observacion
                  key={
                    filas[k(obsKey(s.id), "supervisora")]?.marcado_en ?? "nuevo"
                  }
                  valor={filas[k(obsKey(s.id), "supervisora")]?.nota ?? ""}
                  autor={filas[k(obsKey(s.id), "supervisora")]}
                  onGuardar={(nota) =>
                    guardar(obsKey(s.id), "supervisora", { nota: nota || null })
                  }
                />
              </div>
            )}
          </section>
        );
      })}

      {pendiente && (
        <ModalVerificar
          {...pendiente}
          onCancelar={() => setPendiente(null)}
          onConfirmar={() => {
            guardar(pendiente.key, pendiente.rol, {
              ok: !pendiente.revertir,
            });
            setPendiente(null);
          }}
        />
      )}
    </div>
  );
}

function ModalVerificar({
  codigo,
  texto,
  rol,
  revertir,
  onCancelar,
  onConfirmar,
}: {
  codigo: string;
  texto: string;
  rol: RolCalidad;
  revertir: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const [valor, setValor] = useState("");
  const coincide = valor.trim() === codigo;
  const quien = rol === "implementadora" ? "implementadora" : "supervisora";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">
          {revertir ? "Revertir verificación" : "Verificar punto"} {codigo}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {texto} · <span className="font-medium">{quien}</span>
        </p>
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            revertir
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {revertir
            ? "Como propietario puedes desmarcar esta verificación."
            : "Una vez verificado ya no se puede revertir. Solo el propietario puede desmarcarlo."}
        </p>
        <label className="mt-4 block text-sm font-medium">
          Para confirmar, escribe el código{" "}
          <span className="font-bold tabular-nums">{codigo}</span>
        </label>
        <input
          autoFocus
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && coincide) onConfirmar();
          }}
          placeholder={codigo}
          autoComplete="off"
          className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancelar}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            disabled={!coincide}
            onClick={onConfirmar}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              revertir ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            {revertir ? "Revertir" : "Verificar"}
          </button>
        </div>
      </div>
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
          {hechos}/{total} ·{" "}
          <span className="font-semibold text-foreground">{pct}%</span>
        </span>
      </div>
      <ProgressBar pct={pct} />
    </div>
  );
}

function FilaPunto({
  codigo,
  punto,
  filas,
  esPropietario,
  onToggle,
}: {
  codigo: string;
  punto: PuntoCalidad;
  filas: Record<string, Fila>;
  esPropietario: boolean;
  onToggle: (rol: RolCalidad) => void;
}) {
  return (
    <li className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_7.5rem_7.5rem] sm:items-center">
      <div className="flex min-w-0 gap-2.5">
        <span className="w-7 shrink-0 pt-px text-right text-xs font-semibold tabular-nums text-muted">
          {codigo}
        </span>
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
      </div>
      <div className="flex gap-2 sm:contents">
        {ROLES.map((r) => {
          const f = filas[k(punto.key, r.id)];
          const ok = !!f?.ok;
          const bloqueado = ok && !esPropietario;
          return (
            <div
              key={r.id}
              className="flex flex-1 flex-col items-stretch sm:flex-none"
            >
              <button
                onClick={() => !bloqueado && onToggle(r.id)}
                disabled={bloqueado}
                title={
                  ok && f?.marcado_por_nombre
                    ? `Verificado por ${f.marcado_por_nombre}${
                        f.marcado_en
                          ? ` · ${formatFechaHora(f.marcado_en)}`
                          : ""
                      }${bloqueado ? " · solo el propietario puede revertir" : ""}`
                    : `Verificar (${r.label})`
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
                <span className="hidden sm:inline">
                  {ok
                    ? bloqueado
                      ? "🔒 Verificado"
                      : "Verificado"
                    : "Pendiente"}
                </span>
              </button>
              {ok && f?.marcado_por_nombre && (
                <span className="mt-0.5 truncate text-center text-[10px] text-muted">
                  {f.marcado_por_nombre.split(" ")[0]}
                  {f.marcado_en ? ` · ${formatFechaHora(f.marcado_en)}` : ""}
                </span>
              )}
            </div>
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
