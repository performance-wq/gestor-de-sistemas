"use client";

// Motor de métricas del Dashboard de Performance Gerencial.
// Deriva indicadores de rendimiento a partir de las marcas de tiempo que ya
// existen en las tareas (created_at, cerrada_at, estado, deadline, etc.).
// NO depende del cronómetro por tarea (horas hombre): eso llega después; aquí
// se deja el hueco preparado (ver horasHombre en el módulo de UI).

import type { Miembro, Tarea, TareaEstado } from "./tasks";
import { ESTADOS_ABIERTOS } from "./tasks";

const DIA = 86_400_000;

// ---------- Utilidades de fecha ----------
function inicioDeHoy(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}
function inicioDeSemana(): number {
  const n = new Date();
  const base = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const dow = (base.getDay() + 6) % 7; // lunes = 0
  base.setDate(base.getDate() - dow);
  return base.getTime();
}
function inicioDeMes(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
}
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

/** Formatea una duración en ms a texto legible (min / h / días). */
export function formatDuracion(msVal: number | null): string {
  if (msVal === null || msVal === undefined || !isFinite(msVal)) return "—";
  if (msVal < 0) return "—";
  const dias = msVal / DIA;
  if (dias >= 1) return `${dias.toFixed(1)} d`;
  const horas = msVal / 3_600_000;
  if (horas >= 1) return `${horas.toFixed(1)} h`;
  return `${Math.max(1, Math.round(msVal / 60_000))} min`;
}

// ---------- Tipos de salida ----------
export interface FilaColaborador {
  id: string;
  nombre: string;
  cerradasHoy: number;
  cerradasSemana: number;
  cerradasMes: number;
  activas: number;
  enRevision: number;
  pendientes: number;
  tiempoPromedio: number | null; // ms de resolución promedio
  cumplimiento: number | null; // % cerradas a tiempo (con deadline)
}

export interface FilaPromedio {
  clave: string;
  etiqueta: string;
  n: number;
  promedio: number | null; // ms
}

export interface FilaProyecto {
  id: string;
  nombre: string;
  abiertas: number;
  total: number;
  promedioResolucion: number | null; // ms
  diasSinActividad: number | null;
}

export interface Alerta {
  nivel: "alta" | "media";
  texto: string;
}

export interface PerformanceData {
  colaboradores: FilaColaborador[];
  porTipo: FilaPromedio[];
  porSistema: FilaPromedio[];
  proyectos: FilaProyecto[];
  cuellos: { estado: TareaEstado; label: string; n: number }[];
  resolucionGlobal: number | null;
  resolucionPorPrioridad: FilaPromedio[];
  totalAbiertas: number;
  totalCerradasMes: number;
  vencidas: number;
  alertas: Alerta[];
}

const LABEL_TIPO: Record<string, string> = {
  soporte: "Soporte",
  incidencia: "Incidencia",
  ajuste: "Ajuste",
  solicitud: "Solicitud",
  observacion: "Observación",
};
const LABEL_PRIORIDAD: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baja: "Baja",
};
const LABEL_ESTADO_CUELLO: Record<string, string> = {
  pendiente: "Pendientes",
  en_revision: "En revisión",
  bloqueada: "Bloqueadas",
};

/** Promedio de un arreglo de ms (ignora nulos); null si no hay datos. */
function promedio(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null && isFinite(x));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Tiempo de resolución de una tarea cerrada (created_at → cerrada_at). */
function resolucion(t: Tarea): number | null {
  const c = ms(t.cerradaAt);
  const ini = ms(t.createdAt);
  if (c === null || ini === null || c < ini) return null;
  return c - ini;
}

