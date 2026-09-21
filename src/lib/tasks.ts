"use client";

// Acceso a datos de la capa de tareas (Fase 3/4). Todas las mutaciones pasan
// por RPCs SECURITY DEFINER que validan el rol en el backend; el cliente nunca
// escribe directo en las tablas. Las relaciones son por id interno.

import { createClient } from "./supabase/client";

// ---------- Catálogos ----------
export type TareaTipo =
  | "soporte"
  | "incidencia"
  | "ajuste"
  | "solicitud"
  | "observacion";
export type TareaPrioridad = "critica" | "alta" | "normal" | "baja";
export type TareaEstado =
  | "pendiente"
  | "en_proceso"
  | "en_revision"
  | "cerrada"
  | "bloqueada"
  | "reabierta"
  | "cancelada";

export const TIPOS: { valor: TareaTipo; label: string }[] = [
  { valor: "soporte", label: "Soporte" },
  { valor: "incidencia", label: "Incidencia" },
  { valor: "ajuste", label: "Ajuste" },
  { valor: "solicitud", label: "Solicitud" },
  { valor: "observacion", label: "Observación interna" },
];

export const PRIORIDADES: {
  valor: TareaPrioridad;
  label: string;
  dot: string;
  chip: string;
}[] = [
  { valor: "critica", label: "Crítica", dot: "bg-red-500", chip: "bg-red-50 text-red-700 ring-red-200" },
  { valor: "alta", label: "Alta", dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700 ring-orange-200" },
  { valor: "normal", label: "Normal", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-200" },
  { valor: "baja", label: "Baja", dot: "bg-slate-400", chip: "bg-slate-50 text-slate-600 ring-slate-200" },
];

export const ESTADOS_TAREA: {
  valor: TareaEstado;
  label: string;
  chip: string;
}[] = [
  { valor: "pendiente", label: "Pendiente", chip: "bg-slate-100 text-slate-700 ring-slate-200" },
  { valor: "en_proceso", label: "En proceso", chip: "bg-blue-50 text-blue-700 ring-blue-200" },
  { valor: "en_revision", label: "En revisión", chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  { valor: "cerrada", label: "Cerrada", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { valor: "bloqueada", label: "Bloqueada", chip: "bg-rose-50 text-rose-700 ring-rose-200" },
  { valor: "reabierta", label: "Reabierta", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  { valor: "cancelada", label: "Cancelada", chip: "bg-slate-100 text-slate-400 ring-slate-200 line-through" },
];

export function etiquetaTipo(v: string): string {
  return TIPOS.find((t) => t.valor === v)?.label ?? v;
}
export function etiquetaPrioridad(v: string): string {
  return PRIORIDADES.find((t) => t.valor === v)?.label ?? v;
}
export function etiquetaEstado(v: string): string {
  return ESTADOS_TAREA.find((t) => t.valor === v)?.label ?? v;
}
export function chipEstado(v: string): string {
  return (
    ESTADOS_TAREA.find((t) => t.valor === v)?.chip ??
    "bg-slate-100 text-slate-700 ring-slate-200"
  );
}
export function chipPrioridad(v: string): string {
  return (
    PRIORIDADES.find((t) => t.valor === v)?.chip ??
    "bg-slate-50 text-slate-600 ring-slate-200"
  );
}

// Estados considerados "abiertos" (trabajo vivo).
export const ESTADOS_ABIERTOS: TareaEstado[] = [
  "pendiente",
  "en_proceso",
  "en_revision",
  "bloqueada",
  "reabierta",
];

// ---------- Modelo ----------
export interface Tarea {
  id: string;
  proyectoId: string;
  sistemaId: string | null;
  titulo: string;
  descripcion: string;
  tipo: TareaTipo;
  prioridad: TareaPrioridad;
  estado: TareaEstado;
  responsableId: string | null;
  creadoPor: string | null;
  deadline: string | null;
  requiereValidacion: boolean;
  reabiertaCount: number;
  cerradaAt: string | null;
  evidencia: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Miembro {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface TareaHistorial {
  id: string;
  taskId: string;
  actorId: string | null;
  accion: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  nota: string | null;
  createdAt: string;
}

export interface TareaComentario {
  id: string;
  taskId: string;
  autorId: string | null;
  cuerpo: string;
  createdAt: string;
}

export interface Notificacion {
  id: string;
  taskId: string | null;
  tipo: string;
  texto: string;
  leida: boolean;
  createdAt: string;
}

type Row = Record<string, unknown>;

function mapTarea(r: Row): Tarea {
  return {
    id: r.id as string,
    proyectoId: r.proyecto_id as string,
    sistemaId: (r.sistema_id as string) ?? null,
    titulo: r.titulo as string,
    descripcion: (r.descripcion as string) ?? "",
    tipo: r.tipo as TareaTipo,
    prioridad: r.prioridad as TareaPrioridad,
    estado: r.estado as TareaEstado,
    responsableId: (r.responsable_id as string) ?? null,
    creadoPor: (r.creado_por as string) ?? null,
    deadline: (r.deadline as string) ?? null,
    requiereValidacion: (r.requiere_validacion as boolean) ?? false,
    reabiertaCount: (r.reabierta_count as number) ?? 0,
    cerradaAt: (r.cerrada_at as string) ?? null,
    evidencia: (r.evidencia as string) ?? null,
    createdAt: (r.created_at as string) ?? "",
    updatedAt: (r.updated_at as string) ?? "",
  };
}

// ---------- Lecturas ----------
export async function listarTareas(): Promise<Tarea[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error listando tareas:", error.message);
    return [];
  }
  return (data ?? []).map(mapTarea);
}

export async function listarTareasProyecto(proyectoId: string): Promise<Tarea[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("proyecto_id", proyectoId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error listando tareas del proyecto:", error.message);
    return [];
  }
  return (data ?? []).map(mapTarea);
}

export async function obtenerTarea(id: string): Promise<Tarea | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapTarea(data);
}

export async function listarMiembros(): Promise<Miembro[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("listar_miembros");
  if (error) {
    console.error("Error listando miembros:", error.message);
    return [];
  }
  return (data ?? []).map((r: Row) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    email: r.email as string,
    rol: r.rol as string,
  }));
}

export async function listarHistorial(taskId: string): Promise<TareaHistorial[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_history")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error listando historial:", error.message);
    return [];
  }
  return (data ?? []).map((r: Row) => ({
    id: r.id as string,
    taskId: r.task_id as string,
    actorId: (r.actor_id as string) ?? null,
    accion: r.accion as string,
    campo: (r.campo as string) ?? null,
    valorAnterior: (r.valor_anterior as string) ?? null,
    valorNuevo: (r.valor_nuevo as string) ?? null,
    nota: (r.nota as string) ?? null,
    createdAt: (r.created_at as string) ?? "",
  }));
}

// Historial agregado de todas las tareas de un proyecto (timeline del proyecto).
export async function listarHistorialProyecto(
  proyectoId: string,
): Promise<(TareaHistorial & { tareaTitulo: string })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_history")
    .select("*, tasks!inner(proyecto_id, titulo)")
    .eq("tasks.proyecto_id", proyectoId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Error listando historial del proyecto:", error.message);
    return [];
  }
  return (data ?? []).map((r: Row) => ({
    id: r.id as string,
    taskId: r.task_id as string,
    actorId: (r.actor_id as string) ?? null,
    accion: r.accion as string,
    campo: (r.campo as string) ?? null,
    valorAnterior: (r.valor_anterior as string) ?? null,
    valorNuevo: (r.valor_nuevo as string) ?? null,
    nota: (r.nota as string) ?? null,
    createdAt: (r.created_at as string) ?? "",
    tareaTitulo: ((r.tasks as Row)?.titulo as string) ?? "—",
  }));
}

