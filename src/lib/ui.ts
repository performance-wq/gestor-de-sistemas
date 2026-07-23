import type { Estado } from "./types";

export const ESTADOS: Estado[] = [
  "Pendiente",
  "En observación",
  "Entregado",
  "Performando",
];

export const estadoStyles: Record<
  Estado,
  { dot: string; badge: string; bar: string }
> = {
  Pendiente: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    bar: "bg-slate-400",
  },
  "En observación": {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    bar: "bg-amber-400",
  },
  Entregado: {
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    bar: "bg-blue-500",
  },
  Performando: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    bar: "bg-emerald-500",
  },
};

export function formatFecha(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
