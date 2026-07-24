"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArchivoPreview } from "./ArchivoPreview";
import { Toast } from "./Toast";
import {
  SECCIONES,
  esTipoArchivo,
  type ArchivoSubido,
  type Par,
  type Pregunta,
  type Respuestas,
} from "@/lib/onboarding-schema";
import { formatFechaHora } from "@/lib/ui";

interface OnbRow {
  token: string;
  estado: "pendiente" | "completado";
  respuestas: Respuestas;
  enviado_en: string | null;
}

export function OnboardingPanel({ proyectoId }: { proyectoId: string }) {
  const supabase = createClient();
  const [row, setRow] = useState<OnbRow | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(SECCIONES[0].id);
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

  const completado = row?.estado === "completado";
  const tieneRespuestas =
    row && Object.keys(row.respuestas ?? {}).length > 0;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📋</span>
          <h2 className="text-lg font-semibold">Onboarding</h2>
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
          {/* Enlace */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
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

          {/* Respuestas */}
          {tieneRespuestas ? (
            <div className="mt-6 space-y-2.5">
              {SECCIONES.map((sec) => {
                const respondidas = sec.preguntas.filter((p) =>
                  tieneValor(row.respuestas[p.id]),
                ).length;
                const open = abierto === sec.id;
                return (
                  <div
                    key={sec.id}
                    className="overflow-hidden rounded-xl border border-border"
                  >
                    <button
                      onClick={() => setAbierto(open ? null : sec.id)}
                      className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                    >
                      <span className="font-medium">{sec.titulo}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {respondidas}/{sec.preguntas.length}
                        <span
                          className={`transition-transform ${open ? "rotate-90" : ""}`}
                        >
                          ›
                        </span>
                      </span>
                    </button>
                    {open && (
                      <div className="divide-y divide-border">
                        {sec.preguntas.map((p) => (
                          <RespuestaVista
                            key={p.id}
                            pregunta={p}
                            valor={row.respuestas[p.id]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Aún no hay respuestas. Comparte el enlace con el cliente.
            </p>
          )}
        </>
      )}

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </section>
  );
}

function tieneValor(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function RespuestaVista({
  pregunta,
  valor,
}: {
  pregunta: Pregunta;
  valor: unknown;
}) {
  const vacio = !tieneValor(valor);

  return (
    <div className="px-4 py-3.5">
      <p className="text-sm font-medium text-foreground">{pregunta.titulo}</p>
      <div className="mt-1.5 text-sm text-muted">
        {vacio ? (
          <span className="italic text-slate-400">Sin responder</span>
        ) : esTipoArchivo(pregunta.tipo) ? (
          <div
            className={
              pregunta.tipo === "documentos"
                ? "space-y-2"
                : "grid grid-cols-2 gap-2 sm:grid-cols-3"
            }
          >
            {(valor as ArchivoSubido[]).map((a) => (
              <ArchivoPreview key={a.path} archivo={a} />
            ))}
          </div>
        ) : pregunta.tipo === "lista" ? (
          <ol className="list-decimal space-y-0.5 pl-5">
            {(valor as string[])
              .filter((x) => x?.trim())
              .map((x, i) => (
                <li key={i}>{x}</li>
              ))}
          </ol>
        ) : pregunta.tipo === "lista_pares" ? (
          <ul className="space-y-2">
            {(valor as Par[])
              .filter((x) => x?.p?.trim())
              .map((x, i) => (
                <li key={i}>
                  <p className="font-medium text-foreground">{x.p}</p>
                  <p className="whitespace-pre-wrap">{x.r}</p>
                </li>
              ))}
          </ul>
        ) : pregunta.tipo === "url" ? (
          <a
            href={valor as string}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-accent underline underline-offset-2"
          >
            {valor as string}
          </a>
        ) : (
          <p className="whitespace-pre-wrap text-foreground/90">
            {valor as string}
          </p>
        )}
      </div>
    </div>
  );
}
