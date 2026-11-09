"use client";

import { useEffect, useState } from "react";
import { urlFirmada } from "@/lib/storage";
import { esVideo, type ArchivoCtx } from "@/lib/contexto";

// Vista de una foto o video del Contexto IA (bucket privado → URL firmada).
export function MediaCtx({
  archivo,
  className = "max-h-56 max-w-[220px]",
}: {
  archivo: ArchivoCtx;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlFirmada(archivo.path).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [archivo.path]);

  if (!url)
    return (
      <div className={`flex h-24 w-32 items-center justify-center rounded-xl bg-slate-200 text-xs text-muted`}>
        Cargando…
      </div>
    );
  return esVideo(archivo) ? (
    <video src={url} controls playsInline preload="metadata" className={`rounded-xl bg-black ${className}`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={archivo.nombre} className={`rounded-xl object-cover ${className}`} />
  );
}
