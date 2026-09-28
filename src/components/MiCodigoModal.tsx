"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { miCodigoEstado, setMiCodigo } from "@/lib/tasks";

// Cada usuario define su código personal (mínimo 4 caracteres). Ese código
// se pide al tomar y al entregar tareas, como validación de que la persona
// realmente asume la responsabilidad. El código nunca se muestra.
export function MiCodigoModal({ onClose }: { onClose: () => void }) {
  const [tiene, setTiene] = useState<boolean | null>(null);
  const [codigo, setCodigo] = useState("");
  const [codigo2, setCodigo2] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    miCodigoEstado().then(setTiene);
  }, []);

  async function guardar() {
    setError(null);
    if (codigo.trim().length < 4) {
      setError("El código debe tener al menos 4 caracteres.");
      return;
    }
    if (codigo !== codigo2) {
      setError("Los códigos no coinciden.");
      return;
    }
    setGuardando(true);
    try {
      await setMiCodigo(codigo.trim());
      setOk(true);
      setTiene(true);
      setCodigo("");
      setCodigo2("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el código.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto onClose={onClose} titulo="Mi código de usuario" ancho="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {tiene
            ? "Ya tienes un código configurado. Puedes cambiarlo aquí."
            : "Configura tu código personal. Se te pedirá al tomar y al entregar tareas."}
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {tiene ? "Nuevo código" : "Código"}
          </label>
          <input
            type="password"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="new-password"
            placeholder="Mínimo 4 caracteres"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Repite el código</label>
          <input
            type="password"
            value={codigo2}
            onChange={(e) => setCodigo2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Código guardado.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
          >
            Cerrar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar código"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
