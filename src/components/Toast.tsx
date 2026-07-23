"use client";

import { useEffect } from "react";

// Notificación temporal, discreta, que no interrumpe el flujo.
export function Toast({
  mensaje,
  onClose,
}: {
  mensaje: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [mensaje, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-black/5">
        <span className="text-emerald-400">✓</span>
        {mensaje}
      </div>
    </div>
  );
}
