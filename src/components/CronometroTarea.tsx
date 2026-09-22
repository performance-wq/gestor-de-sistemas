"use client";

import { useCallback, useEffect, useState } from "react";
import {
  estadoCronometro,
  formatHM,
  formatReloj,
  listarEventosTarea,
  registrarTiempo,
  totalTareaMs,
  type EventoTiempo,
  type RegistroTiempo,
} from "@/lib/tiempo";

// Cronómetro por tarea: cada quien registra su propio tiempo de trabajo.
// Iniciar → Pausar/Reanudar → Finalizar. Alimenta las horas hombre del
// Dashboard de Performance.
export function CronometroTarea({
  tareaId,
  userId,
}: {
  tareaId: string;
  userId: string;
}) {
  const [eventos, setEventos] = useState<RegistroTiempo[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setEventos(await listarEventosTarea(tareaId));
  }, [tareaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { estado, acumuladoMs } = estadoCronometro(eventos, userId, ahora);

  // Reloj en vivo mientras está en curso.
  useEffect(() => {
    if (estado !== "en_curso") return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [estado]);

  const totalTarea = totalTareaMs(eventos, ahora);

  async function accion(evento: EventoTiempo) {
    setOcupado(true);
    setError(null);
    try {
      await registrarTiempo(tareaId, evento);
      setAhora(Date.now());
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setOcupado(false);
    }
  }

  const enCurso = estado === "en_curso";
  const enPausa = estado === "en_pausa";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          Mi tiempo en esta tarea
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
            enCurso
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : enPausa
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-slate-100 text-slate-500 ring-slate-200"
          }`}
        >
          {enCurso ? "En curso" : enPausa ? "En pausa" : "Detenido"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          className={`font-mono text-2xl font-semibold tabular-nums ${
            enCurso ? "text-emerald-600" : "text-foreground"
          }`}
        >
          {formatReloj(acumuladoMs)}
        </div>
        <div className="flex flex-wrap gap-2">
          {estado === "detenido" && (
            <BotonCron onClick={() => accion("inicio")} disabled={ocupado} tono="verde">
              ▶ Iniciar
            </BotonCron>
          )}
          {enCurso && (
            <>
              <BotonCron onClick={() => accion("pausa")} disabled={ocupado} tono="ambar">
                ⏸ Pausar
              </BotonCron>
              <BotonCron onClick={() => accion("fin")} disabled={ocupado} tono="gris">
                ⏹ Finalizar
              </BotonCron>
            </>
          )}
          {enPausa && (
            <>
              <BotonCron onClick={() => accion("reanudacion")} disabled={ocupado} tono="verde">
                ▶ Reanudar
              </BotonCron>
              <BotonCron onClick={() => accion("fin")} disabled={ocupado} tono="gris">
                ⏹ Finalizar
              </BotonCron>
            </>
          )}
        </div>
      </div>

      {totalTarea > 0 && (
        <p className="mt-2 text-xs text-muted">
          Total en la tarea (todo el equipo): {formatHM(totalTarea)}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function BotonCron({
  onClick,
  disabled,
  tono,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tono: "verde" | "ambar" | "gris";
  children: React.ReactNode;
}) {
  const clase =
    tono === "verde"
      ? "bg-emerald-600 text-white hover:opacity-90"
      : tono === "ambar"
        ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border border-border text-muted hover:bg-slate-50";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${clase}`}
    >
      {children}
    </button>
  );
}
