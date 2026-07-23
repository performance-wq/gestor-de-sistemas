"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ESTADOS, NICHOS } from "@/lib/ui";
import type { Estado } from "@/lib/types";

export function NuevoProyectoModal({ onClose }: { onClose: () => void }) {
  const { crearProyecto } = useStore();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [nicho, setNicho] = useState<string>("");
  const [estado, setEstado] = useState<Estado>("Pendiente");
  const [fechaIncorporacion, setFecha] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

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
              <select
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {NICHOS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
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
