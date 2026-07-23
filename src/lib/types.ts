// Modelo de datos de Systems PEX.

export type Estado = "Activo" | "Pendiente" | "En Espera" | "Finalizado";

export type PuntoTipo = "estandar" | "texto" | "landing";

export interface Punto {
  id: string;
  nombre: string;
  copy: string;
  imagen?: string; // path en storage
  video?: string; // link o path en storage
  url?: string; // solo tipo 'landing'
  tipo: PuntoTipo;
  programacion?: string; // ej. "Después de 1 día"
  fijo?: boolean;
  actualizadoEn?: string | null;
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
  cliente?: string;
  nicho?: string;
  palabrasClave?: string;
  fechaIncorporacion: string;
  fechaCierre?: string;
  // Datos de control del proyecto
  resultadoAntes?: number | null;
  resultadoAntesFecha?: string | null;
  resultadoCon?: number | null;
  resultadoConFecha?: string | null;
  evidenciaImagen?: string;
  evidenciaVideo?: string;
  sistemas: Sistema[];
  creado: string;
  actualizadoEn?: string | null;
}

export interface EntradaAuditoria {
  id: string;
  userNombre: string;
  accion: string;
  entidad: string;
  detalle: string;
  createdAt: string;
}