export async function listarComentarios(taskId: string): Promise<TareaComentario[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error listando comentarios:", error.message);
    return [];
  }
  return (data ?? []).map((r: Row) => ({
    id: r.id as string,
    taskId: r.task_id as string,
    autorId: (r.autor_id as string) ?? null,
    cuerpo: r.cuerpo as string,
    createdAt: (r.created_at as string) ?? "",
  }));
}

export async function listarNotificaciones(): Promise<Notificacion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((r: Row) => ({
    id: r.id as string,
    taskId: (r.task_id as string) ?? null,
    tipo: r.tipo as string,
    texto: r.texto as string,
    leida: (r.leida as boolean) ?? false,
    createdAt: (r.created_at as string) ?? "",
  }));
}

// ---------- Mutaciones (RPC) ----------
export interface CrearTareaInput {
  proyectoId: string;
  titulo: string;
  tipo: TareaTipo;
  responsableId?: string | null;
  prioridad: TareaPrioridad;
  deadline?: string | null;
  sistemaId?: string | null;
  descripcion?: string;
  requiereValidacion?: boolean;
  evidencia?: string | null;
}

export async function crearTarea(input: CrearTareaInput): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("task_crear", {
    p_proyecto_id: input.proyectoId,
    p_titulo: input.titulo.trim(),
    p_tipo: input.tipo,
    p_responsable_id: input.responsableId || null,
    p_prioridad: input.prioridad,
    p_deadline: input.deadline || null,
    p_sistema_id: input.sistemaId || null,
    p_descripcion: input.descripcion ?? "",
    p_requiere_validacion: input.requiereValidacion ?? false,
    p_evidencia: input.evidencia || null,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data as string;
}

export async function transicionTarea(
  id: string,
  estado: TareaEstado,
  nota?: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("task_transicion", {
    p_task_id: id,
    p_estado: estado,
    p_nota: nota || null,
  });
  if (error) throw new Error(error.message);
}

export interface EditarTareaPatch {
  titulo?: string;
  descripcion?: string;
  tipo?: TareaTipo;
  prioridad?: TareaPrioridad;
  responsableId?: string | null;
  deadline?: string | null;
  sistemaId?: string | null;
  setResponsable?: boolean;
  setDeadline?: boolean;
  setSistema?: boolean;
  evidencia?: string | null;
  setEvidencia?: boolean;
}

export async function editarTarea(id: string, patch: EditarTareaPatch): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("task_editar", {
    p_task_id: id,
    p_titulo: patch.titulo ?? null,
    p_descripcion: patch.descripcion ?? null,
    p_tipo: patch.tipo ?? null,
    p_prioridad: patch.prioridad ?? null,
    p_responsable_id: patch.responsableId ?? null,
    p_deadline: patch.deadline ?? null,
    p_sistema_id: patch.sistemaId ?? null,
    p_set_responsable: patch.setResponsable ?? false,
    p_set_deadline: patch.setDeadline ?? false,
    p_set_sistema: patch.setSistema ?? false,
    p_evidencia: patch.evidencia ?? null,
    p_set_evidencia: patch.setEvidencia ?? false,
  });
  if (error) throw new Error(error.message);
}

