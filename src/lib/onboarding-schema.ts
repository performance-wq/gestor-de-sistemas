// =============================================================
// Esquema del formulario de Onboarding de Systems PEX.
// Para agregar/quitar preguntas en el futuro basta con editar
// este archivo: el formulario y la visualización son dinámicos.
// IMPORTANTE: no cambies los `id` ya existentes (son la clave con
// la que se guardan las respuestas).
// =============================================================

export type TipoCampo =
  | "texto" // input corto
  | "textarea" // descripción larga
  | "url" // enlace validado
  | "email"
  | "tel"
  | "lista" // N campos de texto (cantidad exacta)
  | "lista_pares" // N pares pregunta/respuesta (cantidad exacta)
  | "documentos" // archivos (pdf, doc, etc.)
  | "imagenes" // solo imágenes
  | "videos" // solo videos
  | "media"; // imagen o video

export interface Pregunta {
  id: string;
  titulo: string;
  ayuda?: string;
  tipo: TipoCampo;
  opcional?: boolean;
  /** Cantidad EXACTA requerida (archivos o ítems de lista). */
  cantidad?: number;
  placeholder?: string;
}

export interface SeccionOnboarding {
  id: string;
  titulo: string;
  descripcion?: string;
  preguntas: Pregunta[];
}

/** Un archivo subido por el cliente. */
export interface ArchivoSubido {
  path: string;
  nombre: string;
  tipo: string;
}

/** Par de pregunta frecuente. */
export interface Par {
  p: string;
  r: string;
}

export type Respuesta = string | string[] | Par[] | ArchivoSubido[] | undefined;
export type Respuestas = Record<string, Respuesta>;

export const TIPOS_ARCHIVO: TipoCampo[] = [
  "documentos",
  "imagenes",
  "videos",
  "media",
];

export const esTipoArchivo = (t: TipoCampo) => TIPOS_ARCHIVO.includes(t);

/** accept= para el input file según el tipo. */
export function acceptDe(tipo: TipoCampo): string {
  switch (tipo) {
    case "imagenes":
      return "image/*";
    case "videos":
      return "video/*";
    case "media":
      return "image/*,video/*";
    default:
      return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*";
  }
}

export const MAX_MB = 25;

