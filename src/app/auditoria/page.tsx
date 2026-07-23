"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { formatFechaHora } from "@/lib/ui";
import { Breadcrumb } from "@/components/Breadcrumb";

interface Entrada {
  id: string;
  user_nombre: string | null;
  accion: string;
  entidad: string;
  detalle: string | null;
  proyecto_id: string | null;
  created_at: string;
}

const ICONO: Record<string, string> = {
  creado: "➕",
  editado: "✏️",
  eliminado: "🗑️",
};

export default function AuditoriaPage() {
  const { proyectos, cargado } = useStore();
  const supabase = createClient();
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fProyecto, setFProyecto] = useState<string>("Todos");

  const cargar = useCallback(async () => {
    let q = supabase
      .from("auditoria")
      .select("id,user_nombre,accion,entidad,detalle,proyecto_id,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (fProyecto !== "Todos") q = q.eq("proyecto_id", fProyecto);
    const { data } = await q;
    if (data) setEntradas(data as Entrada[]);
    setCargando(false);
  }, [supabase, fProyecto]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreProyecto = useMemo(() => {
    const m = new Map(proyectos.map((p) => [p.id, p.nombre]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [proyectos]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Registro de actividad" }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Registro de actividad
          </h1>
          <p className="mt-1 text-sm text-muted">
            Historial de cambios: quién, qué y cuándo.
          </p>
        </div>
        <select
          value={fProyecto}
          onChange={(e) => setFProyecto(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="Todos">Todos los proyectos</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {cargando || !cargado ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Cargando actividad…
          </p>
        ) : entradas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Aún no hay actividad registrada.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entradas.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 text-base">
                  {ICONO[e.accion] ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {e.user_nombre ?? "Sistema"}
                    </span>{" "}
                    <span className="text-muted">
                      {e.accion} {e.entidad}
                    </span>
                    {e.detalle && (
                      <>
                        : <span className="text-foreground">{e.detalle}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {nombreProyecto(e.proyecto_id)} · {formatFechaHora(e.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