export async function comentarTarea(id: string, cuerpo: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("task_comentar", {
    p_task_id: id,
    p_cuerpo: cuerpo.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function reabrirTarea(id: string, motivo?: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("task_reabrir", {
    p_task_id: id,
    p_motivo: motivo || null,
  });
  if (error) throw new Error(error.message);
}

export async function marcarNotificacionesLeidas(ids?: string[]): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("notificaciones_marcar_leidas", {
    p_ids: ids && ids.length ? ids : null,
  });
}

// ---------- Reglas de permiso en cliente (espejo del backend) ----------
// El backend es la autoridad; esto solo decide qué mostrar/ocultar.
export function esGestor(rol: string | null | undefined): boolean {
  return rol === "admin" || rol === "pm" || rol === "coordinacion";
}

// Transiciones que un usuario puede accionar desde un estado dado.
export function transicionesPermitidas(
  actual: TareaEstado,
  esGestorUsuario: boolean,
  requiereValidacion: boolean,
): TareaEstado[] {
  const base: Record<TareaEstado, TareaEstado[]> = {
    pendiente: ["en_proceso", "bloqueada", "cancelada"],
    en_proceso: ["en_revision", "cerrada", "bloqueada", "cancelada", "pendiente"],
    en_revision: ["cerrada", "en_proceso", "cancelada"],
    bloqueada: ["pendiente", "en_proceso", "cancelada"],
    reabierta: ["en_proceso", "en_revision", "cerrada", "bloqueada", "cancelada"],
    cerrada: [],
    cancelada: [],
  };
  let opciones = base[actual] ?? [];
  if (!esGestorUsuario) {
    // El ejecutor no cancela ni reabre.
    opciones = opciones.filter((e) => e !== "cancelada" && e !== "reabierta");
    // No cierra si requiere validación; tampoco valida desde revisión.
    opciones = opciones.filter((e) => {
      if (e === "cerrada") {
        if (requiereValidacion) return false;
        if (actual === "en_revision") return false;
      }
      return true;
    });
  }
  return opciones;
}
