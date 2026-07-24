"use client";

import { useRef, useState } from "react";
import { subirAsset } from "@/lib/storage";
import {
  acceptDe,
  esTipoArchivo,
  MAX_MB,
  type ArchivoSubido,
  type Par,
  type Pregunta,
  type Respuesta,
} from "@/lib/onboarding-schema";

const inputCls =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-base outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15";

function tipoPermitido(pregunta: Pregunta, file: File) {
  const t = file.type || "";
  switch (pregunta.tipo) {
    case "imagenes":
      return t.startsWith("image/");
    case "videos":
      return t.startsWith("video/");
    case "media":
      return t.startsWith("image/") || t.startsWith("video/");
    default:
      return true;
  }
}

function etiquetaTipo(pregunta: Pregunta) {
  switch (pregunta.tipo) {
    case "imagenes":
      return "Solo imágenes";
    case "videos":
      return "Solo videos";
    case "media":
      return "Imágenes o videos";
    default:
      return "Documentos e imágenes";
  }
}

export function CampoOnboarding({
  pregunta,
  valor,
  onChange,
  token,
  onEnter,
}: {
  pregunta: Pregunta;
  valor: Respuesta;
  onChange: (v: Respuesta) => void;
  token: string;
  /** Enter avanza en los campos de una sola línea. */
  onEnter?: () => void;
}) {
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const enterHandler = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  // ---------- Texto largo ----------
  if (pregunta.tipo === "textarea") {
    return (
      <textarea
        autoFocus
        rows={5}
        value={(valor as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={pregunta.placeholder ?? "Escribe tu respuesta…"}
        className={`${inputCls} resize-y leading-relaxed`}
      />
    );
  }

  // ---------- Texto corto / enlace / correo / teléfono ----------
  if (["texto", "url", "email", "tel"].includes(pregunta.tipo)) {
    const tipoHtml =
      pregunta.tipo === "url"
        ? "url"
        : pregunta.tipo === "email"
          ? "email"
          : pregunta.tipo === "tel"
            ? "tel"
            : "text";
    return (
      <input
        autoFocus
        type={tipoHtml}
        inputMode={pregunta.tipo === "tel" ? "tel" : undefined}
        value={(valor as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterHandler}
        placeholder={
          pregunta.placeholder ??
          (pregunta.tipo === "url" ? "https://…" : "Escribe tu respuesta…")
        }
        className={inputCls}
      />
    );
  }

  // ---------- Lista de N respuestas ----------
  if (pregunta.tipo === "lista") {
    const n = pregunta.cantidad ?? 3;
    const items = (valor as string[]) ?? [];
    return (
      <div className="space-y-2.5">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-sm font-medium text-muted">
              {i + 1}.
            </span>
            <input
              autoFocus={i === 0}
              value={items[i] ?? ""}
              onChange={(e) => {
                const copia = [...items];
                while (copia.length < n) copia.push("");
                copia[i] = e.target.value;
                onChange(copia);
              }}
              placeholder={`Respuesta ${i + 1}`}
              className={inputCls}
            />
          </div>
        ))}
      </div>
    );
  }

  // ---------- Lista de N pares pregunta / respuesta ----------
  if (pregunta.tipo === "lista_pares") {
    const n = pregunta.cantidad ?? 3;
    const items = (valor as Par[]) ?? [];
    const set = (i: number, campo: "p" | "r", v: string) => {
      const copia = [...items];
      while (copia.length < n) copia.push({ p: "", r: "" });
      copia[i] = { ...copia[i], [campo]: v };
      onChange(copia);
    };
    return (
      <div className="space-y-3">
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white/60 p-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Pregunta {i + 1}
            </p>
            <input
              autoFocus={i === 0}
              value={items[i]?.p ?? ""}
              onChange={(e) => set(i, "p", e.target.value)}
              placeholder="¿Qué te preguntan?"
              className={`${inputCls} mb-2`}
            />
            <textarea
              rows={2}
              value={items[i]?.r ?? ""}
              onChange={(e) => set(i, "r", e.target.value)}
              placeholder="¿Qué respondes?"
              className={`${inputCls} resize-y`}
            />
          </div>
        ))}
      </div>
    );
  }

  // ---------- Archivos ----------
  if (esTipoArchivo(pregunta.tipo)) {
    const archivos = (valor as ArchivoSubido[]) ?? [];
    const limite = pregunta.cantidad ?? 10;
    const lleno = archivos.length >= limite;

    async function onFiles(lista: FileList | null) {
      if (!lista?.length) return;
      setErrorArchivo(null);
      const espacio = limite - archivos.length;
      const nuevos: ArchivoSubido[] = [];

      for (const file of Array.from(lista).slice(0, espacio)) {
        if (!tipoPermitido(pregunta, file)) {
          setErrorArchivo(
            `"${file.name}" no es un archivo válido aquí (${etiquetaTipo(pregunta).toLowerCase()}).`,
          );
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          setErrorArchivo(
            `"${file.name}" pesa más de ${MAX_MB} MB. Súbelo más ligero.`,
          );
          continue;
        }
        setSubiendo(file.name);
        const path = await subirAsset(
          file,
          `onboarding/${token}/${pregunta.id}`,
        );
        if (path)
          nuevos.push({ path, nombre: file.name, tipo: file.type || "" });
        else setErrorArchivo(`No se pudo subir "${file.name}". Intenta de nuevo.`);
      }

      setSubiendo(null);
      if (fileRef.current) fileRef.current.value = "";
      if (nuevos.length) onChange([...archivos, ...nuevos]);
    }

    return (
      <div>
        <input
          ref={fileRef}
          type="file"
          multiple={limite > 1}
          accept={acceptDe(pregunta.tipo)}
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
          id={`file-${pregunta.id}`}
        />

        <label
          htmlFor={`file-${pregunta.id}`}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            lleno
              ? "cursor-not-allowed border-border bg-slate-50 opacity-60"
              : "border-accent/30 bg-accent/5 hover:border-accent/60 hover:bg-accent/10"
          }`}
          onClick={(e) => {
            if (lleno) e.preventDefault();
          }}
        >
          <span className="text-2xl">📎</span>
          <span className="mt-2 text-sm font-medium">
            {lleno
              ? `Ya subiste ${limite} archivo${limite === 1 ? "" : "s"}`
              : "Haz clic para subir tus archivos"}
          </span>
          <span className="mt-1 text-xs text-muted">
            {etiquetaTipo(pregunta)} · máximo {MAX_MB} MB por archivo
            {pregunta.cantidad
              ? ` · ${archivos.length} de ${pregunta.cantidad}`
              : ""}
          </span>
        </label>

        {subiendo && (
          <p className="mt-3 text-sm text-accent">Subiendo “{subiendo}”…</p>
        )}
        {errorArchivo && (
          <p className="mt-3 text-sm text-red-600">{errorArchivo}</p>
        )}

        {archivos.length > 0 && (
          <ul className="mt-3 space-y-2">
            {archivos.map((a, i) => (
              <li
                key={a.path}
                className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5"
              >
                <span className="text-base">
                  {a.tipo.startsWith("image/")
                    ? "🖼️"
                    : a.tipo.startsWith("video/")
                      ? "🎬"
                      : "📄"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {a.nombre}
                </span>
                <span className="shrink-0 text-xs font-medium text-emerald-600">
                  ✓ subido
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(archivos.filter((_, j) => j !== i))
                  }
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 transition-colors hover:bg-red-50"
                  aria-label={`Quitar ${a.nombre}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return null;
}
