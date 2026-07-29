// Utilidades del checklist jerárquico (tareas principales + subtareas).
// Compartidas por la vista interna y la vista pública del cliente.

import type { ChecklistItem } from "./types";

export interface Nodo {
  item: ChecklistItem;
  numero: string; // "1", "3", "3.1"
  esSub: boolean;
}

export interface Bloque {
  principal: Nodo;
  subs: Nodo[];
}

const esSubtarea = (i: ChecklistItem) => !i.esGrupo && !!i.grupo;

// Numera los ítems (1, 2, 3, 3.1, 3.2, …) respetando el orden.
export function estructurar(items: ChecklistItem[]): Nodo[] {
  const orden = [...items].sort((a, b) => a.orden - b.orden);
  let m = 0;
  let s = 0;
  return orden.map((item) => {
    if (esSubtarea(item)) {
      s += 1;
      return { item, numero: `${m}.${s}`, esSub: true };
    }
    m += 1;
    s = 0;
    return { item, numero: `${m}`, esSub: false };
  });
}

// Agrupa cada principal con sus subtareas (para que no se corten en columnas).
export function bloques(nodos: Nodo[]): Bloque[] {
  const res: Bloque[] = [];
  for (const n of nodos) {
    if (n.esSub && res.length) res[res.length - 1].subs.push(n);
    else res.push({ principal: n, subs: [] });
  }
  return res;
}

// El avance se calcula solo con las HOJAS (los grupos son roll-up, no cuentan).
export function contarHojas(items: ChecklistItem[]) {
  const hojas = items.filter((i) => !i.esGrupo);
  const total = hojas.length;
  const completas = hojas.filter((i) => i.completado).length;
  return {
    total,
    completas,
    pendientes: total - completas,
    pct: total ? Math.round((completas / total) * 100) : 0,
  };
}

// Recalcula localmente el estado de cada grupo (espejo del trigger de BD):
// un grupo está completo si todas sus subtareas lo están. Da respuesta
// inmediata en la UI sin esperar el refetch.
export function recomputarGrupos(items: ChecklistItem[]): ChecklistItem[] {
  const completoPorGrupo = new Map<string, boolean>();
  const subsPorGrupo = new Map<string, ChecklistItem[]>();
  for (const it of items) {
    if (!it.esGrupo && it.grupo) {
      const arr = subsPorGrupo.get(it.grupo) ?? [];
      arr.push(it);
      subsPorGrupo.set(it.grupo, arr);
    }
  }
  for (const [g, subs] of subsPorGrupo)
    completoPorGrupo.set(g, subs.every((s) => s.completado));

  return items.map((it) =>
    it.esGrupo && it.grupo
      ? { ...it, completado: completoPorGrupo.get(it.grupo) ?? it.completado }
      : it,
  );
}
