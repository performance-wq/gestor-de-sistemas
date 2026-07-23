// Modelo de datos del Gestor de Sistemas.
// Esta capa es agnóstica al backend: hoy se persiste en localStorage,
// en la Fase 1 se reemplaza por Supabase sin tocar la interfaz.

export type Estado =
  | "Pendiente"
  | "En observación"
  | "Entregado"
  | "Performando";

export interface Punto {
  id: string;
  nombre: string;
  copy: string;
  imagen?: string; // data URL (local) o URL firmada (Supabase)
  video?: string; // link a YouTube/Loom/Drive o URL firmada
  fijo?: boolean; // puntos fijos de la plantilla (ej. Agendamiento)
}

export interface Sistema {
  id: string;
  nombre: string;
  puntos: Punto[];
}

export interface Proyecto {
  id: string;
  nombre: string;
  estado: Estado;
  fechaIncorporacion: string; // ISO (yyyy-mm-dd)
  fechaCierre?: string; // ISO
  sistemas: Sistema[];
  creado: string; // ISO datetime
}
