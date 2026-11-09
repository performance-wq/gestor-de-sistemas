"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "./Modal";
import { Toast } from "./Toast";
import { MediaCtx } from "./MediaCtx";
import { formatFechaHora } from "@/lib/ui";
import {
  SERVICIO_GENERAL,
  guionGeneral,
  guionServicio,
  respondido,
  textoParaIA,
  type ServicioCtx,
} from "@/lib/contexto";

const BASE = "/systemspex";

// Módulo "Contexto IA": un enlace por servicio para que el cliente responda,
// como en WhatsApp, las preguntas típicas de sus clientes. Alimenta la IA de GHL.
export function ContextoIA({
  proyectoId,
  proyectoNombre,
  puedeGestionar,
}: {
  proyectoId: string;
  proyectoNombre: string;
  puedeGestionar: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [servicios, setServicios] = useState<ServicioCtx[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoria, setCategoria] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [viendo, setViendo] = useState<ServicioCtx | null>(null);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const leer = useCallback(
    () =>
      supabase
        .from("contexto_servicios")
        .select("*")
        .eq("proyecto_id", proyectoId)
        .order("orden", { ascending: true })
        .order("creado_en", { ascending: true })
        .then(({ data, error }) => {
          if (error) console.error("Contexto IA:", error.message);
          return (data as ServicioCtx[]) ?? [];
        }),
    [supabase, proyectoId],
  );
  const cargar = useCallback(() => leer().then(setServicios), [leer]);

  useEffect(() => {
    let vivo = true;
    leer().then((lista) => {
      if (!vivo) return;
      setServicios(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [leer]);

  const enlace = (s: ServicioCtx) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}${BASE}/contexto/${s.token}`;

  async function copiarTexto(t: string, msg: string) {
    try {
      await navigator.clipboard.writeText(t);
      setToast(msg);
    } catch {
      setToast("No se pudo copiar automáticamente");
    }
  }

  async function crear(cat: string, nom: string, general = false) {
    setCreando(true);
    const { data, error } = await supabase
      .from("contexto_servicios")
      .insert({
        proyecto_id: proyectoId,
        categoria: cat,
        nombre: nom,
        turnos: general ? guionGeneral() : guionServicio(nom),
        orden: general ? 0 : servicios.length + 1,
      })
      .select("*")
      .single();
    setCreando(false);
    if (error || !data) {
      setToast("No se pudo crear el servicio");
      return;
    }
    setServicios((prev) => [...prev, data as ServicioCtx].sort((a, b) => a.orden - b.orden));
    await copiarTexto(enlace(data as ServicioCtx), "Servicio creado · enlace copiado");
  }

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await crear(categoria.trim(), nombre.trim());
    setNombre("");
  }

  async function reabrir(s: ServicioCtx) {
    const { error } = await supabase
      .from("contexto_servicios")
      .update({ estado: "pendiente", enviado_en: null })
      .eq("id", s.id);
    if (error) return setToast("No se pudo reabrir");
    setToast("Enlace reabierto: el cliente puede seguir editando");
    cargar();
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from("contexto_servicios").delete().eq("id", id);
    setBorrar(null);
    if (error) return setToast("No se pudo eliminar");
    setServicios((prev) => prev.filter((s) => s.id !== id));
    setToast("Servicio eliminado");
  }

  // Agrupar por categoría (respetando el orden).
  const grupos: { categoria: string; items: ServicioCtx[] }[] = [];
  for (const s of servicios) {
    const g = grupos.find((x) => x.categoria === s.categoria);
    if (g) g.items.push(s);
    else grupos.push({ categoria: s.categoria, items: [s] });
  }
  const categorias = Array.from(new Set(servicios.map((s) => s.categoria).filter(Boolean)));
  const tieneGeneral = servicios.some((s) => s.nombre === SERVICIO_GENERAL);
  const conRespuestas = servicios.some((s) => (s.turnos ?? []).some(respondido));
  const completos = servicios.filter((s) => s.estado === "completado").length;

  return (
    <div className="space-y-6">
      {/* Encabezado del módulo */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">💬</span>
              <h2 className="text-lg font-semibold">Contexto de IA</h2>
              {servicios.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {completos}/{servicios.length} enviados
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Agrega cada servicio del cliente y comparte su enlace. El cliente responde, como en WhatsApp, lo que
              sus clientes suelen preguntar (con fotos y videos). Con eso alineamos la IA en GoHighLevel.
            </p>
          </div>
          {conRespuestas && (
            <div className="flex flex-wrap gap-2">
              <a
                href={`${BASE}/imprimir-contexto/${proyectoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                ⬇️ PDF de todo
              </a>
              <button
                onClick={() => copiarTexto(textoParaIA(proyectoNombre, servicios), "Texto para la IA copiado")}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                📋 Copiar texto para la IA
              </button>
            </div>
          )}
        </div>

        {puedeGestionar && (
          <form onSubmit={onCrear} className="mt-5 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="ctx-categorias"
              placeholder="Categoría (ej. Cabello)"
              className="min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <datalist id="ctx-categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Servicio (ej. Corte de cabello)"
              className="min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={creando || !nombre.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {creando ? "Creando…" : "+ Agregar y generar enlace"}
            </button>
          </form>
        )}
        {puedeGestionar && !tieneGeneral && !cargando && (
          <button
            onClick={() => crear("General", SERVICIO_GENERAL, true)}
            disabled={creando}
            className="mt-2 text-sm font-medium text-accent hover:underline disabled:opacity-50"
          >
            + Agregar enlace de información general (horario, ubicación, pagos, cancelaciones)
          </button>
        )}
      </section>

      {/* Servicios */}
      {cargando ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : servicios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Todavía no hay servicios. Agrega el primero arriba (por ejemplo Cabello › Corte de cabello) y envía el enlace al
          cliente.
        </div>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria || "_"}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {g.categoria || "Sin categoría"}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {g.items.map((s) => {
                const n = (s.turnos ?? []).filter(respondido).length;
                const total = (s.turnos ?? []).length;
                const archivos = (s.turnos ?? []).reduce((a, t) => a + (t.archivos?.length ?? 0), 0);
                const enviado = s.estado === "completado";
                return (
                  <article key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold leading-tight">{s.nombre}</h4>
                        <p className="mt-0.5 text-xs text-muted">
                          {n}/{total} respuestas{archivos ? ` · ${archivos} archivo${archivos === 1 ? "" : "s"}` : ""}
                          {enviado && s.enviado_en ? ` · enviado ${formatFechaHora(s.enviado_en)}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          enviado
                            ? "bg-emerald-50 text-emerald-700"
                            : n > 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {enviado ? "Enviado" : n > 0 ? "En curso" : "Sin respuestas"}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => copiarTexto(enlace(s), "Enlace copiado")}
                        className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        Copiar enlace
                      </button>
                      <a
                        href={enlace(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      >
                        Abrir
                      </a>
                      <button
                        onClick={() => setViendo(s)}
                        disabled={n === 0}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                      >
                        Ver conversación
                      </button>
                      <a
                        href={`${BASE}/imprimir-contexto/${proyectoId}?s=${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={n === 0}
                        className={`rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 ${n === 0 ? "pointer-events-none opacity-40" : ""}`}
                      >
                        PDF
                      </a>
                      {puedeGestionar && enviado && (
                        <button
                          onClick={() => reabrir(s)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          Reabrir
                        </button>
                      )}
                      {puedeGestionar &&
                        (borrar === s.id ? (
                          <>
                            <button
                              onClick={() => eliminar(s.id)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Sí, eliminar
                            </button>
                            <button
                              onClick={() => setBorrar(null)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setBorrar(s.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Vista de la conversación */}
      <Modal
        abierto={!!viendo}
        onClose={() => setViendo(null)}
        titulo={viendo ? `${viendo.categoria ? viendo.categoria + " › " : ""}${viendo.nombre}` : ""}
        acciones={
          <button
            onClick={() => setViendo(null)}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Cerrar
          </button>
        }
      >
        {viendo && <Conversacion servicio={viendo} negocio={proyectoNombre} />}
      </Modal>

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export function Conversacion({ servicio, negocio }: { servicio: ServicioCtx; negocio: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-[#e9eeeb] p-4">
      {(servicio.turnos ?? []).map((t, i) => (
        <Fragment key={i}>
          <div className="flex max-w-[80%] flex-col items-start self-start">
            <span className="mx-2 mb-0.5 text-[11px] text-muted">Cliente{t.extra ? " · agregada por el negocio" : ""}</span>
            <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm shadow-sm">{t.cliente}</div>
          </div>
          {respondido(t) ? (
            <div className="flex max-w-[80%] flex-col items-end self-end">
              <span className="mx-2 mb-0.5 text-[11px] text-muted">{negocio}</span>
              {(t.negocio ?? "").trim() && (
                <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-[#d3ede4] px-3.5 py-2 text-sm shadow-sm">
                  {t.negocio}
                </div>
              )}
              {(t.archivos ?? []).length > 0 && (
                <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                  {t.archivos.map((a) => (
                    <MediaCtx key={a.path} archivo={a} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="self-end text-xs italic text-muted">Sin respuesta todavía</p>
          )}
        </Fragment>
      ))}
    </div>
  );
}
