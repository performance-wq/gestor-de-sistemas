"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ESTADOS, NICHOS } from "@/lib/ui";
import { listarNichos, agregarNicho } from "@/lib/nichos";
import type { Estado } from "@/lib/types";

const AGREGAR = "__agregar__";

export function NuevoProyectoModal({ onClose }: { onClose: () => void }) {
  const { crearProyecto } = useStore();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [nicho, setNicho] = useState<string>("");
  const [nichos, setNichos] = useState<string[]>([...NICHOS]);
  const [nuevoNicho, setNuevoNicho] = useState("");
  const [agregandoNicho, setAgregandoNicho] = useState(false);
  const [estado, setEstado] = useState<Estado>("Pendiente");
  const [fechaIncorporacion, setFecha] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listarNichos().then(setNichos);
  }, []);

  async function guardarNuevoNicho() {
    const canon = await agregarNicho(nuevoNicho, nichos);
    if (!canon) return;
    setNichos((prev) =>
      prev.some((n) => n.toLowerCase() === canon.toLowerCase())
        ? prev
        : [...prev, canon],
    );
    setNicho(canon);
    setNuevoNicho("");
    setAgregandoNicho(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    setError("");
    const p = await crearProyecto({
      nombre,
      estado,
      fechaIncorporacion,
      cliente,
      nicho,
    });
    if (!p) {
      setGuardando(false);
      setError(
        "No se pudo crear el proyecto. Revisa tu sesión e inténtalo de nuevo.",
      );
      return;
    }
    onClose();
    router.push(`/proyecto/${p.id}`);
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Nuevo proyecto</h2>
        <p className="mt-1 text-sm text-muted">
          Se cargarán automáticamente los sistemas de la plantilla.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Nombre del proyecto
            </label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Clínica Sonrisa"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Cliente</label>
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nicho</label>
              {agregandoNicho ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nuevoNicho}
                    onChange={(e) => setNuevoNicho(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        guardarNuevoNicho();
                      }
                      if (e.key === "Escape") setAgregandoNicho(false);
                    }}
                    placeholder="Nuevo nicho…"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={guardarNuevoNicho}
                    disabled={!nuevoNicho.trim()}
                    className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <select
                  value={nicho}
                  onChange={(e) => {
                    if (e.target.value === AGREGAR) {
                      setAgregandoNicho(true);
                      return;
                    }
                    setNicho(e.target.value);
                  }}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {nichos.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                  <option value={AGREGAR}>+ Agregar nuevo nicho…</option>
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as Estado)}
                className={inputCls}
              >
                {ESTADOS.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Incorporación
              </label>
              <input
                type="date"
                value={fechaIncorporacion}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nombre.trim() || guardando}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {guardando ? "Creando…" : "Crear proyecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
