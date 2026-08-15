"use client";

import { useEffect, useRef, useState } from "react";

type Tipo = "imagen" | "video-archivo" | "video-embed" | "video-link";

// Visor grande (modal) para previsualizar imagen o video de un punto de
// contacto junto con su copy. 100% aditivo: no toca guardado, descarga,
// reemplazo ni la información del punto.
export function VisorMedia({
  abierto,
  onClose,
  titulo,
  copy,
  tipo,
  url,
  embed,
  link,
  onDescargar,
}: {
  abierto: boolean;
  onClose: () => void;
  titulo?: string;
  copy: string;
  tipo: Tipo;
  url?: string | null;
  embed?: string | null;
  link?: string | null;
  onDescargar?: () => void;
}) {
  const esImagen = tipo === "imagen";
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const [arrastrando, setArrastrando] = useState(false);

  // Reinicia el zoom al abrir o cambiar de contenido.
  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [abierto, url]);

  // ESC para cerrar + bloquear scroll del fondo.
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

  const zoomA = (n: number) => {
    const s = Math.min(5, Math.max(1, n));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  };

  function onWheel(e: React.WheelEvent) {
    if (!esImagen) return;
    zoomA(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }
  function onPointerDown(e: React.PointerEvent) {
    if (!esImagen || scale === 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    setArrastrando(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPos({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  }
  function onPointerUp() {
    drag.current = null;
    setArrastrando(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <p className="min-w-0 truncate text-sm font-semibold">
            {titulo ?? "Vista previa"}
          </p>
          <div className="flex items-center gap-2">
            {onDescargar && (
              <button
                onClick={onDescargar}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50"
              >
                ⬇ Descargar
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg px-2 py-1 text-lg text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative flex-1 overflow-hidden bg-slate-900">
          {esImagen ? (
            <>
              <div
                onWheel={onWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                onClick={() => scale === 1 && zoomA(2)}
                className="flex h-full w-full items-center justify-center"
                style={{
                  cursor: scale > 1 ? (arrastrando ? "grabbing" : "grab") : "zoom-in",
                  touchAction: "none",
                }}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={titulo ?? ""}
                    draggable={false}
                    style={{
                      transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                      transition: arrastrando ? "none" : "transform .12s ease-out",
                    }}
                    className="max-h-full max-w-full select-none object-contain"
                  />
                ) : (
                  <p className="text-sm text-slate-300">Cargando imagen…</p>
                )}
              </div>

              {/* Controles de zoom */}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-white backdrop-blur">
                <button
                  onClick={() => zoomA(scale / 1.3)}
                  title="Alejar"
                  aria-label="Alejar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition-colors hover:bg-white/20"
                >
                  −
                </button>
                <span className="w-12 text-center text-xs tabular-nums">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => zoomA(scale * 1.3)}
                  title="Acercar"
                  aria-label="Acercar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition-colors hover:bg-white/20"
                >
                  +
                </button>
                <button
                  onClick={() => zoomA(1)}
                  title="Restablecer zoom"
                  className="ml-1 rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-white/20"
                >
                  Restablecer
                </button>
              </div>
            </>
          ) : tipo === "video-archivo" ? (
            <div className="flex h-full w-full items-center justify-center p-2">
              {url ? (
                <video
                  src={url}
                  controls
                  className="max-h-full max-w-full rounded-lg"
                />
              ) : (
                <p className="text-sm text-slate-300">Cargando video…</p>
              )}
            </div>
          ) : tipo === "video-embed" ? (
            <iframe
              src={embed ?? undefined}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6">
              <a
                href={link ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Abrir video ↗
              </a>
            </div>
          )}
        </div>

        {/* Copy */}
        <div className="max-h-[30%] shrink-0 overflow-y-auto border-t border-border bg-surface px-5 py-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            Copy
          </p>
          {copy.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {copy}
            </p>
          ) : (
            <p className="text-sm italic text-muted">
              Este punto aún no tiene copy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
