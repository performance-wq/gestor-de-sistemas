"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useStore } from "@/lib/store";
import { etiquetaRol } from "@/lib/roles";
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
  transicionesPermitidas,
  transicionTarea,
  type Miembro,
  type Tarea,
  type TareaComentario,
  type TareaEstado,
  type TareaHistorial,
  type TareaPrioridad,
  type TareaTipo,
} from "@/lib/tasks";

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

  const nombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of miembros) m[x.id] = x.nombre;
    return m;
  }, [miembros]);

  const cargar = useCallback(async () => {
    const [t, h, c] = await Promise.all([
      obtenerTarea(tareaId),
      listarHistorial(tareaId),
      listarComentarios(tareaId),
    ]);
    setTarea(t);
    setHistorial(h);
    setComentarios(c);
    setCargando(false);
  }, [tareaId]);

  useEffect(() => {
    cargar();
    listarMiembros().then(setMiembros);
  }, [cargar]);

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

  const opciones = tarea
    ? transicionesPermitidas(tarea.estado, gestor, tarea.requiereValidacion)
    : [];

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

          {/* Acciones de estado */}
          <div className="flex flex-wrap gap-2">
            {opciones.map((e) => (
              <button
                key={e}
                onClick={() => accionEstado(e)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                {rotuloAccion(e)}
              </button>
            ))}
            {gestor &&
              (tarea.estado === "cerrada" || tarea.estado === "cancelada") && (
                <button
                  onClick={reabrir}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                >
                  Reabrir
                </button>
              )}
            {gestor && (
              <button
                onClick={() => setEditando(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Editar
              </button>
            )}
          </div>

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

function rotuloAccion(e: TareaEstado): string {
  switch (e) {
    case "en_proceso":
      return "Iniciar / En proceso";
    case "en_revision":
      return "Enviar a revisión";
    case "cerrada":
      return "Cerrar";
    case "bloqueada":
      return "Bloquear";
    case "cancelada":
      return "Cancelar";
    case "pendiente":
      return "Volver a pendiente";
    default:
      return etiquetaEstado(e);
  }
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
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
