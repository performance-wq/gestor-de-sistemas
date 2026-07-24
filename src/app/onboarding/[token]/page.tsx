"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CampoOnboarding } from "@/components/CampoOnboarding";
import {
  PREGUNTAS_PLANAS,
  validar,
  type Respuesta,
  type Respuestas,
} from "@/lib/onboarding-schema";

type Fase = "cargando" | "invalido" | "intro" | "form" | "enviado" | "cerrado";

export default function OnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const supabase = createClient();

  const [fase, setFase] = useState<Fase>("cargando");
  const [proyecto, setProyecto] = useState("");
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const total = PREGUNTAS_PLANAS.length;
  const pregunta = PREGUNTAS_PLANAS[paso];
  const respuestasRef = useRef<Respuestas>({});
  const sucioRef = useRef(false);

  // ---------- Carga inicial ----------
  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc("onboarding_obtener", {
        p_token: token,
      });
      if (e || !data) {
        setFase("invalido");
        return;
      }
      const d = data as {
        proyecto: string;
        estado: string;
        respuestas: Respuestas;
      };
      setProyecto(d.proyecto ?? "");
      const guardadas = d.respuestas ?? {};
      setRespuestas(guardadas);
      respuestasRef.current = guardadas;
      if (d.estado === "completado") {
        setFase("cerrado");
        return;
      }
      // Retomar donde quedó.
      const pendiente = PREGUNTAS_PLANAS.findIndex(
        (p) => validar(p, guardadas[p.id]) !== null,
      );
      setPaso(pendiente < 0 ? total - 1 : pendiente);
      setFase("intro");
    })();
  }, [supabase, token, total]);

  // ---------- Autoguardado ----------
  const guardar = useCallback(async () => {
    if (!sucioRef.current) return;
    sucioRef.current = false;
    setGuardando(true);
    await supabase.rpc("onboarding_guardar", {
      p_token: token,
      p_respuestas: respuestasRef.current,
    });
    setGuardando(false);
  }, [supabase, token]);

  useEffect(() => {
    if (fase !== "form" && fase !== "intro") return;
    const t = setTimeout(guardar, 1200);
    return () => clearTimeout(t);
  }, [respuestas, fase, guardar]);

  // Guardar también al cerrar o cambiar de pestaña.
  useEffect(() => {
    const alSalir = () => void guardar();
    window.addEventListener("pagehide", alSalir);
    return () => window.removeEventListener("pagehide", alSalir);
  }, [guardar]);

  function setValor(v: Respuesta) {
    setError(null);
    setRespuestas((prev) => {
      const siguiente = { ...prev, [pregunta.id]: v };
      respuestasRef.current = siguiente;
      sucioRef.current = true;
      return siguiente;
    });
  }

  function siguiente() {
    const msg = validar(pregunta, respuestas[pregunta.id]);
    if (msg) {
      setError(msg);
      return;
    }
    void guardar();
    if (paso < total - 1) {
      setPaso(paso + 1);
      setError(null);
    } else {
      void enviar();
    }
  }

  function anterior() {
    setError(null);
    if (paso > 0) setPaso(paso - 1);
  }

  async function enviar() {
    // Revisión final de todo el formulario.
    const faltante = PREGUNTAS_PLANAS.findIndex(
      (p) => validar(p, respuestas[p.id]) !== null,
    );
    if (faltante >= 0) {
      setPaso(faltante);
      setError("Falta completar esta respuesta antes de enviar.");
      return;
    }
    setEnviando(true);
    const { data, error: e } = await supabase.rpc("onboarding_enviar", {
      p_token: token,
      p_respuestas: respuestas,
    });
    setEnviando(false);
    if (e || data === false) {
      setError("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    setFase("enviado");
  }

  // ---------- Pantallas de estado ----------
  if (fase === "cargando")
    return <Centro>Cargando tu formulario…</Centro>;

  if (fase === "invalido")
    return (
      <Centro>
        <div className="text-4xl">🔗</div>
        <h1 className="mt-4 text-xl font-semibold">Este enlace no es válido</h1>
        <p className="mt-2 text-muted">
          Verifica que copiaste el enlace completo o pídele uno nuevo a tu
          equipo.
        </p>
      </Centro>
    );

  if (fase === "cerrado" || fase === "enviado")
    return (
      <Centro>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-semibold">
          {fase === "enviado" ? "¡Listo, gracias!" : "Formulario ya enviado"}
        </h1>
        <p className="mt-3 max-w-md text-muted">
          {fase === "enviado"
            ? "Recibimos toda tu información correctamente. Nuestro equipo la revisará y avanzará con la implementación de tu sistema."
            : "Ya recibimos tus respuestas. Si necesitas cambiar algo, escríbele a tu equipo de implementación."}
        </p>
        <p className="mt-6 text-xs text-muted">Systems PEX</p>
      </Centro>
    );

  if (fase === "intro") {
    const yaEmpezado = Object.keys(respuestas).length > 0;
    return (
      <Centro>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Onboarding
        </p>
        <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
          {yaEmpezado ? "Continuemos donde quedaste" : "¡Hola! Cuéntanos de tu negocio"}
        </h1>
        <p className="mt-4 max-w-md text-muted">
          {proyecto && <span className="font-medium">{proyecto} · </span>}
          Son {total} preguntas, una a la vez. Puedes cerrar y volver cuando
          quieras: tus respuestas se guardan solas.
        </p>
        <button
          onClick={() => setFase("form")}
          className="mt-8 rounded-xl bg-accent px-8 py-3.5 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {yaEmpezado ? "Continuar" : "Comenzar"} →
        </button>
      </Centro>
    );
  }

  // ---------- Formulario ----------
  const pct = Math.round(((paso + 1) / total) * 100);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Progreso */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-1 bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5 text-xs text-muted sm:px-6">
          <span className="truncate font-medium">
            {pregunta.seccionTitulo}
          </span>
          <span className="shrink-0 tabular-nums">
            {guardando ? "Guardando…" : `${paso + 1} de ${total}`}
          </span>
        </div>
      </div>

      {/* Pregunta */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div key={pregunta.id} className="animate-[fadeIn_.25s_ease-out]">
          <h2 className="text-xl font-semibold leading-snug sm:text-2xl">
            {pregunta.titulo}
            {pregunta.opcional && (
              <span className="ml-2 align-middle text-xs font-normal text-muted">
                (opcional)
              </span>
            )}
          </h2>
          {pregunta.ayuda && (
            <p className="mt-2 text-sm text-muted">{pregunta.ayuda}</p>
          )}

          <div className="mt-6">
            <CampoOnboarding
              pregunta={pregunta}
              valor={respuestas[pregunta.id]}
              onChange={setValor}
              token={token}
              onEnter={siguiente}
            />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {/* Navegación */}
      <div className="sticky bottom-0 border-t border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={anterior}
            disabled={paso === 0}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-slate-100 disabled:invisible"
          >
            ← Anterior
          </button>
          <button
            onClick={siguiente}
            disabled={enviando}
            className="rounded-xl bg-accent px-7 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {enviando
              ? "Enviando…"
              : paso === total - 1
                ? "Enviar respuestas"
                : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
