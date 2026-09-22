"use client";

// Motor de métricas del Dashboard de Performance Gerencial.
// PRINCIPIO: el tiempo de trabajo se mide SOLO por el cronómetro real
// (task_time_logs), nunca por tiempo calendario entre creación y cierre.
// Los indicadores calendario (deadlines, vencidas) sólo alimentan alertas.

import type { Miembro, Tarea, TareaEstado } from "./tasks";
import { ESTADOS_ABIERTOS } from "./tasks";
import {
  calcularHorasHombre,
  formatHM,
  tiemposPorTarea,
  type RegistroTiempo,
  type TiemposTarea,
} from "./tiempo";

const DIA = 86_400_000;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}
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

export { formatHM };

// ---------- Tipos de salida ----------
export interface FilaColaborador {
  id: string;
  nombre: string;
  hoyMs: number;
  semanaMs: number;
  mesMs: number;
  cerradasMes: number;
  activas: number;
  enRevision: number;
  pendientes: number;
  operativoMs: number; // total de su tiempo real
  tareasConTiempo: number;
  promedioTareaMs: number | null;
}

export interface FilaSistema {
  etiqueta: string;
  operativoMs: number;
  nTareas: number;
}

export interface FilaTarea {
  id: string;
  titulo: string;
  proyecto: string;
  sistema: string;
  ejecutorMs: number;
  revisorMs: number;
  totalMs: number;
  nRevisiones: number;
  nCorrecciones: number;
}

export interface Alerta {
  nivel: "alta" | "media";
  texto: string;
}

export interface PerformanceData {
  colaboradores: FilaColaborador[];
  porSistema: FilaSistema[];
  topTareas: FilaTarea[];
  cuellos: { estado: TareaEstado; label: string; n: number }[];
  totalAbiertas: number;
  operativoMesMs: number;
  operativoPromedioTareaMs: number | null;
  vencidas: number;
  alertas: Alerta[];
}

const LABEL_ESTADO_CUELLO: Record<string, string> = {
  pendiente: "Pendientes",
  en_revision: "En revisión",
  bloqueada: "Bloqueadas",
};

