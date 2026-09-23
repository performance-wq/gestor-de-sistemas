"use client";

import { useEffect, useRef, useState } from "react";
import { ArchivoPreview } from "./ArchivoPreview";
import { formatFechaHora } from "@/lib/ui";
import {
  seccionesDe,
  esTipoArchivo,
  acceptDe,
  MAX_MB,
  type ArchivoSubido,
  type Par,
  type Pregunta,
  type Respuesta,
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
const TIPOS_TEXTO_EDITABLES: TipoCampo[] = [
  "texto",
  "textarea",
  "url",
  "email",
  "tel",
];
const esTextoEditable = (t: TipoCampo) => TIPOS_TEXTO_EDITABLES.includes(t);

function etiquetaArchivo(t: TipoCampo): string {
  switch (t) {
    case "imagenes":
      return "imágenes";
    case "videos":
      return "videos";
    case "media":
      return "imágenes o videos";
    default:
      return "archivos";
  }
}

// Muestra las respuestas del cliente en las 5 secciones del formulario,
// cada una expandible/contraíble. Reutilizado en la vista previa (modal).
// Con `editable`, las respuestas de texto pueden corregirse y, si se pasa
// `onSubirArchivo`, también se pueden editar imágenes/videos/documentos
// (agregar y quitar) — todo con confirmación.
export function OnboardingRespuestas({
  respuestas,
  version = 1,
  editable = false,
  onGuardar,
  onSubirArchivo,
  ediciones,
}: {
  respuestas: Respuestas;
  version?: number;
  editable?: boolean;
  /** Guarda una respuesta editada (texto o lista de archivos). true si se guardó. */
  onGuardar?: (preguntaId: string, valor: Respuesta) => Promise<boolean>;
  /** Sube un archivo y devuelve su descriptor (para editar imágenes/videos). */
  onSubirArchivo?: (
    preguntaId: string,
    file: File,
  ) => Promise<ArchivoSubido | null>;
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
                    onSubirArchivo={onSubirArchivo}
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
  onSubirArchivo,
  ediciones,
}: {
  pregunta: Pregunta;
  valor: unknown;
  editable?: boolean;
  onGuardar?: (preguntaId: string, valor: Respuesta) => Promise<boolean>;
  onSubirArchivo?: (
    preguntaId: string,
    file: File,
  ) => Promise<ArchivoSubido | null>;
  ediciones?: Edicion[];
}) {
  const vacio = !tieneValor(valor);
  const esArchivo = esTipoArchivo(pregunta.tipo);
  const puedeEditar =
    !!editable &&
    !!onGuardar &&
    (esTextoEditable(pregunta.tipo) || (esArchivo && !!onSubirArchivo));

  const [modo, setModo] = useState<"ver" | "editar" | "confirmar">("ver");
  const [borrador, setBorrador] = useState("");
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Si cambian las respuestas desde fuera, volvemos a modo lectura.
  useEffect(() => {
    setModo("ver");
  }, [valor]);

  const ultima = ediciones && ediciones.length > 0 ? ediciones[0] : null;
  const maxArchivos = pregunta.cantidad ?? pregunta.maximo ?? 10;
  const maxMb = pregunta.maxMb ?? MAX_MB;

  function iniciarEdicion() {
    if (esArchivo) {
      setArchivos(Array.isArray(valor) ? ([...valor] as ArchivoSubido[]) : []);
    } else {
      setBorrador(typeof valor === "string" ? valor : "");
    }
    setError(null);
    setModo("editar");
  }

  async function onFiles(lista: FileList | null) {
    if (!lista?.length || !onSubirArchivo) return;
    setError(null);
    const espacio = maxArchivos - archivos.length;
    const nuevos: ArchivoSubido[] = [];
    for (const file of Array.from(lista).slice(0, espacio)) {
      if (file.size > maxMb * 1024 * 1024) {
        setError(`"${file.name}" pesa más de ${maxMb} MB.`);
        continue;
      }
      setSubiendo(file.name);
      const sub = await onSubirArchivo(pregunta.id, file);
      if (sub) nuevos.push(sub);
      else setError(`No se pudo subir "${file.name}".`);
    }
    setSubiendo(null);
    if (fileRef.current) fileRef.current.value = "";
    if (nuevos.length) setArchivos((a) => [...a, ...nuevos]);
  }

  async function confirmarGuardado() {
    if (!onGuardar) return;
    setGuardando(true);
    setError(null);
    const valorNuevo: Respuesta = esArchivo ? archivos : borrador.trim();
    const ok = await onGuardar(pregunta.id, valorNuevo);
    setGuardando(false);
    if (ok) setModo("ver");
    else {
      setError("No se pudo guardar. Intenta de nuevo.");
      setModo("editar");
    }
  }

  const bloqueado = modo === "confirmar" || guardando;

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
          {esArchivo ? (
            <div>
              {archivos.length > 0 ? (
                <div
                  className={
                    pregunta.tipo === "documentos"
                      ? "space-y-2"
                      : "grid grid-cols-2 gap-2 sm:grid-cols-3"
                  }
                >
                  {archivos.map((a, i) => (
                    <div key={a.path} className="relative">
                      <ArchivoPreview archivo={a} />
                      {!bloqueado && (
                        <button
                          onClick={() =>
                            setArchivos((arr) => arr.filter((_, j) => j !== i))
                          }
                          title="Quitar archivo"
                          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow hover:bg-red-700"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">Sin archivos</p>
              )}

              {!bloqueado && archivos.length < maxArchivos && (
                <div className="mt-2">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple={maxArchivos > 1}
                    accept={acceptDe(pregunta.tipo)}
                    onChange={(e) => onFiles(e.target.files)}
                    className="hidden"
                    id={`edit-file-${pregunta.id}`}
                  />
                  <label
                    htmlFor={`edit-file-${pregunta.id}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                  >
                    📎 Agregar {etiquetaArchivo(pregunta.tipo)}
                  </label>
                  <span className="ml-2 text-xs text-muted">
                    máx. {maxMb} MB · {archivos.length}/{maxArchivos}
                  </span>
                </div>
              )}
              {subiendo && (
                <p className="mt-1.5 text-xs text-muted">Subiendo {subiendo}…</p>
              )}
            </div>
          ) : pregunta.tipo === "textarea" ? (
            <textarea
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              rows={5}
              disabled={bloqueado}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />
          ) : (
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              disabled={bloqueado}
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
                disabled={!!subiendo}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
          ) : esArchivo ? (
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
