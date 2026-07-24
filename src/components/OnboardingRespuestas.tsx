"use client";

import { useState } from "react";
import { ArchivoPreview } from "./ArchivoPreview";
import {
  SECCIONES,
  esTipoArchivo,
  type ArchivoSubido,
  type Par,
  type Pregunta,
  type Respuestas,
} from "@/lib/onboarding-schema";

export function tieneValor(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// Muestra las respuestas del cliente en las 5 secciones del formulario,
// cada una expandible/contraíble. Reutilizado en la vista previa (modal).
export function OnboardingRespuestas({
  respuestas,
}: {
  respuestas: Respuestas;
}) {
  const [abierto, setAbierto] = useState<string | null>(SECCIONES[0].id);

  return (
    <div className="space-y-2.5">
      {SECCIONES.map((sec) => {
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
