"use client";

// Cronómetro por tarea: registro y cálculo de tiempo trabajado.
// Los eventos viven en task_time_logs (inicio/pausa/reanudacion/fin). El
// tiempo efectivo se obtiene emparejando cada arranque con su siguiente
// parada. La escritura pasa por el RPC tiempo_evento (valida la transición).

import { createClient } from "./supabase/client";

export type EventoTiempo = "inicio" | "pausa" | "reanudacion" | "fin";
export type EstadoCronometro = "detenido" | "en_curso" | "en_pausa";

export interface RegistroTiempo {
  id: string;
  taskId: string;
  userId: string | null;
  evento: EventoTiempo;
  createdAt: string; // ISO
  t: number; // ms epoch
}

type Row = Record<string, unknown>;

function mapRegistro(r: Row): RegistroTiempo {
  const iso = (r.created_at as string) ?? "";
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    userId: (r.user_id as string) ?? null,
    evento: r.evento as EventoTiempo,
    createdAt: iso,
    t: new Date(iso).getTime(),
  };
}

// ---------- Lecturas ----------
export async function listarEventosTarea(taskId: string): Promise<RegistroTiempo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_time_logs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error leyendo tiempo de la tarea:", error.message);
    return [];
  }
  return (data ?? []).map(mapRegistro);
}

// Todos los eventos visibles (gestor ve todos; cada quien los suyos).
export async function listarEventosTiempo(): Promise<RegistroTiempo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_time_logs")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map(mapRegistro);
}

// ---------- Escritura ----------
export async function registrarTiempo(
  taskId: string,
  evento: EventoTiempo,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("tiempo_evento", {
    p_task_id: taskId,
    p_evento: evento,
  });
  if (error) throw new Error(error.message);
}

// ---------- Cálculo de intervalos ----------
export interface Intervalo {
  start: number;
  end: number | null; // null = en curso
}

/** Empareja arranques con paradas para una lista de eventos ORDENADA asc. */
export function intervalosDe(eventos: RegistroTiempo[]): Intervalo[] {
  const out: Intervalo[] = [];
  let cur: number | null = null;
  for (const e of eventos) {
    if (e.evento === "inicio" || e.evento === "reanudacion") {
      if (cur === null) cur = e.t;
    } else if (e.evento === "pausa" || e.evento === "fin") {
      if (cur !== null) {
        out.push({ start: cur, end: e.t });
        cur = null;
      }
    }
  }
  if (cur !== null) out.push({ start: cur, end: null });
  return out;
}

/** Estado del cronómetro de un usuario en una tarea + acumulado (ms). */
export function estadoCronometro(
  eventos: RegistroTiempo[],
  userId: string,
  ahora = Date.now(),
): { estado: EstadoCronometro; acumuladoMs: number; desde: number | null } {
  const mios = eventos
    .filter((e) => e.userId === userId)
    .sort((a, b) => a.t - b.t);
  const ints = intervalosDe(mios);
  let acum = 0;
  let desde: number | null = null;
  for (const iv of ints) {
    if (iv.end === null) {
      acum += ahora - iv.start;
      desde = iv.start;
    } else {
      acum += iv.end - iv.start;
    }
  }
  const last = mios[mios.length - 1]?.evento;
  const estado: EstadoCronometro =
    last === "inicio" || last === "reanudacion"
      ? "en_curso"
      : last === "pausa"
        ? "en_pausa"
        : "detenido";
  return { estado, acumuladoMs: acum, desde };
}

/** Total trabajado (ms) por TODOS los usuarios en una tarea. */
export function totalTareaMs(eventos: RegistroTiempo[], ahora = Date.now()): number {
  const porUsuario = new Map<string, RegistroTiempo[]>();
  for (const e of eventos) {
    const k = e.userId ?? "—";
    (porUsuario.get(k) ?? porUsuario.set(k, []).get(k)!).push(e);
  }
  let total = 0;
  for (const evs of porUsuario.values()) {
    for (const iv of intervalosDe(evs.sort((a, b) => a.t - b.t))) {
      total += (iv.end ?? ahora) - iv.start;
    }
  }
  return total;
}

// ---------- Horas hombre por colaborador ----------
function inicioDeHoy() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}
function inicioDeSemana() {
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  b.setDate(b.getDate() - ((b.getDay() + 6) % 7));
  return b.getTime();
}
function inicioDeMes() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
}
function solapa(iv: Intervalo, desde: number, hasta: number): number {
  const end = iv.end ?? hasta;
  return Math.max(0, Math.min(end, hasta) - Math.max(iv.start, desde));
}

export interface HorasColaborador {
  userId: string;
  hoyMs: number;
  semanaMs: number;
  mesMs: number;
}

/**
 * Horas efectivas por usuario en ventanas hoy/semana/mes. Se calcula por
 * (usuario, tarea) y se suma, recortando cada intervalo a la ventana.
 */
export function calcularHorasHombre(eventos: RegistroTiempo[]): Map<string, HorasColaborador> {
  const ahora = Date.now();
  const hoy = inicioDeHoy();
  const semana = inicioDeSemana();
  const mes = inicioDeMes();

  // Agrupar por usuario+tarea.
  const grupos = new Map<string, RegistroTiempo[]>();
  for (const e of eventos) {
    if (!e.userId) continue;
    const k = `${e.userId}::${e.taskId}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(e);
  }

  const res = new Map<string, HorasColaborador>();
  for (const [k, evs] of grupos) {
    const userId = k.split("::")[0];
    const ints = intervalosDe(evs.sort((a, b) => a.t - b.t));
    const fila =
      res.get(userId) ?? { userId, hoyMs: 0, semanaMs: 0, mesMs: 0 };
    for (const iv of ints) {
      fila.hoyMs += solapa(iv, hoy, ahora);
      fila.semanaMs += solapa(iv, semana, ahora);
      fila.mesMs += solapa(iv, mes, ahora);
    }
    res.set(userId, fila);
  }
  return res;
}

/** Formatea ms a "Xh Ym" (para horas hombre). */
export function formatHM(msVal: number): string {
  if (!msVal || msVal < 0) return "0h 0m";
  const totalMin = Math.floor(msVal / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

/** Formatea ms a cronómetro "HH:MM:SS" (para el tiempo en curso). */
export function formatReloj(msVal: number): string {
  if (!msVal || msVal < 0) msVal = 0;
  const s = Math.floor(msVal / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
