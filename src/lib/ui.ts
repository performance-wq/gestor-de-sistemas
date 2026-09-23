import type { Estado } from "./types";

export const ESTADOS: Estado[] = [
  "Activo",
  "Pendiente",
  "En Espera",
  "Finalizado",
];

export const estadoStyles: Record<
  Estado,
  { dot: string; badge: string; bar: string }
> = {
  Activo: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    bar: "bg-emerald-500",
  },
  Pendiente: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    bar: "bg-slate-400",
  },
  "En Espera": {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    bar: "bg-amber-400",
  },
  Finalizado: {
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    bar: "bg-blue-500",
  },
};

export const NICHOS = [
  "Restaurante",
  "Estética",
  "Bienes Raíces",
  "Seguros",
  "Consultoría",
  "E-commerce",
  "Salud",
  "Educación",
  "Otros",
] as const;

export function formatFecha(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Avatar por nombre: inicial + un color estable derivado del texto.
const AVATAR_COLORES = [
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

export function inicial(nombre?: string | null): string {
  const t = (nombre ?? "").trim();
  return t ? t[0].toUpperCase() : "?";
}

export function avatarColor(nombre?: string | null): string {
  const t = (nombre ?? "").trim();
  if (!t) return "bg-slate-100 text-slate-500";
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return AVATAR_COLORES[h % AVATAR_COLORES.length];
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
