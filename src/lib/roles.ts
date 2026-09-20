// Roles operativos de System PEX / LexBrain.
// El backend (RLS + RPCs) es la fuente de verdad de permisos; esto es
// para etiquetas y selectores del frontend.

export const ROLES = [
  { valor: "admin", label: "Administrador" },
  { valor: "pm", label: "Project Manager" },
  { valor: "coordinacion", label: "Coordinación" },
  { valor: "implementacion", label: "Implementación" },
  { valor: "subcuenta", label: "Colaborador" },
] as const;

export type RolValor = (typeof ROLES)[number]["valor"];

export function etiquetaRol(rol: string | null | undefined): string {
  return ROLES.find((r) => r.valor === rol)?.label ?? rol ?? "—";
}

// Roles que ven TODOS los proyectos (coincide con puede_ver_todo() en la BD).
export function veTodo(rol: string | null | undefined): boolean {
  return rol === "admin" || rol === "pm" || rol === "coordinacion";
}

// Roles cuyo acceso a proyectos es por asignación explícita.
export function accesoPorAsignacion(rol: string | null | undefined): boolean {
  return rol === "implementacion" || rol === "subcuenta";
}
