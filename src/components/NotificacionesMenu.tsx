"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatFechaHora } from "@/lib/ui";
import {
  listarNotificaciones,
  marcarNotificacionesLeidas,
  type Notificacion,
} from "@/lib/tasks";

// Campana de notificaciones (Fase 9). Muestra las notificaciones del usuario
// (asignaciones, revisión, reapertura) con contador de no leídas.
export function NotificacionesMenu() {
  const [items, setItems] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setItems(await listarNotificaciones());
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [abierto]);

  const noLeidas = items.filter((n) => !n.leida).length;

  async function abrir() {
    const v = !abierto;
    setAbierto(v);
    if (v && noLeidas > 0) {
      await marcarNotificacionesLeidas();
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={abrir}
        aria-label="Notificaciones"
        className="relative rounded-lg px-2 py-1.5 text-lg text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
      >
        🔔
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
            Notificaciones
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                Sin notificaciones.
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className="border-b border-border px-4 py-2.5 text-sm last:border-0"
                >
                  <p>{n.texto}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatFechaHora(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
