"use client";

import { useCallback, useEffect, useState } from "react";
import {
  estadoCronometro,
  formatReloj,
  listarEventosTarea,
  registrarTiempo,
  type EventoTiempo,
  type RegistroTiempo,
} from "@/lib/tiempo";

// Cronómetro por tarea (Iniciar/Pausar/Reanudar). El "Terminar" lo maneja
// el detalle de la tarea (cierra el cronómetro y enruta la tarea).
export function CronometroTarea({
  tareaId,
  userId,
  labelIniciar = "Iniciar tarea",
  refreshKey = 0,
  onCambio,
}: {
  tareaId: string;
  userId: string;
  labelIniciar?: string;
  refreshKey?: number;
  onCambio?: () => void;
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
  }, [cargar, refreshKey]);

  const { estado, acumuladoMs } = estadoCronometro(eventos, userId, ahora);

  useEffect(() => {
    if (estado !== "en_curso") return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [estado]);

  async function accion(evento: EventoTiempo) {
    setOcupado(true);
    setError(null);
    try {
      await registrarTiempo(tareaId, evento);
      setAhora(Date.now());
      await cargar();
      onCambio?.();
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
          {enCurso ? "En curso" : enPausa ? "En pausa" : "Sin iniciar"}
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
            <Boton onClick={() => accion("inicio")} disabled={ocupado} tono="verde">
              ▶ {labelIniciar}
            </Boton>
          )}
          {enCurso && (
            <Boton onClick={() => accion("pausa")} disabled={ocupado} tono="ambar">
              ⏸ Pausar
            </Boton>
          )}
          {enPausa && (
            <Boton onClick={() => accion("reanudacion")} disabled={ocupado} tono="verde">
              ▶ Reanudar
            </Boton>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Boton({
  onClick,
  disabled,
  tono,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tono: "verde" | "ambar";
  children: React.ReactNode;
}) {
  const clase =
    tono === "verde"
      ? "bg-emerald-600 text-white hover:opacity-90"
      : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100";
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
