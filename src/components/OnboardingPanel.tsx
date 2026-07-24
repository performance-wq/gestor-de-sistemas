"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "./Modal";
import { Toast } from "./Toast";
import { OnboardingRespuestas } from "./OnboardingRespuestas";
import { descargarOnboardingZip } from "@/lib/onboarding-export";
import type { Respuestas } from "@/lib/onboarding-schema";
import { formatFechaHora } from "@/lib/ui";

interface OnbRow {
  token: string;
  estado: "pendiente" | "completado";
  respuestas: Respuestas;
  enviado_en: string | null;
}

export function OnboardingPanel({
  proyectoId,
  proyectoNombre,
  cliente,
}: {
  proyectoId: string;
  proyectoNombre: string;
  cliente?: string;
}) {
  const supabase = createClient();
  const [row, setRow] = useState<OnbRow | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [preview, setPreview] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("onboarding")
        .select("token, estado, respuestas, enviado_en")
        .eq("proyecto_id", proyectoId)
        .maybeSingle();
      setRow(data as OnbRow | null);
      setCargando(false);
    })();
  }, [supabase, proyectoId]);

  async function generarEnlace() {
    setGenerando(true);
    const { data, error } = await supabase.rpc("onboarding_asegurar", {
      p_proyecto: proyectoId,
    });
    setGenerando(false);
    if (error || !data) {
      setToast("No se pudo generar el enlace");
      return;
    }
    setRow(data as OnbRow);
    setToast("Enlace generado");
  }

  const enlace = row
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/systemspex/onboarding/${row.token}`
    : "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setToast("Enlace copiado");
    } catch {
      setToast("Copia el enlace manualmente");
    }
  }

  async function descargar() {
    if (!row) return;
    setDescargando("Preparando…");
    const { fallidos } = await descargarOnboardingZip(
      proyectoNombre,
      cliente,
      row.respuestas ?? {},
      (h, t) => setDescargando(t ? `Descargando archivos ${h}/${t}…` : null),
    );
    setDescargando(null);
    setToast(
      fallidos > 0
        ? `ZIP listo (${fallidos} archivo(s) no se pudieron incluir)`
        : "ZIP descargado",
    );
  }

  const completado = row?.estado === "completado";
  const tieneRespuestas = !!row && Object.keys(row.respuestas ?? {}).length > 0;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📋</span>
          <h2 className="text-lg font-semibold">Formulario de onboarding</h2>
          {row && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                completado
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {completado ? "Completado" : "Pendiente"}
            </span>
          )}
        </div>
        {completado && row?.enviado_en && (
          <span className="text-xs text-muted">
            Enviado el {formatFechaHora(row.enviado_en)}
          </span>
        )}
      </div>

      {cargando ? (
        <p className="mt-4 text-sm text-muted">Cargando…</p>
      ) : !row ? (
        <div className="mt-4">
          <p className="text-sm text-muted">
            Genera un enlace único para que el cliente complete su información.
          </p>
          <button
            onClick={generarEnlace}
            disabled={generando}
            className="mt-3 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {generando ? "Generando…" : "Generar enlace de onboarding"}
          </button>
        </div>
      ) : (
        <>
          {/* Enlace del formulario */}
          <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-muted">
            Link del formulario
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={enlace}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-muted outline-none"
            />
            <button
              onClick={copiar}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Copiar
            </button>
            <a
              href={enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
            >
              Abrir
            </a>
          </div>

          {/* Acciones sobre las respuestas */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreview(true)}
              disabled={!tieneRespuestas}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              👁️ Vista previa
            </button>
            <button
              onClick={descargar}
              disabled={!tieneRespuestas || !!descargando}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {descargando ?? "⬇️ Descargar (ZIP)"}
            </button>
            {!tieneRespuestas && (
              <span className="text-xs text-muted">
                Aún no hay respuestas. Comparte el enlace con el cliente.
              </span>
            )}
          </div>

          {tieneRespuestas && (
            <p className="mt-3 text-xs text-muted">
              El ZIP incluye <span className="font-medium">respuestas.md</span> y
              las carpetas de imágenes, videos y documentos — listo para usar con
              IA.
            </p>
          )}
        </>
      )}

      {/* Modal de vista previa */}
      <Modal
        abierto={preview}
        onClose={() => setPreview(false)}
        titulo={`Vista previa · ${proyectoNombre}`}
        acciones={
          <button
            onClick={() => setPreview(false)}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Cerrar
          </button>
        }
      >
        {row && <OnboardingRespuestas respuestas={row.respuestas ?? {}} />}
      </Modal>

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </section>
  );
}
