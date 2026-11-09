"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { urlFirmada } from "@/lib/storage";
import { formatFechaHora } from "@/lib/ui";
import { esVideo, respondido, type ServicioCtx } from "@/lib/contexto";

// Documento del Contexto IA listo para "Guardar como PDF".
// ?s=<servicioId> imprime un solo servicio; sin parámetro, todos.
export default function ImprimirContexto() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [proyecto, setProyecto] = useState("");
  const [servicios, setServicios] = useState<ServicioCtx[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [listo, setListo] = useState(false);

  useEffect(() => {
    (async () => {
      const soloId = new URLSearchParams(window.location.search).get("s");
      const { data: p } = await supabase.from("proyectos").select("nombre").eq("id", id).maybeSingle();
      setProyecto((p as { nombre?: string } | null)?.nombre ?? "");
      let q = supabase.from("contexto_servicios").select("*").eq("proyecto_id", id);
      if (soloId) q = q.eq("id", soloId);
      const { data } = await q.order("orden").order("creado_en");
      const lista = ((data as ServicioCtx[]) ?? []).filter((s) => (s.turnos ?? []).some(respondido));
      // URLs firmadas de las imágenes para incrustarlas en el PDF.
      const paths = lista.flatMap((s) => s.turnos.flatMap((t) => (t.archivos ?? []).filter((a) => !esVideo(a)).map((a) => a.path)));
      const pares = await Promise.all(paths.map(async (path) => [path, (await urlFirmada(path)) ?? ""] as const));
      setUrls(Object.fromEntries(pares));
      setServicios(lista);
    })();
  }, [supabase, id]);

  // Cuando todo (incluidas las imágenes) cargó, abre el diálogo de impresión.
  useEffect(() => {
    if (!servicios || listo) return;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
    Promise.all(
      imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))),
    ).then(() => {
      setListo(true);
      if (servicios.length) setTimeout(() => window.print(), 300);
    });
  }, [servicios, urls, listo]);

  if (!servicios) return <p className="p-10 text-center text-muted">Preparando el documento…</p>;

  const titulo = servicios.length === 1 ? servicios[0].nombre : "Contexto de IA";

  return (
    <div className="min-h-dvh bg-white text-[#16201c]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-6 py-3 print:hidden">
        <p className="text-sm text-muted">
          En el diálogo de impresión elige <b>“Guardar como PDF”</b> como destino.
        </p>
        <button onClick={() => window.print()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          ⬇️ Descargar PDF
        </button>
      </div>

      <div className="mx-auto max-w-[760px] px-8 py-10 print:px-0 print:py-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Conversaciones modelo para la IA · {proyecto}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-xs text-muted">Generado el {formatFechaHora(new Date().toISOString())}</p>

        {servicios.length === 0 && <p className="mt-10 text-muted">Todavía no hay respuestas para mostrar.</p>}

        {servicios.map((s) => (
          <section key={s.id} className="mt-8">
            <h2 className="border-b-2 border-accent pb-1 text-lg font-semibold [break-after:avoid]">
              {s.categoria ? <span className="text-muted">{s.categoria} › </span> : null}
              {s.nombre}
              <span className="ml-2 text-xs font-normal text-muted">
                {s.estado === "completado" ? "enviado" : "en curso"} · {s.turnos.filter(respondido).length}/{s.turnos.length}
              </span>
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {s.turnos.map((t, i) => (
                <Fragment key={i}>
                  <div className="flex max-w-[78%] flex-col items-start self-start [break-inside:avoid]">
                    <span className="mx-2 text-[10px] text-muted">Cliente</span>
                    <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-slate-200 bg-[#f3f5f4] px-3 py-1.5 text-[13px]">
                      {t.cliente}
                    </div>
                  </div>
                  {respondido(t) ? (
                    <div className="flex max-w-[78%] flex-col items-end self-end [break-inside:avoid]">
                      <span className="mx-2 text-[10px] text-muted">{proyecto}</span>
                      {(t.negocio ?? "").trim() && (
                        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-[#d3ede4] px-3 py-1.5 text-[13px]">
                          {t.negocio}
                        </div>
                      )}
                      {(t.archivos ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                          {t.archivos.map((a) =>
                            esVideo(a) ? (
                              <span key={a.path} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-muted">
                                🎥 Video adjunto: {a.nombre}
                              </span>
                            ) : urls[a.path] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={a.path} src={urls[a.path]} alt={a.nombre} className="max-h-48 max-w-[200px] rounded-lg" />
                            ) : null,
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="self-end text-[11px] italic text-muted">Sin respuesta todavía</p>
                  )}
                </Fragment>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