export function calcularPerformance(
  tareas: Tarea[],
  miembros: Miembro[],
  proyectoNombre: Record<string, string>,
  sistemaNombre: Record<string, string>,
): PerformanceData {
  const hoy = inicioDeHoy();
  const semana = inicioDeSemana();
  const mes = inicioDeMes();
  const ahora = Date.now();

  // ---------- Por colaborador ----------
  const colaboradores: FilaColaborador[] = miembros.map((m) => {
    const suyas = tareas.filter((t) => t.responsableId === m.id);
    const cerradas = suyas.filter((t) => t.estado === "cerrada" && t.cerradaAt);
    const enRango = (desde: number) =>
      cerradas.filter((t) => (ms(t.cerradaAt) ?? 0) >= desde).length;

    const conDeadline = cerradas.filter((t) => t.deadline);
    const aTiempo = conDeadline.filter(
      (t) => (ms(t.cerradaAt) ?? 0) <= (ms(t.deadline) ?? 0) + DIA,
    ).length;

    return {
      id: m.id,
      nombre: m.nombre,
      cerradasHoy: enRango(hoy),
      cerradasSemana: enRango(semana),
      cerradasMes: enRango(mes),
      activas: suyas.filter(
        (t) => t.estado === "en_proceso" || t.estado === "reabierta",
      ).length,
      enRevision: suyas.filter((t) => t.estado === "en_revision").length,
      pendientes: suyas.filter((t) => t.estado === "pendiente").length,
      tiempoPromedio: promedio(cerradas.map(resolucion)),
      cumplimiento:
        conDeadline.length > 0
          ? Math.round((aTiempo / conDeadline.length) * 100)
          : null,
    };
  });
  // Solo mostramos colaboradores con alguna tarea relacionada.
  const colaboradoresActivos = colaboradores.filter(
    (c) =>
      c.cerradasMes + c.activas + c.enRevision + c.pendientes > 0 ||
      c.tiempoPromedio !== null,
  );

  // ---------- Promedio por tipo ----------
  const cerradasAll = tareas.filter((t) => t.estado === "cerrada");
  const tipos = ["soporte", "incidencia", "ajuste", "solicitud", "observacion"];
  const porTipo: FilaPromedio[] = tipos
    .map((tp) => {
      const grupo = cerradasAll.filter((t) => t.tipo === tp);
      return {
        clave: tp,
        etiqueta: LABEL_TIPO[tp] ?? tp,
        n: grupo.length,
        promedio: promedio(grupo.map(resolucion)),
      };
    })
    .filter((f) => f.n > 0)
    .sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0));

  // ---------- Promedio por sistema (por nombre de sistema) ----------
  const porSistemaMap: Record<string, number[]> = {};
  for (const t of cerradasAll) {
    if (!t.sistemaId) continue;
    const nombre = sistemaNombre[t.sistemaId];
    if (!nombre) continue;
    const r = resolucion(t);
    if (r === null) continue;
    (porSistemaMap[nombre] ??= []).push(r);
  }
  const porSistema: FilaPromedio[] = Object.entries(porSistemaMap)
    .map(([nombre, arr]) => ({
      clave: nombre,
      etiqueta: nombre,
      n: arr.length,
      promedio: promedio(arr),
    }))
    .sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0));

  // ---------- Por proyecto ----------
  const proyIds = Array.from(new Set(tareas.map((t) => t.proyectoId)));
  const proyectos: FilaProyecto[] = proyIds
    .map((pid) => {
      const suyas = tareas.filter((t) => t.proyectoId === pid);
      const abiertas = suyas.filter((t) =>
        ESTADOS_ABIERTOS.includes(t.estado),
      ).length;
      const ultima = Math.max(
        0,
        ...suyas.map((t) => ms(t.updatedAt) ?? ms(t.createdAt) ?? 0),
      );
      return {
        id: pid,
        nombre: proyectoNombre[pid] ?? "—",
        abiertas,
        total: suyas.length,
        promedioResolucion: promedio(
          suyas.filter((t) => t.estado === "cerrada").map(resolucion),
        ),
        diasSinActividad:
          abiertas > 0 && ultima > 0
            ? Math.floor((ahora - ultima) / DIA)
            : null,
      };
    })
    .sort((a, b) => b.abiertas - a.abiertas);

  // ---------- Cuellos de botella ----------
  const cuellos = (["pendiente", "en_revision", "bloqueada"] as TareaEstado[]).map(
    (e) => ({
      estado: e,
      label: LABEL_ESTADO_CUELLO[e] ?? e,
      n: tareas.filter((t) => t.estado === e).length,
    }),
  );

  // ---------- Resolución global + por prioridad ----------
  const resolucionGlobal = promedio(cerradasAll.map(resolucion));
  const prioridades = ["critica", "alta", "normal", "baja"];
  const resolucionPorPrioridad: FilaPromedio[] = prioridades
    .map((pr) => {
      const grupo = cerradasAll.filter((t) => t.prioridad === pr);
      return {
        clave: pr,
        etiqueta: LABEL_PRIORIDAD[pr] ?? pr,
        n: grupo.length,
        promedio: promedio(grupo.map(resolucion)),
      };
    })
    .filter((f) => f.n > 0);

  // ---------- Totales ----------
  const totalAbiertas = tareas.filter((t) =>
    ESTADOS_ABIERTOS.includes(t.estado),
  ).length;
  const totalCerradasMes = cerradasAll.filter(
    (t) => (ms(t.cerradaAt) ?? 0) >= mes,
  ).length;
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
    alertas.push({
      nivel: "alta",
      texto: `${vencidas} tareas vencidas sin cerrar.`,
    });
  else if (vencidas > 0)
    alertas.push({ nivel: "media", texto: `${vencidas} tarea(s) vencida(s).` });

  const enRevisionTotal = tareas.filter(
    (t) => t.estado === "en_revision",
  ).length;
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

  for (const c of colaboradoresActivos) {
    const carga = c.activas + c.enRevision + c.pendientes;
    if (carga >= 8)
      alertas.push({
        nivel: "media",
        texto: `${c.nombre} con carga alta: ${carga} tareas activas.`,
      });
  }

  for (const p of proyectos) {
    if (p.abiertas >= 8)
      alertas.push({
        nivel: "media",
        texto: `${p.nombre}: ${p.abiertas} tareas abiertas.`,
      });
    if (p.diasSinActividad !== null && p.diasSinActividad >= 7)
      alertas.push({
        nivel: "alta",
        texto: `${p.nombre}: sin actividad hace ${p.diasSinActividad} días.`,
      });
  }

  return {
    colaboradores: colaboradoresActivos.sort(
      (a, b) => b.cerradasMes - a.cerradasMes,
    ),
    porTipo,
    porSistema,
    proyectos,
    cuellos,
    resolucionGlobal,
    resolucionPorPrioridad,
    totalAbiertas,
    totalCerradasMes,
    vencidas,
    alertas,
  };
}
