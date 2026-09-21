"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useStore } from "@/lib/store";
import { subirAsset } from "@/lib/storage";
import {
  crearTarea,
  listarMiembros,
  TIPOS,
  PRIORIDADES,
  type Miembro,
  type TareaPrioridad,
  type TareaTipo,
} from "@/lib/tasks";

// Crear tarea. El proyecto se elige por un selector con búsqueda y se guarda por
// id interno (nunca por el nombre escrito). Si se abre desde un proyecto, viene
// preseleccionado y bloqueado. Nunca se crean proyectos desde aquí.
export function NuevaTareaModal({
  onClose,
  onCreated,
  proyectoIdFijo,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
  proyectoIdFijo?: string;
}) {
  const { proyectos } = useStore();

  const [proyectoId, setProyectoId] = useState<string>(proyectoIdFijo ?? "");
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [abiertoSelector, setAbiertoSelector] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TareaTipo>("solicitud");
  const [prioridad, setPrioridad] = useState<TareaPrioridad>("normal");
  const [responsableId, setResponsableId] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [sistemaId, setSistemaId] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [requiereValidacion, setRequiereValidacion] = useState(false);
  const [mostrarOpcionales, setMostrarOpcionales] = useState(false);
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const [evidenciaPreview, setEvidenciaPreview] = useState<string | null>(null);
  const [subiendoEvid, setSubiendoEvid] = useState(false);

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarMiembros().then(setMiembros);
  }, []);

  const proyectoSel = useMemo(
    () => proyectos.find((p) => p.id === proyectoId),
    [proyectos, proyectoId],
  );

  const sistemas = proyectoSel?.sistemas ?? [];

  const proyectosFiltrados = useMemo(() => {
    const q = busquedaProyecto.trim().toLowerCase();
    const base = proyectos;
    if (!q) return base.slice(0, 30);
    return base
      .filter((p) =>
        [p.nombre, p.cliente].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [proyectos, busquedaProyecto]);

  async function guardar() {
    setError(null);
    if (!proyectoId) {
      setError("Selecciona un proyecto.");
      return;
    }
    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      const id = await crearTarea({
        proyectoId,
        titulo,
        tipo,
        prioridad,
        responsableId: responsableId || null,
        deadline: deadline || null,
        sistemaId: sistemaId || null,
        descripcion: descripcion || "",
        requiereValidacion,
        evidencia,
      });
      if (id && onCreated) onCreated(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la tarea.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onClose={onClose}
      titulo="Nueva tarea"
      ancho="max-w-xl"
      acciones={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? "Creando…" : "Crear tarea"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Proyecto */}
        <div>
          <label className="mb-1 block text-sm font-medium">Proyecto *</label>
          {proyectoIdFijo ? (
            <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">
              {proyectoSel?.nombre ?? "—"}
            </div>
          ) : (
            <div className="relative">
              <input
                value={
                  abiertoSelector
                    ? busquedaProyecto
                    : proyectoSel?.nombre ?? busquedaProyecto
                }
                onChange={(e) => {
                  setBusquedaProyecto(e.target.value);
                  setAbiertoSelector(true);
                }}
                onFocus={() => {
                  setAbiertoSelector(true);
                  setBusquedaProyecto("");
                }}
                placeholder="Buscar proyecto por nombre o cliente…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              {abiertoSelector && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                  {proyectosFiltrados.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted">
                      Sin coincidencias
                    </div>
                  ) : (
                    proyectosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProyectoId(p.id);
                          setSistemaId("");
                          setAbiertoSelector(false);
                        }}
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium">{p.nombre}</span>
                        {p.cliente && (
                          <span className="text-xs text-muted">{p.cliente}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="mb-1 block text-sm font-medium">Título *</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Ajustar el flujo de seguimiento"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Tipo + Prioridad */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TareaTipo)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Responsable + Deadline */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Responsable</label>
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Sin asignar</option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Opcionales */}
        {!mostrarOpcionales ? (
          <button
            onClick={() => setMostrarOpcionales(true)}
            className="text-sm font-medium text-accent hover:underline"
          >
            + Sistema y descripción (opcional)
          </button>
        ) : (
          <div className="space-y-4 rounded-lg border border-dashed border-border p-3">
            {sistemas.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Sistema</label>
                <select
                  value={sistemaId}
                  onChange={(e) => setSistemaId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
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
            <div>
              <label className="mb-1 block text-sm font-medium">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Contexto o detalle de la tarea…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {/* Evidencia (1 imagen opcional) */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Evidencia <span className="font-normal text-muted">(opcional)</span>
              </label>
              <p className="mb-2 text-xs text-muted">
                Una imagen: captura, bug, referencia visual o instrucción gráfica.
              </p>
              {evidenciaPreview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidenciaPreview}
                    alt="Evidencia"
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                  <button
                    onClick={() => {
                      setEvidencia(null);
                      setEvidenciaPreview(null);
                    }}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Quitar imagen
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-surface px-3 py-4 text-sm text-muted hover:border-accent hover:text-foreground">
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
                      setError(null);
                      const path = await subirAsset(file, "tareas");
                      setSubiendoEvid(false);
                      if (!path) {
                        setError("No se pudo subir la imagen.");
                        return;
                      }
                      setEvidencia(path);
                      setEvidenciaPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Requiere validación */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiereValidacion}
            onChange={(e) => setRequiereValidacion(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          Requiere validación al cerrar (el ejecutor la envía a revisión)
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
