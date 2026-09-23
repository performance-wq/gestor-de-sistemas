"use client";

import { useEffect, useState } from "react";
import { ArchivoPreview } from "./ArchivoPreview";
import { formatFechaHora } from "@/lib/ui";
import {
  seccionesDe,
  esTipoArchivo,
  type ArchivoSubido,
  type Par,
  type Pregunta,
  type Respuestas,
  type TipoCampo,
} from "@/lib/onboarding-schema";

export function tieneValor(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Una edición manual registrada para una respuesta. */
export interface Edicion {
  pregunta_id: string;
  valor_anterior: unknown;
  valor_nuevo: unknown;
  editado_por_nombre: string | null;
  editado_en: string;
}

// Tipos de respuesta que se pueden editar como texto desde el panel.
const TIPOS_EDITABLES: TipoCampo[] = ["texto", "textarea", "url", "email", "tel"];
const esEditableTipo = (t: TipoCampo) => TIPOS_EDITABLES.includes(t);

// Muestra las respuestas del cliente en las 5 secciones del formulario,
// cada una expandible/contraíble. Reutilizado en la vista previa (modal).
// Con `editable`, cada respuesta de texto puede corregirse (con confirmación).
export function OnboardingRespuestas({
  respuestas,
  version = 1,
  editable = false,
  onGuardar,
  ediciones,
}: {
  respuestas: Respuestas;
  version?: number;
  editable?: boolean;
  /** Guarda una respuesta editada. Devuelve true si se guardó. */
  onGuardar?: (preguntaId: string, valor: string) => Promise<boolean>;
  /** Historial de ediciones por pregunta. */
  ediciones?: Record<string, Edicion[]>;
}) {
  const secciones = seccionesDe(version);
  const [abierto, setAbierto] = useState<string | null>(secciones[0].id);

  return (
    <div className="space-y-2.5">
      {secciones.map((sec) => {
        const respondidas = sec.preguntas.filter((p) =>
          tieneValor(respuestas[p.id]),
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
                    valor={respuestas[p.id]}
                    editable={editable}
                    onGuardar={onGuardar}
                    ediciones={ediciones?.[p.id]}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RespuestaVista({
  pregunta,
  valor,
  editable,
  onGuardar,
  ediciones,
}: {
  pregunta: Pregunta;
  valor: unknown;
  editable?: boolean;
  onGuardar?: (preguntaId: string, valor: string) => Promise<boolean>;
  ediciones?: Edicion[];
}) {
  const vacio = !tieneValor(valor);
  const puedeEditar = !!editable && !!onGuardar && esEditableTipo(pregunta.tipo);

  const [modo, setModo] = useState<"ver" | "editar" | "confirmar">("ver");
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si cambian las respuestas desde fuera, volvemos a modo lectura.
  useEffect(() => {
    setModo("ver");
  }, [valor]);

  const ultima = ediciones && ediciones.length > 0 ? ediciones[0] : null;

  function iniciarEdicion() {
    setBorrador(typeof valor === "string" ? valor : "");
    setError(null);
    setModo("editar");
  }

  async function confirmarGuardado() {
    if (!onGuardar) return;
    setGuardando(true);
    setError(null);
    const ok = await onGuardar(pregunta.id, borrador.trim());
    setGuardando(false);
    if (ok) setModo("ver");
    else {
      setError("No se pudo guardar. Intenta de nuevo.");
      setModo("editar");
    }
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{pregunta.titulo}</p>
        {puedeEditar && modo === "ver" && (
          <button
            onClick={iniciarEdicion}
            className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
          >
            ✏️ Editar respuesta
          </button>
        )}
      </div>

      {/* Modo edición / confirmación */}
      {modo !== "ver" ? (
        <div className="mt-2">
          {pregunta.tipo === "textarea" ? (
            <textarea
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              rows={5}
              disabled={modo === "confirmar" || guardando}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />
          ) : (
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              disabled={modo === "confirmar" || guardando}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />
          )}

          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

          {modo === "editar" ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setModo("ver")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => setModo("confirmar")}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Guardar cambios
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-sm text-amber-800">
                ¿Deseas guardar los cambios realizados en esta respuesta?
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => setModo("editar")}
                  disabled={guardando}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarGuardado}
                  disabled={guardando}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Confirmar cambios"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
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
      )}

      {/* Registro de edición manual */}
      {ultima && modo === "ver" && (
        <p className="mt-2 text-xs text-slate-400">
          ✏️ Editado
          {ultima.editado_por_nombre ? ` por ${ultima.editado_por_nombre}` : ""} ·{" "}
          {formatFechaHora(ultima.editado_en)}
          {ediciones && ediciones.length > 1
            ? ` · ${ediciones.length} ediciones`
            : ""}
        </p>
      )}
    </div>
  );
}
