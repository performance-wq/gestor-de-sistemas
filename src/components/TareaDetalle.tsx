"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { VisorMedia } from "./VisorMedia";
import { CronometroTarea } from "./CronometroTarea";
import { useStore } from "@/lib/store";
import { etiquetaRol } from "@/lib/roles";
import { subirAsset, urlFirmada } from "@/lib/storage";
import { descargarArchivo } from "@/lib/download";
import { formatFecha, formatFechaHora } from "@/lib/ui";
import {
  chipEstado,
  chipPrioridad,
  comentarTarea,
  editarTarea,
  esGestor,
  etiquetaEstado,
  etiquetaPrioridad,
  etiquetaTipo,
  listarComentarios,
  listarHistorial,
  listarMiembros,
  obtenerTarea,
  PRIORIDADES,
  reabrirTarea,
  TIPOS,
  transicionTarea,
  type Miembro,
  type Tarea,
  type TareaComentario,
  type TareaEstado,
  type TareaHistorial,
  type TareaPrioridad,
  type TareaTipo,
} from "@/lib/tasks";
import {
  formatHM,
  listarEventosTarea,
  revisionTerminar,
  terminarTarea,
  tiemposPorTarea,
  type RegistroTiempo,
} from "@/lib/tiempo";

// Detalle de una tarea con acciones de estado, edición (gestores), comentarios
// y el historial inmutable. El backend valida cada acción; aquí solo mostramos
// lo permitido y reportamos el error si el backend rechaza.
export function TareaDetalle({
  tareaId,
  onClose,
  onChanged,
}: {
  tareaId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { usuario, proyectos } = useStore();
  const gestor = esGestor(usuario?.rol);

  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [historial, setHistorial] = useState<TareaHistorial[]>([]);
  const [comentarios, setComentarios] = useState<TareaComentario[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [editando, setEditando] = useState(false);
  const [tab, setTab] = useState<"comentarios" | "historial">("comentarios");
  const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null);
  const [visor, setVisor] = useState(false);
  const [eventos, setEventos] = useState<RegistroTiempo[]>([]);
  const [cronoKey, setCronoKey] = useState(0);
  const [confirmTerminar, setConfirmTerminar] = useState(false);
  const [confirmRevision, setConfirmRevision] = useState(false);
  const [motivoRev, setMotivoRev] = useState("");
  const [accionando, setAccionando] = useState(false);

  const nombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of miembros) m[x.id] = x.nombre;
    return m;
  }, [miembros]);

  const cargar = useCallback(async () => {
    const [t, h, c, ev] = await Promise.all([
      obtenerTarea(tareaId),
      listarHistorial(tareaId),
      listarComentarios(tareaId),
      listarEventosTarea(tareaId),
    ]);
    setTarea(t);
    setHistorial(h);
    setComentarios(c);
    setEventos(ev);
    setCronoKey((k) => k + 1);
    setCargando(false);
  }, [tareaId]);

  const tiempos = useMemo(
    () => tiemposPorTarea(eventos).get(tareaId),
    [eventos, tareaId],
  );

  async function terminar() {
    if (!tarea) return;
    setAccionando(true);
    setError(null);
    try {
      await terminarTarea(tarea.id);
      setConfirmTerminar(false);
      await cargar();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo terminar la tarea.");
    } finally {
      setAccionando(false);
    }
  }

  async function finalizarRevision(resultado: "aprobar" | "correcciones") {
    if (!tarea) return;
    setAccionando(true);
    setError(null);
    try {
      await revisionTerminar(tarea.id, resultado, motivoRev || undefined);
      setConfirmRevision(false);
      setMotivoRev("");
      await cargar();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo finalizar la revisión.");
    } finally {
      setAccionando(false);
    }
  }

  useEffect(() => {
    cargar();
    listarMiembros().then(setMiembros);
  }, [cargar]);

  // Resuelve la URL firmada de la evidencia cuando cambia.
  useEffect(() => {
    let vivo = true;
    if (tarea?.evidencia) {
      urlFirmada(tarea.evidencia).then((u) => vivo && setEvidenciaUrl(u));
    } else {
      setEvidenciaUrl(null);
    }
    return () => {
      vivo = false;
    };
  }, [tarea?.evidencia]);

  const proyecto = useMemo(
    () => proyectos.find((p) => p.id === tarea?.proyectoId),
    [proyectos, tarea],
  );
  const sistema = useMemo(
    () => proyecto?.sistemas.find((s) => s.id === tarea?.sistemaId),
    [proyecto, tarea],
  );

  async function accionEstado(estado: TareaEstado) {
    if (!tarea) return;
    let nota: string | undefined;
    if (estado === "bloqueada" || estado === "cancelada") {
      nota = window.prompt(`Motivo (${etiquetaEstado(estado)}):`) ?? undefined;
    }
    setError(null);
    try {
      await transicionTarea(tarea.id, estado, nota);
      await cargar();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    }
  }

  async function reabrir() {
    if (!tarea) return;
    const motivo = window.prompt("Motivo de reapertura:") ?? undefined;
    setError(null);
    try {
      await reabrirTarea(tarea.id, motivo);
      await cargar();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reabrir.");
    }
  }

  async function enviarComentario() {
    if (!tarea || !nuevoComentario.trim()) return;
    setError(null);
    try {
      await comentarTarea(tarea.id, nuevoComentario);
      setNuevoComentario("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo comentar.");
    }
  }


  return (
    <Modal
      abierto
      onClose={onClose}
      ancho="max-w-2xl"
      titulo={
        cargando ? "Cargando…" : tarea ? tarea.titulo : "Tarea no encontrada"
      }
    >
      {cargando ? (
        <div className="py-10 text-center text-sm text-muted">Cargando…</div>
      ) : !tarea ? (
        <div className="py-10 text-center text-sm text-muted">
          No se encontró la tarea o no tienes acceso.
        </div>
      ) : editando && gestor ? (
        <EdicionTarea
          tarea={tarea}
          miembros={miembros}
          sistemas={proyecto?.sistemas ?? []}
          onCancel={() => setEditando(false)}
          onSaved={async () => {
            setEditando(false);
            await cargar();
            onChanged?.();
          }}
        />
      ) : (
        <div className="space-y-5">
          {/* Cabecera de estado */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${chipEstado(
                tarea.estado,
              )}`}
            >
              {etiquetaEstado(tarea.estado)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${chipPrioridad(
                tarea.prioridad,
              )}`}
            >
              {etiquetaPrioridad(tarea.prioridad)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {etiquetaTipo(tarea.tipo)}
            </span>
            {tarea.requiereValidacion && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                Requiere validación
              </span>
            )}
            {tarea.reabiertaCount > 0 && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                Reabierta ×{tarea.reabiertaCount}
              </span>
            )}
          </div>

          {/* Metadatos */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Meta label="Proyecto" valor={proyecto?.nombre ?? "—"} />
            <Meta label="Sistema" valor={sistema?.nombre ?? "—"} />
            <Meta
              label="Responsable"
              valor={tarea.responsableId ? nombrePorId[tarea.responsableId] ?? "—" : "Sin asignar"}
            />
            <Meta label="Fecha límite" valor={formatFecha(tarea.deadline)} />
            <Meta
              label="Creada por"
              valor={tarea.creadoPor ? nombrePorId[tarea.creadoPor] ?? "—" : "—"}
            />
            <Meta label="Creada" valor={formatFechaHora(tarea.createdAt)} />
          </div>

          {tarea.descripcion && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Descripción
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm">
                {tarea.descripcion}
              </p>
            </div>
          )}

          {tarea.evidencia && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Evidencia
              </div>
              {evidenciaUrl ? (
                <button
                  onClick={() => setVisor(true)}
                  className="group relative block overflow-hidden rounded-lg border border-border"
                  title="Ver en grande"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidenciaUrl}
                    alt="Evidencia"
                    className="h-32 w-auto max-w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    🔍 Ampliar
                  </span>
                </button>
              ) : (
                <p className="text-sm text-muted">Cargando imagen…</p>
              )}
            </div>
          )}

          <VisorMedia
            abierto={visor}
            onClose={() => setVisor(false)}
            titulo={`Evidencia — ${tarea.titulo}`}
            copy={tarea.descripcion || ""}
            tipo="imagen"
            url={evidenciaUrl}
            onDescargar={
              evidenciaUrl
                ? () => descargarArchivo(evidenciaUrl, "evidencia.jpg")
                : undefined
            }
          />

          {/* Resumen de tiempos reales (cronómetro) */}
          {tiempos && tiempos.totalMs > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span>
                Ejecutor: <strong>{formatHM(tiempos.ejecutorMs)}</strong>
              </span>
              <span>
                Revisor: <strong>{formatHM(tiempos.revisorMs)}</strong>
              </span>
              <span>
                Total: <strong>{formatHM(tiempos.totalMs)}</strong>
              </span>
              <span className="text-muted">
                {tiempos.nSesiones} sesión(es) · {tiempos.nRevisiones}{" "}
                revisión(es) · {tiempos.nCorrecciones} corrección(es)
              </span>
            </div>
          )}

          {/* Cronómetro del EJECUTOR + Terminar tarea */}
          {usuario &&
            ["pendiente", "en_proceso", "reabierta"].includes(tarea.estado) &&
            (usuario.id === tarea.responsableId || gestor) && (
              <div className="space-y-2">
                <CronometroTarea
                  tareaId={tarea.id}
                  userId={usuario.id}
                  labelIniciar="Iniciar tarea"
                  refreshKey={cronoKey}
                  onCambio={cargar}
                />
                <button
                  onClick={() => setConfirmTerminar(true)}
                  className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
                >
                  ✓ Terminar tarea
                </button>
              </div>
            )}

          {/* Cronómetro del REVISOR + Finalizar revisión (solo gestor) */}
          {usuario && tarea.estado === "en_revision" && gestor && (
            <div className="space-y-2">
              <CronometroTarea
                tareaId={tarea.id}
                userId={usuario.id}
                labelIniciar="Iniciar revisión"
                refreshKey={cronoKey}
                onCambio={cargar}
              />
              <button
                onClick={() => setConfirmRevision(true)}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                Finalizar revisión
              </button>
            </div>
          )}

          {/* Ejecutor: la tarea está en revisión (solo lectura) */}
          {tarea.estado === "en_revision" && !gestor && (
            <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              Esta tarea está <strong>en revisión</strong>. Un responsable la
              validará; por ahora no es editable para ti.
            </div>
          )}

          {/* Gestión (solo gestor) */}
          {gestor && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {(tarea.estado === "cerrada" || tarea.estado === "cancelada") && (
                <button
                  onClick={reabrir}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                >
                  Reabrir
                </button>
              )}
              {["pendiente", "en_proceso", "reabierta"].includes(tarea.estado) && (
                <button
                  onClick={() => accionEstado("bloqueada")}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  Bloquear
                </button>
              )}
              {tarea.estado === "bloqueada" && (
                <button
                  onClick={() => accionEstado("en_proceso")}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  Desbloquear
                </button>
              )}
              {tarea.estado !== "cerrada" && tarea.estado !== "cancelada" && (
                <button
                  onClick={() => accionEstado("cancelada")}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => setEditando(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Editar
              </button>
            </div>
          )}

          {/* Confirmación: Terminar tarea */}
          {confirmTerminar && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm font-semibold">¿Quieres finalizar esta tarea?</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                <li>• Se detendrá definitivamente tu cronómetro.</li>
                <li>• Dejará de ser editable para ti.</li>
                <li>
                  • Pasará a{" "}
                  {tarea.requiereValidacion ? "En revisión" : "Cerrada"}.
                </li>
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmTerminar(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={terminar}
                  disabled={accionando}
                  className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Sí, terminar tarea
                </button>
              </div>
            </div>
          )}

          {/* Confirmación: Finalizar revisión */}
          {confirmRevision && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm font-semibold">Finalizar revisión</p>
              <textarea
                value={motivoRev}
                onChange={(e) => setMotivoRev(e.target.value)}
                rows={2}
                placeholder="Nota / motivo (opcional, útil al solicitar correcciones)…"
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setConfirmRevision(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => finalizarRevision("correcciones")}
                  disabled={accionando}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  Solicitar correcciones
                </button>
                <button
                  onClick={() => finalizarRevision("aprobar")}
                  disabled={accionando}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Aprobar y cerrar
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Pestañas: comentarios / historial */}
          <div className="border-t border-border pt-4">
            <div className="mb-3 flex gap-2">
              <TabBtn activo={tab === "comentarios"} onClick={() => setTab("comentarios")}>
                Comentarios ({comentarios.length})
              </TabBtn>
              <TabBtn activo={tab === "historial"} onClick={() => setTab("historial")}>
                Historial ({historial.length})
              </TabBtn>
            </div>

            {tab === "comentarios" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && enviarComentario()}
                    placeholder="Escribe un comentario…"
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <button
                    onClick={enviarComentario}
                    disabled={!nuevoComentario.trim()}
                    className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </div>
                {comentarios.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted">
                    Sin comentarios todavía.
                  </p>
                ) : (
                  comentarios.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted">
                        <span className="font-medium text-foreground">
                          {c.autorId ? nombrePorId[c.autorId] ?? "—" : "—"}
                        </span>
                        <span>{formatFechaHora(c.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{c.cuerpo}</p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {historial.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted">Sin registros.</p>
                ) : (
                  historial.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start gap-3 border-l-2 border-border pl-3 text-sm"
                    >
                      <div className="flex-1">
                        <span className="font-medium">
                          {h.actorId ? nombrePorId[h.actorId] ?? "—" : "Sistema"}
                        </span>{" "}
                        <span className="text-muted">{descripcionHistorial(h)}</span>
                        {h.nota && (
                          <div className="mt-0.5 text-xs italic text-muted">
                            “{h.nota}”
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {formatFechaHora(h.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Meta({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div>{valor}</div>
    </div>
  );
}

function TabBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        activo ? "bg-foreground text-white" : "text-muted hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function descripcionHistorial(h: TareaHistorial): string {
  switch (h.accion) {
    case "creada":
      return "creó la tarea";
    case "estado":
      return `cambió el estado: ${etiquetaEstado(
        (h.valorAnterior as TareaEstado) ?? "",
      )} → ${etiquetaEstado((h.valorNuevo as TareaEstado) ?? "")}`;
    case "asignada":
      return "actualizó el responsable";
    case "reabierta":
      return "reabrió la tarea";
    case "comentario":
      return "comentó";
    case "editada":
      return `editó ${h.campo ?? "un campo"}`;
    default:
      return h.accion;
  }
}

// --- Sub-formulario de edición (solo gestores) ---
function EdicionTarea({
  tarea,
  miembros,
  sistemas,
  onCancel,
  onSaved,
}: {
  tarea: Tarea;
  miembros: Miembro[];
  sistemas: { id: string; nombre: string }[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [descripcion, setDescripcion] = useState(tarea.descripcion);
  const [tipo, setTipo] = useState<TareaTipo>(tarea.tipo);
  const [prioridad, setPrioridad] = useState<TareaPrioridad>(tarea.prioridad);
  const [responsableId, setResponsableId] = useState<string>(
    tarea.responsableId ?? "",
  );
  const [deadline, setDeadline] = useState<string>(tarea.deadline ?? "");
  const [sistemaId, setSistemaId] = useState<string>(tarea.sistemaId ?? "");
  const [evidencia, setEvidencia] = useState<string | null>(tarea.evidencia);
  const [evidPreview, setEvidPreview] = useState<string | null>(null);
  const [subiendoEvid, setSubiendoEvid] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (tarea.evidencia)
      urlFirmada(tarea.evidencia).then((u) => vivo && setEvidPreview(u));
    return () => {
      vivo = false;
    };
  }, [tarea.evidencia]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await editarTarea(tarea.id, {
        titulo: titulo.trim() !== tarea.titulo ? titulo.trim() : undefined,
        descripcion: descripcion !== tarea.descripcion ? descripcion : undefined,
        tipo: tipo !== tarea.tipo ? tipo : undefined,
        prioridad: prioridad !== tarea.prioridad ? prioridad : undefined,
        responsableId: responsableId || null,
        setResponsable: (responsableId || null) !== tarea.responsableId,
        deadline: deadline || null,
        setDeadline: (deadline || null) !== tarea.deadline,
        sistemaId: sistemaId || null,
        setSistema: (sistemaId || null) !== tarea.sistemaId,
        evidencia: evidencia,
        setEvidencia: evidencia !== tarea.evidencia,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Título</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TareaTipo)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Prioridad</label>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as TareaPrioridad)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {PRIORIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Responsable</label>
          <select
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">Sin asignar</option>
            {miembros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} · {etiquetaRol(m.rol)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha límite</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>
      {sistemas.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Sistema</label>
          <select
            value={sistemaId}
            onChange={(e) => setSistemaId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">Sin sistema</option>
            {sistemas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Evidencia: reemplazar o quitar */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          Evidencia <span className="font-normal text-muted">(opcional)</span>
        </label>
        {evidencia ? (
          <div className="flex items-center gap-3">
            {evidPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={evidPreview}
                alt="Evidencia"
                className="h-20 w-20 rounded-lg border border-border object-cover"
              />
            )}
            <div className="flex flex-col gap-1">
              <label className="cursor-pointer text-sm font-medium text-accent hover:underline">
                {subiendoEvid ? "Subiendo…" : "Reemplazar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={subiendoEvid}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSubiendoEvid(true);
                    const path = await subirAsset(file, "tareas");
                    setSubiendoEvid(false);
                    if (path) {
                      setEvidencia(path);
                      setEvidPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              <button
                onClick={() => {
                  setEvidencia(null);
                  setEvidPreview(null);
                }}
                className="text-left text-sm font-medium text-red-600 hover:underline"
              >
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted hover:border-accent hover:text-foreground">
            {subiendoEvid ? "Subiendo…" : "📎 Subir imagen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={subiendoEvid}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSubiendoEvid(true);
                const path = await subirAsset(file, "tareas");
                setSubiendoEvid(false);
                if (path) {
                  setEvidencia(path);
                  setEvidPreview(URL.createObjectURL(file));
                }
              }}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