export function calcularPerformance(
  tareas: Tarea[],
  miembros: Miembro[],
  eventos: RegistroTiempo[],
  proyectoNombre: Record<string, string>,
  sistemaNombre: Record<string, string>,
): PerformanceData {
  const hoy = inicioDeHoy();
  const semana = inicioDeSemana();
  const mes = inicioDeMes();

  const horas = calcularHorasHombre(eventos);
  const tTarea = tiemposPorTarea(eventos);
  const tareaPorId = new Map(tareas.map((t) => [t.id, t]));

  // Tiempo operativo por usuario a partir de los eventos (intervalos por
  // usuario+tarea) y nº de tareas en las que registró tiempo.
  const opPorUsuario = new Map<string, { ms: number; tareas: Set<string> }>();
  {
    const grupos = new Map<string, RegistroTiempo[]>();
    for (const e of eventos) {
      if (!e.userId) continue;
      const k = `${e.userId}::${e.taskId}`;
      (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(e);
    }
    const ahora = Date.now();
    for (const [k, evs] of grupos) {
      const [userId, taskId] = k.split("::");
      let total = 0;
      let cur: number | null = null;
      for (const e of evs.sort((a, b) => a.t - b.t)) {
        if (e.evento === "inicio" || e.evento === "reanudacion") {
          if (cur === null) cur = e.t;
        } else if (e.evento === "pausa" || e.evento === "fin") {
          if (cur !== null) {
            total += e.t - cur;
            cur = null;
          }
        }
      }
      if (cur !== null) total += ahora - cur;
      const acc = opPorUsuario.get(userId) ?? { ms: 0, tareas: new Set() };
      acc.ms += total;
      if (total > 0) acc.tareas.add(taskId);
      opPorUsuario.set(userId, acc);
    }
  }

  const colaboradores: FilaColaborador[] = miembros
    .map((m) => {
      const suyas = tareas.filter((t) => t.responsableId === m.id);
      const cerradas = suyas.filter((t) => t.estado === "cerrada" && t.cerradaAt);
      const h = horas.get(m.id);
      const op = opPorUsuario.get(m.id);
      return {
        id: m.id,
        nombre: m.nombre,
        hoyMs: h?.hoyMs ?? 0,
        semanaMs: h?.semanaMs ?? 0,
        mesMs: h?.mesMs ?? 0,
        cerradasMes: cerradas.filter((t) => (ms(t.cerradaAt) ?? 0) >= mes).length,
        activas: suyas.filter(
          (t) => t.estado === "en_proceso" || t.estado === "reabierta",
        ).length,
        enRevision: suyas.filter((t) => t.estado === "en_revision").length,
        pendientes: suyas.filter((t) => t.estado === "pendiente").length,
        operativoMs: op?.ms ?? 0,
        tareasConTiempo: op?.tareas.size ?? 0,
        promedioTareaMs:
          op && op.tareas.size > 0 ? op.ms / op.tareas.size : null,
      };
    })
    .sort((a, b) => b.mesMs - a.mesMs);

  // ---------- Por sistema (tiempo operativo) ----------
  const porSistemaMap = new Map<string, { ms: number; tareas: Set<string> }>();
  for (const [taskId, tt] of tTarea) {
    const tarea = tareaPorId.get(taskId);
    const nombre = tarea?.sistemaId ? sistemaNombre[tarea.sistemaId] : null;
    const key = nombre ?? "Sin sistema";
    const acc = porSistemaMap.get(key) ?? { ms: 0, tareas: new Set() };
    acc.ms += tt.totalMs;
    acc.tareas.add(taskId);
    porSistemaMap.set(key, acc);
  }
  const porSistema: FilaSistema[] = [...porSistemaMap.entries()]
    .map(([etiqueta, v]) => ({ etiqueta, operativoMs: v.ms, nTareas: v.tareas.size }))
    .filter((f) => f.operativoMs > 0)
    .sort((a, b) => b.operativoMs - a.operativoMs);

  // ---------- Top tareas por tiempo operativo ----------
  const topTareas: FilaTarea[] = [...tTarea.entries()]
    .map(([taskId, tt]: [string, TiemposTarea]) => {
      const tarea = tareaPorId.get(taskId);
      return {
        id: taskId,
        titulo: tarea?.titulo ?? "—",
        proyecto: tarea ? proyectoNombre[tarea.proyectoId] ?? "—" : "—",
        sistema: tarea?.sistemaId ? sistemaNombre[tarea.sistemaId] ?? "—" : "—",
        ejecutorMs: tt.ejecutorMs,
        revisorMs: tt.revisorMs,
        totalMs: tt.totalMs,
        nRevisiones: tt.nRevisiones,
        nCorrecciones: tt.nCorrecciones,
      };
    })
    .filter((f) => f.totalMs > 0)
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);

  // ---------- Cuellos ----------
  const cuellos = (["pendiente", "en_revision", "bloqueada"] as TareaEstado[]).map(
    (e) => ({
      estado: e,
      label: LABEL_ESTADO_CUELLO[e] ?? e,
      n: tareas.filter((t) => t.estado === e).length,
    }),
  );

  // ---------- Totales ----------
  const totalAbiertas = tareas.filter((t) =>
    ESTADOS_ABIERTOS.includes(t.estado),
  ).length;

  let operativoMesMs = 0;
  for (const h of horas.values()) operativoMesMs += h.mesMs;

  const conTiempo = [...tTarea.values()].filter((t) => t.totalMs > 0);
  const operativoPromedioTareaMs =
    conTiempo.length > 0
      ? conTiempo.reduce((a, b) => a + b.totalMs, 0) / conTiempo.length
      : null;

  const hoyStr = new Date().toISOString().slice(0, 10);
  const vencidas = tareas.filter(
    (t) =>
      t.deadline &&
      t.deadline < hoyStr &&
      t.estado !== "cerrada" &&
      t.estado !== "cancelada",
  ).length;

  // ---------- Alertas ----------
  const alertas: Alerta[] = [];
  if (vencidas >= 5)
    alertas.push({ nivel: "alta", texto: `${vencidas} tareas vencidas sin cerrar.` });
  else if (vencidas > 0)
    alertas.push({ nivel: "media", texto: `${vencidas} tarea(s) vencida(s).` });

  const enRevisionTotal = tareas.filter((t) => t.estado === "en_revision").length;
  if (enRevisionTotal >= 5)
    alertas.push({
      nivel: "media",
      texto: `${enRevisionTotal} tareas esperando revisión (posible cuello de botella).`,
    });

  const bloqueadas = tareas.filter((t) => t.estado === "bloqueada").length;
  if (bloqueadas > 0)
    alertas.push({
      nivel: bloqueadas >= 3 ? "alta" : "media",
      texto: `${bloqueadas} tarea(s) bloqueada(s).`,
    });

  for (const c of colaboradores) {
    const carga = c.activas + c.enRevision + c.pendientes;
    if (carga >= 8)
      alertas.push({
        nivel: "media",
        texto: `${c.nombre} con carga alta: ${carga} tareas activas.`,
      });
  }

  // Proyectos abiertos sin actividad reciente (por updated_at de sus tareas).
  const ahora = Date.now();
  const proyIds = Array.from(new Set(tareas.map((t) => t.proyectoId)));
  for (const pid of proyIds) {
    const suyas = tareas.filter((t) => t.proyectoId === pid);
    const abiertas = suyas.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length;
    if (abiertas === 0) continue;
    const ultima = Math.max(
      0,
      ...suyas.map((t) => ms(t.updatedAt) ?? ms(t.createdAt) ?? 0),
    );
    const dias = ultima > 0 ? Math.floor((ahora - ultima) / DIA) : 0;
    if (abiertas >= 8)
      alertas.push({
        nivel: "media",
        texto: `${proyectoNombre[pid] ?? "Proyecto"}: ${abiertas} tareas abiertas.`,
      });
    if (dias >= 7)
      alertas.push({
        nivel: "alta",
        texto: `${proyectoNombre[pid] ?? "Proyecto"}: sin actividad hace ${dias} días.`,
      });
  }

  return {
    colaboradores,
    porSistema,
    topTareas,
    cuellos,
    totalAbiertas,
    operativoMesMs,
    operativoPromedioTareaMs,
    vencidas,
    alertas,
  };
}
