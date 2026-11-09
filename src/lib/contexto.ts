// Módulo "Contexto IA": conversaciones modelo por servicio para alinear la IA en GHL.
// El cliente responde como su negocio le respondería a un cliente final por WhatsApp.

export interface ArchivoCtx {
  path: string;
  nombre: string;
  tipo: string; // mime
}

export interface Turno {
  cliente: string; // lo que pregunta el cliente final
  negocio: string; // cómo responde el negocio
  archivos: ArchivoCtx[];
  extra?: boolean; // pregunta agregada por el negocio
}

export interface ServicioCtx {
  id: string;
  proyecto_id: string;
  categoria: string;
  nombre: string;
  token: string;
  turnos: Turno[];
  estado: "pendiente" | "completado";
  orden: number;
  enviado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export const MAX_MB_CONTEXTO = 500;

export const respondido = (t: Turno) =>
  !!((t.negocio ?? "").trim() || (t.archivos ?? []).length);

export const esVideo = (a: ArchivoCtx) =>
  a.tipo.startsWith("video") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(a.nombre);

/** Guion por defecto: lo que un cliente real suele preguntar por WhatsApp. */
export function guionServicio(servicio: string): Turno[] {
  const s = servicio.trim();
  const sMin =
    s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s;
  return [
    `Hola, ¿me brindas más información sobre ${sMin}?`,
    "¿Cuánto cuesta?",
    "¿Qué incluye y cuánto tiempo toma?",
    "¿Tienen disponibilidad esta semana?",
    "Me parece un poco caro, ¿tienen alguna promoción o paquete?",
    "¿Cómo hago para agendar? ¿Tengo que dejar algún adelanto?",
    "Ok, déjame pensarlo y te aviso.",
  ].map((cliente) => ({ cliente, negocio: "", archivos: [] }));
}

/** Guion para la información general del negocio. */
export function guionGeneral(): Turno[] {
  return [
    "Hola, ¿cuál es su horario de atención?",
    "¿Dónde están ubicados? ¿Tienen estacionamiento?",
    "¿Atienden con cita o también sin cita?",
    "¿Qué formas de pago aceptan?",
    "¿Qué pasa si llego tarde o necesito cancelar?",
    "¿Tienen alguna promoción vigente?",
    "¿Me puedes enviar fotos de su local o de trabajos que han hecho?",
  ].map((cliente) => ({ cliente, negocio: "", archivos: [] }));
}

export const SERVICIO_GENERAL = "Información general del negocio";

/** Texto plano listo para pegar en la base de conocimiento / prompt de la IA. */
export function textoParaIA(
  proyecto: string,
  servicios: Pick<ServicioCtx, "categoria" | "nombre" | "turnos">[],
): string {
  let out = `NEGOCIO: ${proyecto}\nEjemplos reales de cómo responde el negocio por WhatsApp. Imita su tono, sus precios y su forma de responder.\n`;
  for (const s of servicios) {
    const turnos = (s.turnos ?? []).filter(respondido);
    if (!turnos.length) continue;
    out += `\n=== ${s.categoria ? s.categoria + " › " : ""}${s.nombre} ===\n`;
    for (const t of turnos) {
      out += `Cliente: ${t.cliente}\nNegocio: ${(t.negocio ?? "").trim() || "(envía archivo)"}\n`;
      for (const a of t.archivos ?? [])
        out += `  [${esVideo(a) ? "Video" : "Imagen"}: ${a.nombre}]\n`;
    }
  }
  return out;
}
