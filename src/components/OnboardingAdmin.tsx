"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "./Modal";
import { OnboardingRespuestas } from "./OnboardingRespuestas";
import { descargarOnboardingZip } from "@/lib/onboarding-export";
import type { Respuestas } from "@/lib/onboarding-schema";
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
  onReiniciado,
  onAviso,
}: {
  abierto: boolean;
  onClose: () => void;
  proyectoId: string;
  proyectoNombre: string;
  cliente?: string;
  estado: "pendiente" | "completado";
  respuestas: Respuestas;
  onReiniciado: () => void;
  onAviso: (m: string) => void;
}) {
  const supabase = createClient();
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [cargando, setCargando] = useState(true);
  const [confirmacion, setConfirmacion] = useState("");
  const [reiniciando, setReiniciando] = useState(false);
  const [verVersion, setVerVersion] = useState<Version | null>(null);

  const cargarVersiones = useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from("onboarding_versiones")
      .select(
        "id, version, respuestas, estado, enviado_en, archivado_en, archivado_por_nombre",
      )
      .eq("proyecto_id", proyectoId)
      .order("version", { ascending: false });
    setVersiones((data as Version[]) ?? []);
    setCargando(false);
  }, [supabase, proyectoId]);

  useEffect(() => {
    if (abierto) {
      cargarVersiones();
      setConfirmacion("");
    }
  }, [abierto, cargarVersiones]);

  const nRespuestas = Object.keys(respuestas ?? {}).length;
  const puedeReiniciar = confirmacion.trim() === PALABRA && !reiniciando;

  async function reiniciar() {
    if (!puedeReiniciar) return;
    setReiniciando(true);
    const { data, error } = await supabase.rpc("onboarding_reiniciar", {
      p_proyecto: proyectoId,
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
          <OnboardingRespuestas respuestas={verVersion.respuestas ?? {}} />
        )}
      </Modal>
    </>
  );
}
