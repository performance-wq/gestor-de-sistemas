"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "./Modal";
import {
  OnboardingRespuestas,
  type Edicion,
} from "./OnboardingRespuestas";
import { descargarOnboardingZip } from "@/lib/onboarding-export";
import { subirAsset } from "@/lib/storage";
import type {
  ArchivoSubido,
  Respuesta,
  Respuestas,
} from "@/lib/onboarding-schema";
import { formatFechaHora } from "@/lib/ui";

export interface Version {
  id: string;
  version: number;
  respuestas: Respuestas;
  estado: string | null;
  enviado_en: string | null;
  archivado_en: string;
  archivado_por_nombre: string | null;
}

const PALABRA = "CONFIRMAR";

export function OnboardingAdmin({
  abierto,
  onClose,
  proyectoId,
  proyectoNombre,
  cliente,
  estado,
  respuestas,
  version = 1,
  onboardingId,
  token,
  onReiniciado,
  onActualizado,
  onAviso,
}: {
  abierto: boolean;
  onClose: () => void;
  proyectoId: string;
  proyectoNombre: string;
  cliente?: string;
  estado: "pendiente" | "completado";
  respuestas: Respuestas;
  version?: number;
  onboardingId: string;
  token: string;
  onReiniciado: () => void;
  onActualizado?: () => void;
  onAviso: (m: string) => void;
}) {
  const supabase = createClient();
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [cargando, setCargando] = useState(true);
  const [confirmacion, setConfirmacion] = useState("");
  const [reiniciando, setReiniciando] = useState(false);
  const [verVersion, setVerVersion] = useState<Version | null>(null);

  // Copia local de las respuestas (para reflejar ediciones al instante)
  // y el historial de ediciones manuales por pregunta.
  const [resp, setResp] = useState<Respuestas>(respuestas ?? {});
  const [ediciones, setEdiciones] = useState<Record<string, Edicion[]>>({});

  useEffect(() => {
    setResp(respuestas ?? {});
  }, [respuestas]);

  const cargarVersiones = useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from("onboarding_versiones")
      .select(
        "id, version, respuestas, estado, enviado_en, archivado_en, archivado_por_nombre",
      )
      .eq("onboarding_id", onboardingId)
      .order("version", { ascending: false });
    setVersiones((data as Version[]) ?? []);
    setCargando(false);
  }, [supabase, onboardingId]);

  const cargarEdiciones = useCallback(async () => {
    const { data } = await supabase
      .from("onboarding_ediciones")
      .select(
        "pregunta_id, valor_anterior, valor_nuevo, editado_por_nombre, editado_en",
      )
      .eq("onboarding_id", onboardingId)
      .order("editado_en", { ascending: false });
    const map: Record<string, Edicion[]> = {};
    for (const e of (data as Edicion[]) ?? []) {
      (map[e.pregunta_id] ??= []).push(e);
    }
    setEdiciones(map);
  }, [supabase, onboardingId]);

  useEffect(() => {
    if (abierto) {
      cargarVersiones();
      cargarEdiciones();
      setConfirmacion("");
    }
  }, [abierto, cargarVersiones, cargarEdiciones]);

  const nRespuestas = Object.keys(resp ?? {}).length;
  const tieneRespuestas = nRespuestas > 0;
  const puedeReiniciar = confirmacion.trim() === PALABRA && !reiniciando;

  async function editarRespuesta(
    preguntaId: string,
    valor: Respuesta,
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("onboarding_editar_respuesta", {
      p_proyecto: proyectoId,
      p_version: version,
      p_pregunta: preguntaId,
      p_valor: valor ?? null,
    });
    if (error) {
      onAviso("No se pudo guardar: " + error.message);
      return false;
    }
    if (data) setResp(data as Respuestas);
    await cargarEdiciones();
    onActualizado?.();
    onAviso("Respuesta actualizada");
    return true;
  }

  async function subirArchivoOnb(
    preguntaId: string,
    file: File,
  ): Promise<ArchivoSubido | null> {
    const path = await subirAsset(file, `onboarding/${token}/${preguntaId}`);
    if (!path) return null;
    return { path, nombre: file.name, tipo: file.type || "" };
  }

  async function reiniciar() {
    if (!puedeReiniciar) return;
    setReiniciando(true);
    const { data, error } = await supabase.rpc("onboarding_reiniciar", {
      p_proyecto: proyectoId,
      p_version: version,
    });
    setReiniciando(false);
    if (error) {
      onAviso("No se pudo reiniciar: " + error.message);
      return;
    }
    setConfirmacion("");
    await cargarVersiones();
    onReiniciado();
    const v = data as number;
    onAviso(
      v > 0
        ? `Respuestas reiniciadas · versión ${v} archivada`
        : "Respuestas reiniciadas",
    );
  }

  return (
    <>
      <Modal
        abierto={abierto && !verVersion}
        onClose={onClose}
        titulo="Administrar respuestas"
      >
        {/* Estado actual */}
        <div className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">Formulario actual</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                estado === "completado"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {estado === "completado" ? "Completado" : "Pendiente"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {nRespuestas > 0
              ? `${nRespuestas} respuestas guardadas.`
              : "Sin respuestas todavía."}
          </p>
        </div>

        {/* Respuestas recibidas (editables) */}
        {tieneRespuestas && (
          <div className="mt-5">
            <h3 className="font-medium">Respuestas recibidas</h3>
            <p className="mt-0.5 text-sm text-muted">
              Puedes corregir o completar una respuesta de texto. Cada cambio
              queda registrado (quién y cuándo) y el valor anterior se conserva.
            </p>
            <div className="mt-3">
              <OnboardingRespuestas
                respuestas={resp}
                version={version}
                editable
                onGuardar={editarRespuesta}
                onSubirArchivo={subirArchivoOnb}
                ediciones={ediciones}
              />
            </div>
          </div>
        )}

        {/* Historial */}
        <div className="mt-5">
          <h3 className="font-medium">Historial de versiones</h3>
          <p className="mt-0.5 text-sm text-muted">
            Cada reinicio archiva una copia. Nada se borra definitivamente.
          </p>

          {cargando ? (
            <p className="mt-3 text-sm text-muted">Cargando…</p>
          ) : versiones.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
              Aún no hay versiones archivadas.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {versiones.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                    v{v.version}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      Archivada el {formatFechaHora(v.archivado_en)}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {Object.keys(v.respuestas ?? {}).length} respuestas
                      {v.archivado_por_nombre
                        ? ` · por ${v.archivado_por_nombre}`
                        : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setVerVersion(v)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-slate-50"
                  >
                    Ver
                  </button>
                  <button
                    onClick={async () => {
                      onAviso("Preparando ZIP…");
                      await descargarOnboardingZip(
                        `${proyectoNombre} (v${v.version})`,
                        cliente,
                        v.respuestas ?? {},
                        undefined,
                        version,
                      );
                      onAviso("ZIP descargado");
                    }}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-slate-50"
                  >
                    Descargar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Zona crítica */}
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 p-4">
          <h3 className="font-medium text-red-700">Reiniciar respuestas</h3>
          <p className="mt-1.5 text-sm text-red-700/90">
            ¿Estás seguro de que deseas reiniciar todas las respuestas del
            formulario? Esta acción eliminará todas las respuestas actuales y el
            cliente deberá completar nuevamente el formulario.
          </p>
          <p className="mt-2 text-sm text-red-700/90">
            El enlace <span className="font-medium">seguirá siendo el mismo</span>{" "}
            y la versión actual quedará archivada en el historial.
          </p>

          <label className="mt-4 block text-sm font-medium text-red-700">
            Para continuar escribe <span className="font-bold">{PALABRA}</span>
          </label>
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={PALABRA}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          <button
            onClick={reiniciar}
            disabled={!puedeReiniciar}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {reiniciando ? "Reiniciando…" : "Reiniciar respuestas"}
          </button>
        </div>
      </Modal>

      {/* Vista de una versión archivada */}
      <Modal
        abierto={!!verVersion}
        onClose={() => setVerVersion(null)}
        titulo={`Versión ${verVersion?.version} · archivada`}
        acciones={
          <button
            onClick={() => setVerVersion(null)}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Volver
          </button>
        }
      >
        {verVersion && (
          <OnboardingRespuestas
            respuestas={verVersion.respuestas ?? {}}
            version={version}
          />
        )}
      </Modal>
    </>
  );
}
