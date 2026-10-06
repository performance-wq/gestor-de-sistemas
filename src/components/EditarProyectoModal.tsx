"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ESTADOS, NICHOS } from "@/lib/ui";
import { listarNichos, agregarNicho } from "@/lib/nichos";
import type { Estado, Proyecto } from "@/lib/types";

const AGREGAR = "__agregar__";

// Editar los datos básicos de un proyecto (solo gestores). No toca
// sistemas, onboarding, checklist ni resultados: solo nombre, cliente,
// nicho, estado, palabras clave y fechas.
export function EditarProyectoModal({
  proyecto,
  onClose,
}: {
  proyecto: Proyecto;
  onClose: () => void;
}) {
  const { actualizarProyecto } = useStore();
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [cliente, setCliente] = useState(proyecto.cliente ?? "");
  const [nicho, setNicho] = useState<string>(proyecto.nicho ?? "");
  const [nichos, setNichos] = useState<string[]>([...NICHOS]);
  const [nuevoNicho, setNuevoNicho] = useState("");
  const [agregandoNicho, setAgregandoNicho] = useState(false);
  const [estado, setEstado] = useState<Estado>(proyecto.estado);
  const [palabrasClave, setPalabrasClave] = useState(
    proyecto.palabrasClave ?? "",
  );
  const [fechaIncorporacion, setFechaInc] = useState(
    proyecto.fechaIncorporacion ?? "",
  );
  const [fechaCierre, setFechaCierre] = useState(proyecto.fechaCierre ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listarNichos().then((lista) => {
      // Asegura que el nicho actual (aunque sea custom) esté en la lista.
      if (
        proyecto.nicho &&
        !lista.some((n) => n.toLowerCase() === proyecto.nicho!.toLowerCase())
      ) {
        lista = [...lista, proyecto.nicho];
      }
      setNichos(lista);
    });
  }, [proyecto.nicho]);

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
    try {
      await actualizarProyecto(proyecto.id, {
        nombre: nombre.trim(),
        cliente: cliente.trim(),
        nicho,
        estado,
        palabrasClave: palabrasClave.trim(),
        fechaIncorporacion,
        fechaCierre,
      });
      onClose();
    } catch {
      setGuardando(false);
      setError("No se pudo guardar. Revisa tu sesión e inténtalo de nuevo.");
    }
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
        <h2 className="text-lg font-semibold">Editar proyecto</h2>
        <p className="mt-1 text-sm text-muted">
          Cambia los datos del proyecto. No afecta sistemas ni avance.
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
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Palabras clave{" "}
              <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              value={palabrasClave}
              onChange={(e) => setPalabrasClave(e.target.value)}
              placeholder="Para buscar el proyecto más fácil"
              className={inputCls}
            />
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
                onChange={(e) => setFechaInc(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Fecha de cierre{" "}
              <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              type="date"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              className={inputCls}
            />
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
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
