"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore, type ProyectoArchivado } from "@/lib/store";
import { formatFechaHora } from "@/lib/ui";

// Papelera de proyectos archivados. Solo el administrador puede ver,
// restaurar o eliminar definitivamente.
export default function Papelera() {
  const { usuario, cargado, listarArchivados, restaurarProyecto, eliminarProyecto } =
    useStore();
  const router = useRouter();
  const esAdmin = usuario?.rol === "admin";

  const [items, setItems] = useState<ProyectoArchivado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<ProyectoArchivado | null>(null);
  const [confirmDel, setConfirmDel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cargado && !esAdmin) router.replace("/dashboard");
  }, [cargado, esAdmin, router]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setItems(await listarArchivados());
    setCargando(false);
  }, [listarArchivados]);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

  async function restaurar(id: string) {
    setAccion(id);
    setError(null);
    try {
      await restaurarProyecto(id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo restaurar.");
    } finally {
      setAccion(null);
    }
  }

  async function eliminarDef() {
    if (!borrar) return;
    setAccion(borrar.id);
    setError(null);
    try {
      await eliminarProyecto(borrar.id);
      setBorrar(null);
      setConfirmDel("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setAccion(null);
    }
  }

  if (cargado && !esAdmin)
    return (
      <div className="py-20 text-center text-sm text-muted">
        No tienes acceso a esta sección.
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Papelera</h1>
          <p className="mt-1 text-sm text-muted">
            Proyectos archivados. Puedes restaurarlos o eliminarlos
            definitivamente.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
        >
          ← Volver a proyectos
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        {cargando ? (
          <div className="py-16 text-center text-sm text-muted">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center text-sm text-muted">
            La papelera está vacía.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.nombre}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {p.cliente && <span>{p.cliente}</span>}
                    <span>· {p.estado}</span>
                    <span>· Archivado {formatFechaHora(p.archivadoEn)}</span>
                    {p.archivadoPorNombre && (
                      <span>· por {p.archivadoPorNombre}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => restaurar(p.id)}
                  disabled={accion === p.id}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  ♻ Restaurar
                </button>
                <button
                  onClick={() => {
                    setConfirmDel("");
                    setError(null);
                    setBorrar(p);
                  }}
                  disabled={accion === p.id}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Eliminar definitivamente
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmación de borrado permanente */}
      {borrar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setBorrar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-red-700">
              Eliminar definitivamente
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Esto borra para siempre{" "}
              <span className="font-medium text-foreground">
                “{borrar.nombre}”
              </span>{" "}
              y todo su contenido. <span className="font-medium">No se puede deshacer.</span>
            </p>
            <label className="mt-4 block text-sm font-medium">
              Para confirmar, escribe <span className="font-bold">ELIMINAR</span>
            </label>
            <input
              autoFocus
              value={confirmDel}
              onChange={(e) => setConfirmDel(e.target.value)}
              placeholder="ELIMINAR"
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setBorrar(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                disabled={
                  confirmDel.trim().toUpperCase() !== "ELIMINAR" ||
                  accion === borrar.id
                }
                onClick={eliminarDef}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar para siempre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
