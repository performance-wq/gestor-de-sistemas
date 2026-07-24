"use client";

import { useEffect, useState } from "react";
import { urlFirmada } from "@/lib/storage";
import { descargarArchivo } from "@/lib/download";
import type { ArchivoSubido } from "@/lib/onboarding-schema";

// Muestra un archivo subido por el cliente: miniatura para imágenes, reproductor
// para videos, y enlace abrir/descargar para documentos. Usa URLs firmadas.
export function ArchivoPreview({ archivo }: { archivo: ArchivoSubido }) {
  const [url, setUrl] = useState<string | null>(null);
  const esImagen = archivo.tipo.startsWith("image/");
  const esVideo = archivo.tipo.startsWith("video/");

  useEffect(() => {
    let vivo = true;
    urlFirmada(archivo.path).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [archivo.path]);

  if (esImagen) {
    return (
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-lg border border-border bg-slate-50"
        title={archivo.nombre}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={archivo.nombre}
            className="h-28 w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-28 items-center justify-center text-xs text-muted">
            Cargando…
          </div>
        )}
      </a>
    );
  }

  if (esVideo) {
    return url ? (
      <video
        src={url}
        controls
        className="w-full rounded-lg border border-border bg-black"
      />
    ) : (
      <div className="flex h-28 items-center justify-center rounded-lg border border-border text-xs text-muted">
        Cargando video…
      </div>
    );
  }

  // Documento
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5">
      <span className="text-lg">📄</span>
      <span className="min-w-0 flex-1 truncate text-sm">{archivo.nombre}</span>
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
      >
        Abrir
      </a>
      <button
        onClick={() => url && descargarArchivo(url, archivo.nombre)}
        disabled={!url}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-slate-100 disabled:opacity-50"
      >
        Descargar
      </button>
    </div>
  );
}
