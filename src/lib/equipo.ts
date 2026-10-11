"use client";

// Helpers de equipo/roles usados fuera de la gestión de tareas
// (encabezado, dashboard, proyectos). Antes vivían en lib/tasks.ts.

import { createClient } from "./supabase/client";

export interface Miembro {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

type Row = Record<string, unknown>;

// Gestores = quienes ven/controlan todo (admin, pm, coordinación).
export function esGestor(rol: string | null | undefined): boolean {
  return rol === "admin" || rol === "pm" || rol === "coordinacion";
}

// Lista de miembros activos (RPC listar_miembros).
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
