"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subirAsset } from "@/lib/storage";
import { MediaCtx } from "@/components/MediaCtx";
import {
  MAX_MB_CONTEXTO,
  esVideo,
  respondido,
  type ArchivoCtx,
  type Turno,
} from "@/lib/contexto";

type Fase = "cargando" | "invalido" | "chat" | "enviado" | "cerrado";

// Conversación simulada: el cliente final pregunta y el negocio responde
// como lo haría por WhatsApp. Lo completa nuestro cliente (sin cuenta).
export default function ContextoPage() {
  const { token } = useParams<{ token: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [fase, setFase] = useState<Fase>("cargando");
  const [info, setInfo] = useState({ proyecto: "", servicio: "", categoria: "" });
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState<ArchivoCtx[]>([]);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [nuevaPregunta, setNuevaPregunta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnosRef = useRef<Turno[]>([]);
  const sucioRef = useRef(false);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLTextAreaElement>(null);

  // ---------- Carga ----------
  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc("contexto_obtener", { p_token: token });
      if (e || !data) return setFase("invalido");
      const d = data as { proyecto: string; servicio: string; categoria: string; estado: string; turnos: Turno[] };
      setInfo({ proyecto: d.proyecto ?? "", servicio: d.servicio ?? "", categoria: d.categoria ?? "" });
      const t = (d.turnos ?? []).map((x) => ({ ...x, archivos: x.archivos ?? [] }));
      setTurnos(t);
      turnosRef.current = t;
      setFase(d.estado === "completado" ? "cerrado" : "chat");
    })();
  }, [supabase, token]);

  // ---------- Autoguardado ----------
  const guardar = useCallback(async () => {
    if (!sucioRef.current) return;
    sucioRef.current = false;
    setGuardando(true);
    const { error: e } = await supabase.rpc("contexto_guardar", {
      p_token: token,
      p_turnos: turnosRef.current,
    });
    if (e) sucioRef.current = true;
    setGuardando(false);
  }, [supabase, token]);

  useEffect(() => {
    if (fase !== "chat") return;
    const t = setTimeout(guardar, 900);
    return () => clearTimeout(t);
  }, [turnos, fase, guardar]);

  useEffect(() => {
    const alSalir = () => void guardar();
    window.addEventListener("pagehide", alSalir);
    return () => window.removeEventListener("pagehide", alSalir);
  }, [guardar]);

  function actualizar(t: Turno[]) {
    turnosRef.current = t;
    sucioRef.current = true;
    setTurnos(t);
  }

  const pendiente = turnos.findIndex((t) => !respondido(t));
  const objetivo = editIdx ?? pendiente;
  const hasta = pendiente === -1 ? turnos.length - 1 : pendiente;
  const hechas = turnos.filter(respondido).length;

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos.length, pendiente, escribiendo, fase]);

  // ---------- Acciones ----------
  function enviarRespuesta() {
    if (subiendo) return;
    const txt = texto.trim();
    if (!txt && !adjuntos.length) return txtRef.current?.focus();
    if (objetivo < 0) return;
    const eraEdicion = editIdx !== null;
    const nuevos = turnos.map((t, i) =>
      i === objetivo ? { ...t, negocio: txt, archivos: adjuntos } : t,
    );
    actualizar(nuevos);
    setTexto("");
    setAdjuntos([]);
    setEditIdx(null);
    if (!eraEdicion && nuevos.some((t) => !respondido(t))) {
      setEscribiendo(true);
      setTimeout(() => setEscribiendo(false), 700);
    }
  }

  function editar(i: number) {
    if (subiendo) return;
    setEditIdx(i);
    setTexto(turnos[i].negocio ?? "");
    setAdjuntos(turnos[i].archivos ?? []);
    setTimeout(() => txtRef.current?.focus(), 50);
  }

  function cancelarEdicion() {
    setEditIdx(null);
    setTexto("");
    setAdjuntos([]);
  }

  function quitarPregunta(i: number) {
    actualizar(turnos.filter((_, j) => j !== i));
  }

  function agregarPregunta(e: React.FormEvent) {
    e.preventDefault();
    const q = nuevaPregunta.trim();
    if (!q) return;
    actualizar([...turnos, { cliente: q, negocio: "", archivos: [], extra: true }]);
    setNuevaPregunta("");
    setEscribiendo(true);
    setTimeout(() => setEscribiendo(false), 600);
  }

  async function onFiles(lista: FileList | null) {
    if (!lista?.length) return;
    setError(null);
    const nuevos: ArchivoCtx[] = [];
    for (const file of Array.from(lista)) {
      if (!/^(image|video)\//.test(file.type)) {
        setError(`"${file.name}" no es una foto ni un video.`);
        continue;
      }
      if (file.size > MAX_MB_CONTEXTO * 1024 * 1024) {
        setError(`"${file.name}" pesa más de ${MAX_MB_CONTEXTO} MB.`);
        continue;
      }
      setSubiendo(file.name);
      const path = await subirAsset(file, `contexto/${token}`);
      if (path) nuevos.push({ path, nombre: file.name, tipo: file.type });
      else setError(`No se pudo subir "${file.name}". Intenta de nuevo.`);
    }
    setSubiendo(null);
    if (fileRef.current) fileRef.current.value = "";
    if (nuevos.length) setAdjuntos((prev) => [...prev, ...nuevos]);
  }

  async function enviarTodo() {
    setEnviando(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("contexto_enviar", {
      p_token: token,
      p_turnos: turnosRef.current,
    });
    setEnviando(false);
    if (e || data === false) {
      setError("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    sucioRef.current = false;
    setFase("enviado");
  }

  // ---------- Pantallas de estado ----------
  if (fase === "cargando") return <Centro><p className="text-muted">Cargando la conversación…</p></Centro>;

  if (fase === "invalido")
    return (
      <Centro>
        <div className="text-4xl">🔗</div>
        <h1 className="mt-4 text-xl font-semibold">Este enlace no es válido</h1>
        <p className="mt-2 text-muted">Verifica que copiaste el enlace completo o pídele uno nuevo a tu equipo.</p>
      </Centro>
    );

  if (fase === "enviado" || fase === "cerrado")
    return (
      <Centro>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h1 className="mt-5 text-2xl font-semibold">
          {fase === "enviado" ? "¡Gracias! Recibimos tu conversación" : "Esta conversación ya fue enviada"}
        </h1>
        <p className="mt-3 max-w-md text-muted">
          {fase === "enviado"
            ? `Con tus respuestas sobre “${info.servicio}” vamos a entrenar a tu asistente para que responda como tu negocio.`
            : "Si necesitas cambiar algo, escríbele a tu equipo de implementación."}
        </p>
        <p className="mt-6 text-xs text-muted">LexBrain</p>
      </Centro>
    );

  // ---------- Chat ----------
  const inicial = (info.proyecto || "N").trim()[0]?.toUpperCase();
  const enCurso = objetivo >= 0 && !escribiendo;

  return (
    <div className="flex h-dvh flex-col bg-[#e9eeeb]">
      {/* Encabezado tipo chat */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{info.servicio}</p>
            <p className="truncate text-xs text-muted">
              {info.proyecto}
              {info.categoria ? ` · ${info.categoria}` : ""} · Un cliente te está escribiendo
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {guardando ? <span className="text-accent">Guardando…</span> : `${hechas}/${turnos.length}`}
          </span>
        </div>
      </header>

      {/* Mensajes */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5 px-4 py-5">
          <div className="mx-auto mb-2 max-w-xl rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            <p className="font-semibold text-foreground">Cómo funciona</p>
            <p className="mt-1">
              Imagina que un cliente real te escribe por WhatsApp sobre <b>{info.servicio}</b>. Respóndele
              tal cual lo harías tú: con tus precios, tus palabras y, si quieres, con fotos o videos.
              Con esto enseñamos a tu asistente de IA a responder como tu negocio. Todo se guarda solo.
            </p>
          </div>

          {turnos.slice(0, hasta + 1).map((t, i) => {
            const ocultarSiguiente = escribiendo && i === hasta && pendiente !== -1;
            if (ocultarSiguiente) return null;
            return (
              <div key={i} className="flex flex-col gap-2.5">
                <div className="flex max-w-[85%] animate-[fadeIn_.3s_ease-out] flex-col items-start self-start sm:max-w-[70%]">
                  <span className="mx-2 mb-0.5 text-[11px] text-muted">Cliente</span>
                  <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-[15px] shadow-sm">
                    {t.cliente}
                  </div>
                  {t.extra && editIdx !== i && (
                    <button onClick={() => quitarPregunta(i)} className="mx-2 mt-1 text-xs font-medium text-red-600">
                      Quitar pregunta
                    </button>
                  )}
                </div>
                {respondido(t) && editIdx !== i && (
                  <div className="flex max-w-[85%] flex-col items-end self-end sm:max-w-[70%]">
                    <span className="mx-2 mb-0.5 text-[11px] text-muted">{info.proyecto || "Tu negocio"}</span>
                    {(t.negocio ?? "").trim() && (
                      <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-[#d3ede4] px-3.5 py-2 text-[15px] shadow-sm">
                        {t.negocio}
                      </div>
                    )}
                    {(t.archivos ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                        {t.archivos.map((a) => <MediaCtx key={a.path} archivo={a} />)}
                      </div>
                    )}
                    <button onClick={() => editar(i)} className="mx-2 mt-1 text-xs font-medium text-accent">
                      Editar respuesta
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {escribiendo && (
            <div className="flex gap-1 self-start rounded-2xl bg-white px-4 py-3 shadow-sm" aria-label="El cliente está escribiendo">
              {[0, 1, 2].map((k) => (
                <span key={k} className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" style={{ animationDelay: `${k * 150}ms` }} />
              ))}
            </div>
          )}

          {pendiente === -1 && editIdx === null && !escribiendo && (
            <div className="mx-auto mt-3 w-full max-w-xl space-y-3 rounded-2xl border border-border bg-surface p-4">
              <p className="font-semibold">¡Bien! Respondiste todas las preguntas.</p>
              <p className="text-sm text-muted">
                ¿Hay otra pregunta que tus clientes suelen hacer sobre este servicio? Escríbela como la escribiría el
                cliente y luego la respondes.
              </p>
              <form onSubmit={agregarPregunta} className="flex flex-wrap gap-2">
                <input
                  value={nuevaPregunta}
                  onChange={(e) => setNuevaPregunta(e.target.value)}
                  maxLength={300}
                  placeholder="Ej. ¿Sirve para cabello teñido?"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  Agregar pregunta
                </button>
              </form>
              <button
                onClick={enviarTodo}
                disabled={enviando}
                className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {enviando ? "Enviando…" : "Enviar conversación"}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
          <div ref={finRef} />
        </div>
      </main>

      {/* Caja de respuesta */}
      {enCurso && (
        <footer className="border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-3xl space-y-2 px-4 py-3">
            {editIdx !== null && (
              <p className="text-xs text-amber-700">
                Editando tu respuesta ·{" "}
                <button onClick={cancelarEdicion} className="font-medium underline">Cancelar</button>
              </p>
            )}
            {(adjuntos.length > 0 || subiendo) && (
              <div className="flex flex-wrap gap-2">
                {adjuntos.map((a, k) => (
                  <div key={a.path} className="relative">
                    <MediaCtx archivo={a} className="h-16 w-16" />
                    <button
                      onClick={() => setAdjuntos(adjuntos.filter((_, j) => j !== k))}
                      aria-label="Quitar archivo"
                      className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-foreground text-xs leading-5 text-white"
                    >
                      ×
                    </button>
                    {esVideo(a) && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">Video</span>}
                  </div>
                ))}
                {subiendo && (
                  <div className="flex h-16 items-center rounded-xl bg-slate-100 px-3 text-xs text-muted">
                    Subiendo {subiendo}…
                  </div>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={!!subiendo}
                title="Adjuntar foto o video"
                aria-label="Adjuntar foto o video"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-lg hover:bg-slate-50 disabled:opacity-50"
              >
                📎
              </button>
              <textarea
                ref={txtRef}
                value={texto}
                rows={1}
                onChange={(e) => {
                  setTexto(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
                    e.preventDefault();
                    enviarRespuesta();
                  }
                }}
                placeholder="Escribe tu respuesta…"
                aria-label="Tu respuesta"
                className="max-h-44 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-white px-4 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                onClick={enviarRespuesta}
                disabled={!!subiendo}
                aria-label="Enviar respuesta"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:opacity-90 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <p className="text-xs text-muted">Puedes adjuntar fotos o videos (hasta {MAX_MB_CONTEXTO} MB cada uno).</p>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">{children}</div>;
}
