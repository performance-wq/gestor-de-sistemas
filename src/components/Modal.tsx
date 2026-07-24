"use client";

import { useEffect } from "react";

// Modal centrado con backdrop. Cierra con Esc o clic afuera y bloquea el scroll
// del fondo mientras está abierto.
export function Modal({
  abierto,
  onClose,
  titulo,
  children,
  acciones,
  ancho = "max-w-3xl",
}: {
  abierto: boolean;
  onClose: () => void;
  titulo?: React.ReactNode;
  children: React.ReactNode;
  acciones?: React.ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [abierto, onClose]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`my-4 w-full ${ancho} animate-[fadeIn_.2s_ease-out] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl`}
      >
        {(titulo || true) && (
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="min-w-0 font-semibold">{titulo}</div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-lg px-2 py-1 text-lg text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
        {acciones && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
            {acciones}
          </div>
        )}
      </div>
    </div>
  );
}
