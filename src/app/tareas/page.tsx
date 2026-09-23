"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  ESTADOS_ABIERTOS,
  ESTADOS_TAREA,
  PRIORIDADES,
  TIPOS,
  esGestor,
  listarMiembros,
  listarTareas,
  type Miembro,
  type Tarea,
  type TareaEstado,
} from "@/lib/tasks";
import { ListaTareas } from "@/components/ListaTareas";
import { TableroTareas } from "@/components/TableroTareas";
import { NuevaTareaModal } from "@/components/NuevaTareaModal";
import { TareaDetalle } from "@/components/TareaDetalle";

type FiltroEstado = TareaEstado | "abiertas" | "todas";
type Vista = "lista" | "tablero";

export default function GestionTareas() {
  const { usuario, proyectos } = useStore();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [fEstado, setFEstado] = useState<FiltroEstado>("abiertas");
  const [fPrioridad, setFPrioridad] = useState<string>("todas");
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fResponsable, setFResponsable] = useState<string>("todos");
  const [misTareas, setMisTareas] = useState(false);

  const [nueva, setNueva] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("lista");
  const puedeCrear = esGestor(usuario?.rol);

  // Recuerda la vista preferida por navegador.
  useEffect(() => {
    try {
      const v = localStorage.getItem("pex_vista_tareas");
      if (v === "tablero" || v === "lista") setVista(v);
    } catch {}
  }, []);
  function cambiarVista(v: Vista) {
    setVista(v);
    try {
      localStorage.setItem("pex_vista_tareas", v);
    } catch {}
  }

  const cargar = useCallback(async () => {
    const t = await listarTareas();
    setTareas(t);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    listarMiembros().then(setMiembros);
  }, [cargar]);

  const nombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of miembros) m[x.id] = x.nombre;
    return m;
  }, [miembros]);

  const proyectoNombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of proyectos) m[p.id] = p.nombre;
    return m;
  }, [proyectos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // Para un ejecutor, "abiertas" excluye En revisión (ya no es suya para
    // trabajar); un gestor sí ve las de revisión.
    const abiertasActivas = puedeCrear
      ? ESTADOS_ABIERTOS
      : ESTADOS_ABIERTOS.filter((e) => e !== "en_revision");
    return tareas.filter((t) => {
      if (misTareas && t.responsableId !== usuario?.id) return false;
      if (fEstado === "abiertas" && !abiertasActivas.includes(t.estado))
        return false;
      if (
        fEstado !== "abiertas" &&
        fEstado !== "todas" &&
        t.estado !== fEstado
      )
        return false;
      if (fPrioridad !== "todas" && t.prioridad !== fPrioridad) return false;
      if (fTipo !== "todos" && t.tipo !== fTipo) return false;
      if (fResponsable !== "todos") {
        if (fResponsable === "nadie" && t.responsableId) return false;
        if (fResponsable !== "nadie" && t.responsableId !== fResponsable)
          return false;
      }
      if (q) {
        const campos = [t.titulo, proyectoNombrePorId[t.proyectoId]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!campos.includes(q)) return false;
      }
      return true;
    });
  }, [
    tareas,
    misTareas,
    usuario,
    fEstado,
    fPrioridad,
    fTipo,
    fResponsable,
    busqueda,
    proyectoNombrePorId,
    puedeCrear,
  ]);

  const abiertas = tareas.filter((t) => ESTADOS_ABIERTOS.includes(t.estado));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Gestión de tareas
          </h1>
          <p className="mt-1 text-sm text-muted">
            {abiertas.length} abierta{abiertas.length === 1 ? "" : "s"} ·{" "}
            {tareas.length} en total
          </p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setNueva(true)}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            + Nueva tarea
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="mt-6">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            🔍
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título o proyecto…"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMisTareas((v) => !v)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            misTareas
              ? "bg-accent text-white"
              : "bg-surface text-muted ring-1 ring-inset ring-border hover:text-foreground"
          }`}
        >
          Mis tareas
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <select
          value={fEstado}
          onChange={(e) => setFEstado(e.target.value as FiltroEstado)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted outline-none focus:border-accent focus:text-foreground"
        >
          <option value="abiertas">Abiertas</option>
          <option value="todas">Todos los estados</option>
          {ESTADOS_TAREA.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>
        <select
          value={fPrioridad}
          onChange={(e) => setFPrioridad(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted outline-none focus:border-accent focus:text-foreground"
        >
          <option value="todas">Toda prioridad</option>
          {PRIORIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={fTipo}
          onChange={(e) => setFTipo(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted outline-none focus:border-accent focus:text-foreground"
        >
          <option value="todos">Todo tipo</option>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={fResponsable}
          onChange={(e) => setFResponsable(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted outline-none focus:border-accent focus:text-foreground"
        >
          <option value="todos">Todo responsable</option>
          <option value="nadie">Sin asignar</option>
          {miembros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Toggle de vista */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {visibles.length} tarea{visibles.length === 1 ? "" : "s"}
        </span>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => cambiarVista("lista")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              vista === "lista"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            ☰ Lista
          </button>
          <button
            onClick={() => cambiarVista("tablero")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              vista === "tablero"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            ▦ Tablero
          </button>
        </div>
      </div>

      {/* Lista / Tablero */}
      <div className="mt-4">
        {cargando ? (
          <div className="py-20 text-center text-sm text-muted">Cargando…</div>
        ) : vista === "tablero" ? (
          <TableroTareas
            tareas={visibles}
            nombrePorId={nombrePorId}
            proyectoNombrePorId={proyectoNombrePorId}
            onOpen={(id) => setDetalle(id)}
          />
        ) : (
          <ListaTareas
            tareas={visibles}
            nombrePorId={nombrePorId}
            proyectoNombrePorId={proyectoNombrePorId}
            onOpen={(id) => setDetalle(id)}
          />
        )}
      </div>

      {nueva && puedeCrear && (
        <NuevaTareaModal
          onClose={() => setNueva(false)}
          onCreated={() => cargar()}
        />
      )}
      {detalle && (
        <TareaDetalle
          tareaId={detalle}
          onClose={() => setDetalle(null)}
          onChanged={() => cargar()}
        />
      )}
    </div>
  );
}
