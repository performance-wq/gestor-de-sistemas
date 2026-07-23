"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { subirAsset, urlFirmada } from "@/lib/storage";
import type { Proyecto } from "@/lib/types";

export function DatosControl({ proyecto }: { proyecto: Proyecto }) {
  const { actualizarProyecto } = useStore();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [vidUrl, setVidUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<"img" | "vid" | null>(null);

  const { evidenciaImagen, evidenciaVideo } = proyecto;

  useEffect(() => {
    let a = true;
    urlFirmada(evidenciaImagen).then((u) => a && setImgUrl(u));
    return () => {
      a = false;
    };
  }, [evidenciaImagen]);

  useEffect(() => {
    let a = true;
    urlFirmada(evidenciaVideo).then((u) => a && setVidUrl(u));
    return () => {
      a = false;
    };
  }, [evidenciaVideo]);

  const antes = proyecto.resultadoAntes ?? null;
  const con = proyecto.resultadoCon ?? null;
  const mejora =
    antes != null && con != null && antes !== 0
      ? Math.round(((con - antes) / Math.abs(antes)) * 100)
      : null;

  const inputCls =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  function setNum(campo: "resultadoAntes" | "resultadoCon", v: string) {
    const n = v === "" ? null : Number(v);
    actualizarProyecto(proyecto.id, {
      [campo]: n != null && isNaN(n) ? null : n,
    });
  }

  async function subir(
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: "img" | "vid",
  ) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    const max = tipo === "img" ? 10 : 100;
    if (file.size > max * 1024 * 1024) {
      alert(`El archivo debe pesar menos de ${max} MB.`);
      return;
    }
    setSubiendo(tipo);
    const path = await subirAsset(file, `${proyecto.id}/evidencia`);
    if (path)
      await actualizarProyecto(proyecto.id, {
        [tipo === "img" ? "evidenciaImagen" : "evidenciaVideo"]: path,
      });
    setSubiendo(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Datos de control del proyecto</h2>
      <p className="mt-1 text-sm text-muted">
        Mide el impacto del sistema implementado.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium">Resultado antes del CRM</h3>
          <input
            type="number"
            defaultValue={antes ?? ""}
            onBlur={(e) => setNum("resultadoAntes", e.target.value)}
            placeholder="¿Cuánto generaba antes?"
            className={`mt-2 ${inputCls}`}
          />
          <label className="mt-3 block text-xs text-muted">Fecha del dato</label>
          <input
            type="date"
            defaultValue={proyecto.resultadoAntesFecha ?? ""}
            onBlur={(e) =>
              actualizarProyecto(proyecto.id, {
                resultadoAntesFecha: e.target.value || null,
              })
            }
            className={`mt-1 ${inputCls}`}
          />
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium">Resultado con el CRM</h3>
          <input
            type="number"
            defaultValue={con ?? ""}
            onBlur={(e) => setNum("resultadoCon", e.target.value)}
            placeholder="¿Cuánto genera actualmente?"
            className={`mt-2 ${inputCls}`}
          />
          <label className="mt-3 block text-xs text-muted">Fecha del dato</label>
          <input
            type="date"
            defaultValue={proyecto.resultadoConFecha ?? ""}
            onBlur={(e) =>
              actualizarProyecto(proyecto.id, {
                resultadoConFecha: e.target.value || null,
              })
            }
            className={`mt-1 ${inputCls}`}
          />
        </div>
      </div>

      {mejora != null && (
        <div
          className={`mt-4 rounded-lg px-4 py-2.5 text-sm font-medium ${
            mejora >= 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          Impacto: {mejora >= 0 ? "+" : ""}
          {mejora}% con el CRM
        </div>
      )}

      {/* Evidencia */}
      <div className="mt-6">
        <h3 className="text-sm font-medium">Evidencia</h3>
        <p className="text-xs text-muted">
          Testimonio, captura, video del cliente o resultado documentado.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {/* Imagen */}
          <div>
            {evidenciaImagen && imgUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt="Evidencia"
                  className="max-h-56 w-full rounded-lg border border-border object-contain"
                />
                <button
                  onClick={() =>
                    actualizarProyecto(proyecto.id, { evidenciaImagen: undefined })
                  }
                  className="mt-2 text-sm font-medium text-red-600 hover:underline"
                >
                  Quitar imagen
                </button>
              </div>
            ) : (
              <button
                onClick={() => imgRef.current?.click()}
                disabled={subiendo === "img"}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <span className="text-2xl">🖼️</span>
                <span className="mt-1">
                  {subiendo === "img" ? "Subiendo…" : "Subir imagen"}
                </span>
              </button>
            )}
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              onChange={(e) => subir(e, "img")}
              className="hidden"
            />
          </div>

          {/* Video */}
          <div>
            {evidenciaVideo && vidUrl ? (
              <div>
                <video
                  src={vidUrl}
                  controls
                  className="w-full rounded-lg border border-border"
                />
                <button
                  onClick={() =>
                    actualizarProyecto(proyecto.id, { evidenciaVideo: undefined })
                  }
                  className="mt-2 text-sm font-medium text-red-600 hover:underline"
                >
                  Quitar video
                </button>
              </div>
            ) : (
              <button
                onClick={() => vidRef.current?.click()}
                disabled={subiendo === "vid"}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <span className="text-2xl">🎬</span>
                <span className="mt-1">
                  {subiendo === "vid" ? "Subiendo…" : "Subir video"}
                </span>
              </button>
            )}
            <input
              ref={vidRef}
              type="file"
              accept="video/*"
              onChange={(e) => subir(e, "vid")}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