export const SECCIONES: SeccionOnboarding[] = [
  {
    id: "personal",
    titulo: "Información Personal",
    descripcion: "Para saber con quién estamos trabajando.",
    preguntas: [
      { id: "per_nombre", titulo: "¿Cuál es tu nombre?", tipo: "texto", placeholder: "Ej. María" },
      { id: "per_apellidos", titulo: "¿Cuáles son tus apellidos?", tipo: "texto", placeholder: "Ej. González Pérez" },
      { id: "per_email", titulo: "¿Cuál es tu correo electrónico?", tipo: "email", placeholder: "tucorreo@empresa.com" },
      { id: "per_whatsapp", titulo: "¿Cuál es tu número de teléfono (WhatsApp)?", tipo: "tel", ayuda: "Incluye el código de país.", placeholder: "+52 55 1234 5678" },
      { id: "per_cargo", titulo: "¿Cuál es tu cargo dentro de la empresa?", tipo: "texto", opcional: true, placeholder: "Ej. Dueño, Gerente de Marketing" },
    ],
  },
  {
    id: "negocio",
    titulo: "Información del Negocio",
    descripcion: "Cuéntanos de qué se trata tu negocio.",
    preguntas: [
      { id: "neg_nombre", titulo: "¿Cuál es el nombre de tu negocio?", tipo: "texto", placeholder: "Ej. Clínica Sonrisa" },
      { id: "neg_descripcion", titulo: "Describe tu negocio en general", tipo: "textarea", ayuda: "¿A qué se dedica? ¿Qué lo hace especial?" },
      { id: "neg_promesa", titulo: "¿Cuál es tu promesa principal?", tipo: "textarea", ayuda: "El resultado principal que le prometes a tu cliente." },
      { id: "neg_mision", titulo: "Misión o visión", tipo: "textarea", opcional: true },
      { id: "neg_diferenciadores", titulo: "¿Cuáles son tus principales diferenciadores?", tipo: "textarea", ayuda: "¿Por qué te elegirían a ti y no a la competencia?" },
    ],
  },
  {
    id: "avatar",
    titulo: "Cliente Ideal (Avatar)",
    descripcion: "Para hablarle exactamente a quien te compra.",
    preguntas: [
      { id: "av_descripcion", titulo: "Describe a tu cliente ideal", tipo: "textarea" },
      { id: "av_ocupacion", titulo: "Ocupación o perfil", tipo: "texto" },
      { id: "av_dolores", titulo: "¿Cuáles son sus principales problemas o dolores?", tipo: "textarea" },
      { id: "av_objetivos", titulo: "Cinco objetivos o deseos de tu cliente", tipo: "lista", cantidad: 5 },
      { id: "av_objeciones", titulo: "Cinco objeciones frecuentes", tipo: "lista", cantidad: 5, ayuda: "Lo que dicen antes de decidirse." },
      { id: "av_preguntas", titulo: "Cinco preguntas frecuentes antes de comprar", tipo: "lista", cantidad: 5 },
      { id: "av_valoran", titulo: "Cinco factores que más valoran al elegir un proveedor", tipo: "lista", cantidad: 5 },
    ],
  },
  {
    id: "productos",
    titulo: "Productos y Servicios",
    preguntas: [
      { id: "pr_lista", titulo: "Lista completa de tus productos o servicios", tipo: "textarea", ayuda: "Uno por línea." },
      { id: "pr_descripciones", titulo: "Describe cada producto o servicio", tipo: "textarea" },
      { id: "pr_precios", titulo: "Precios", tipo: "textarea", opcional: true, ayuda: "Si aplica." },
      { id: "pr_link_cartilla", titulo: "Link de tu cartilla, menú o brochure", tipo: "url", opcional: true, placeholder: "https://…" },
      { id: "pr_doc_cartilla", titulo: "O súbelo como documento (PDF)", tipo: "documentos", opcional: true },
      { id: "pr_pagos", titulo: "Links de pago o métodos de pago", tipo: "textarea", opcional: true },
    ],
  },
  {
    id: "operacion",
    titulo: "Operación del Negocio",
    preguntas: [
      { id: "op_direccion", titulo: "Dirección física", tipo: "texto" },
      { id: "op_maps", titulo: "Link de Google Maps", tipo: "url", opcional: true, placeholder: "https://maps.google.com/…" },
      { id: "op_horario", titulo: "Horario de atención", tipo: "textarea" },
      { id: "op_cobertura", titulo: "Ciudades o zonas de cobertura", tipo: "textarea" },
      { id: "op_correo", titulo: "Correo de contacto", tipo: "email", placeholder: "contacto@tunegocio.com" },
      { id: "op_telefono", titulo: "Teléfono", tipo: "tel" },
      { id: "op_whatsapp", titulo: "WhatsApp", tipo: "tel" },
      { id: "op_atencion", titulo: "¿Cómo es tu proceso de atención al cliente?", tipo: "textarea" },
      { id: "op_compra", titulo: "¿Cómo es tu proceso de compra o reserva?", tipo: "textarea" },
    ],
  },
  {
    id: "contenido",
    titulo: "Contenido para Ventas",
    descripcion: "Material que usaremos en tus automatizaciones.",
    preguntas: [
      { id: "co_faq", titulo: "Cinco preguntas frecuentes y cómo las responderías", tipo: "lista_pares", cantidad: 5 },
      { id: "co_testimonios", titulo: "Sube 2 imágenes o videos de testimonios", tipo: "media", cantidad: 2 },
      { id: "co_clientes", titulo: "Sube 2 imágenes o videos de clientes", tipo: "media", cantidad: 2 },
      { id: "co_producto", titulo: "Sube 2 imágenes o videos del producto o servicio", tipo: "media", cantidad: 2 },
      { id: "co_antes_despues", titulo: "Sube 1 imagen o video de antes y después", tipo: "media", cantidad: 1, opcional: true },
      { id: "co_logo", titulo: "Sube tu logo", tipo: "imagenes", cantidad: 1 },
      { id: "co_fotos", titulo: "Sube 4 fotografías adicionales del negocio", tipo: "imagenes", cantidad: 4 },
    ],
  },
];

/** Todas las preguntas en orden, con su sección. */
export const PREGUNTAS_PLANAS = SECCIONES.flatMap((s) =>
  s.preguntas.map((p) => ({ ...p, seccionId: s.id, seccionTitulo: s.titulo })),
);

/** Valida una respuesta. Devuelve null si es válida, o el mensaje de error. */
export function validar(p: Pregunta, valor: Respuesta): string | null {
  const vacio =
    valor === undefined ||
    valor === null ||
    (typeof valor === "string" && valor.trim() === "") ||
    (Array.isArray(valor) && valor.length === 0);

  if (vacio) return p.opcional ? null : "Esta respuesta es obligatoria.";

  if (p.tipo === "url" && typeof valor === "string") {
    if (!/^https?:\/\/.+\..+/i.test(valor.trim()))
      return "Ingresa un enlace válido que empiece por https://";
  }
  if (p.tipo === "email" && typeof valor === "string") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim()))
      return "Ingresa un correo válido.";
  }
  if (p.tipo === "lista" && p.cantidad) {
    const arr = (valor as string[]).filter((x) => x && x.trim());
    if (arr.length < p.cantidad)
      return `Completa las ${p.cantidad} respuestas (llevas ${arr.length}).`;
  }
  if (p.tipo === "lista_pares" && p.cantidad) {
    const arr = (valor as Par[]).filter((x) => x && x.p?.trim() && x.r?.trim());
    if (arr.length < p.cantidad)
      return `Completa las ${p.cantidad} preguntas con su respuesta (llevas ${arr.length}).`;
  }
  if (esTipoArchivo(p.tipo) && p.cantidad) {
    const arr = valor as ArchivoSubido[];
    if (arr.length !== p.cantidad)
      return `Debes subir exactamente ${p.cantidad} archivo${p.cantidad === 1 ? "" : "s"} (llevas ${arr.length}).`;
  }
  return null;
}
