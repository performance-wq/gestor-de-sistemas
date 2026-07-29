"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "./Toast";

interface Enlace {
  token: string;
  activo: boolean;
}

// Panel para compartir el avance del proyecto con el cliente (solo lectura).
// Vive dentro del checklist; no duplica datos.
export function CompartirAvance({ proyectoId }: { proyectoId: string }) {
  const supabase = createClient();
  const [enlace, setEnlace] = useState<Enlace | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("progreso_enlaces")
        .select("token, activo")
        .eq("proyecto_id", proyectoId)
        .maybeSingle();
      if (!vivo) return;
      setEnlace(data as Enlace | null);
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, proyectoId]);

  const url = enlace
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/systemspex/progreso/${enlace.token}`
    : "";

  async function rpc(fn: string, args: Record<string, unknown>, msg: string) {
    setOcupado(true);
    const { data, error } = await supabase.rpc(fn, args);
    setOcupado(false);
    if (error) {
      setToast("No se pudo completar la acción");
      return;
    }
    setEnlace(data as Enlace);
    setToast(msg);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setToast("Enlace copiado");
    } catch {
      setToast("Copia el enlace manualmente");
    }
  }

  if (cargando) return null;

  const activo = enlace?.activo;

  return (
    <div className="mt-5 rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2">
        <span>🔗</span>
        <h3 className="text-sm font-semibold">Compartir avance con el cliente</h3>
        {enlace && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              activo
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {activo ? "Activo" : "Desactivado"}
          </span>
        )}
      </div>

      {!enlace ? (
        <div className="mt-3">
          <p className="text-sm text-muted">
            Genera un enlace público de solo lectura para que el cliente siga el
            avance de su proyecto.
          </p>
          <button
            onClick={() =>
              rpc("progreso_asegurar", { p_proyecto: proyectoId }, "Enlace generado")
            }
            disabled={ocupado}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Compartir avance con el cliente
          </button>
        </div>
      ) : (
        <>
          {activo ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted outline-none"
              />
              <button
                onClick={copiar}
                className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Copiar
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
              >
                Abrir
              </a>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Regenerar el enlace? El enlace anterior dejará de funcionar de inmediato.",
                    )
                  )
                    rpc(
                      "progreso_regenerar",
                      { p_proyecto: proyectoId },
                      "Enlace regenerado",
                    );
                }}
                disabled={ocupado}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Regenerar
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Desactivar el enlace? El cliente ya no podrá ver el avance hasta que lo reactives.",
                    )
                  )
                    rpc(
                      "progreso_set_activo",
                      { p_proyecto: proyectoId, p_activo: false },
                      "Enlace desactivado",
                    );
                }}
                disabled={ocupado}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                Desactivar
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-muted">
                El enlace está desactivado. El cliente no puede ver el avance.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    rpc(
                      "progreso_set_activo",
                      { p_proyecto: proyectoId, p_activo: true },
                      "Enlace reactivado",
                    )
                  }
                  disabled={ocupado}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Reactivar enlace
                </button>
                <button
                  onClick={() =>
                    rpc(
                      "progreso_regenerar",
                      { p_proyecto: proyectoId },
                      "Enlace regenerado",
                    )
                  }
                  disabled={ocupado}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  Regenerar
                </button>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-muted">
            Solo lectura · el cliente ve el avance sin poder modificarlo.
          </p>
        </>
      )}

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
