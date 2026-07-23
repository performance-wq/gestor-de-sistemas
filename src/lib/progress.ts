// Lógica de avance automática (sección 4 del documento maestro).
// Un punto está "Completo" cuando tiene copy guardado (imagen/video opcionales).
// % del proyecto = puntos completos ÷ puntos totales del proyecto.

import type { Proyecto, Sistema, Punto } from "./types";

export function puntoCompleto(p: Punto): boolean {
  return p.copy.trim().length > 0;
}

export function sistemaStats(s: Sistema): {
  completos: number;
  total: number;
  pct: number;
} {
  const total = s.puntos.length;
  const completos = s.puntos.filter(puntoCompleto).length;
  const pct = total === 0 ? 0 : Math.round((completos / total) * 100);
  return { completos, total, pct };
}

export function proyectoStats(p: Proyecto): {
  completos: number;
  total: number;
  pct: number;
} {
  let completos = 0;
  let total = 0;
  for (const s of p.sistemas) {
    for (const punto of s.puntos) {
      total += 1;
      if (puntoCompleto(punto)) completos += 1;
    }
  }
  const pct = total === 0 ? 0 : Math.round((completos / total) * 100);
  return { completos, total, pct };
}
