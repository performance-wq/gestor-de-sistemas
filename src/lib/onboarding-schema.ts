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
  /** Máximo permitido de archivos (tope, sin exigir una cantidad exacta). */
  maximo?: number;
  /** Tamaño máximo por archivo en MB (si no, se usa MAX_MB global). */
  maxMb?: number;
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
    titulo: "Información General del Negocio",
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
    titulo: "Contenido Comercial",
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

// =============================================================
// Onboarding V2 — formulario más ágil (misma infraestructura).
// IDs con prefijo v2_ para no colisionar con V1.
// =============================================================
export const SECCIONES_V2: SeccionOnboarding[] = [
  {
    id: "v2_personal",
    titulo: "Información Personal",
    descripcion: "Para saber con quién estamos trabajando.",
    preguntas: [
      { id: "v2_nombre", titulo: "¿Cuál es tu nombre completo?", tipo: "texto", placeholder: "Ej. María González Pérez" },
      { id: "v2_email", titulo: "¿Cuál es tu correo electrónico?", tipo: "email", placeholder: "tucorreo@empresa.com" },
      { id: "v2_whatsapp", titulo: "¿Cuál es tu teléfono / WhatsApp?", tipo: "tel", ayuda: "Incluye el código de país.", placeholder: "+52 55 1234 5678" },
    ],
  },
  {
    id: "v2_negocio",
    titulo: "Información del Negocio",
    descripcion: "Los datos básicos de tu negocio.",
    preguntas: [
      { id: "v2_neg_nombre", titulo: "¿Cuál es el nombre de tu negocio?", tipo: "texto", placeholder: "Ej. Clínica Sonrisa" },
      { id: "v2_neg_direccion", titulo: "¿Cuál es la dirección física?", tipo: "texto" },
      { id: "v2_neg_maps", titulo: "Link de Google Maps", tipo: "url", opcional: true, placeholder: "https://maps.google.com/…" },
      { id: "v2_neg_horario", titulo: "¿Cuál es tu horario de atención?", tipo: "textarea" },
      { id: "v2_neg_telefono", titulo: "Teléfono de contacto", tipo: "tel" },
      { id: "v2_neg_whatsapp", titulo: "WhatsApp", tipo: "tel" },
    ],
  },
  {
    id: "v2_comercial",
    titulo: "Configuración Comercial",
    descripcion: "Información estratégica para configurar la atención comercial.",
    preguntas: [
      {
        id: "v2_obj_ia",
        titulo: "¿Cuál es el objetivo principal de la IA durante la atención de prospectos?",
        tipo: "textarea",
        ayuda: "Por ejemplo: brindar información, agendar citas, derivar con un asesor o calificar prospectos. Puedes elegir uno, combinar varios o describirlo con tus palabras.",
      },
      {
        id: "v2_post_compra",
        titulo: "¿Qué sucede después de que un cliente compra o realiza una reserva?",
        tipo: "textarea",
        ayuda: "Nos ayudará a configurar los flujos de seguimiento y automatización.",
      },
    ],
  },
  {
    id: "v2_recojo",
    titulo: "Recojo de Información",
    descripcion: "Comparte todo lo necesario para configurar correctamente la IA.",
    preguntas: [
      {
        id: "v2_prompt_maestro",
        titulo: "Prompt Maestro",
        tipo: "textarea",
        ayuda: "Puedes pegar un prompt muy extenso. No hay límite de longitud.",
      },
      {
        id: "v2_info_adicional",
        titulo: "Información Adicional",
        tipo: "textarea",
        opcional: true,
        ayuda: "Cualquier información complementaria sobre tu negocio. Sin límite de longitud.",
      },
    ],
  },
  {
    id: "v2_contenido",
    titulo: "Contenido Comercial",
    descripcion:
      "Comparte el mejor contenido disponible de tu negocio. Puedes incluir testimonios, casos de éxito, antes y después, recorrido por el negocio, productos, servicios, instalaciones, cómo llegar o cualquier material que represente bien tu operación.",
    preguntas: [
      { id: "v2_imagenes", titulo: "Sube hasta 5 imágenes de tu negocio", tipo: "imagenes", maximo: 5, ayuda: "El mejor material disponible: testimonios, productos, instalaciones, antes y después, etc." },
      { id: "v2_videos", titulo: "Sube hasta 5 videos de tu negocio", tipo: "videos", maximo: 5, maxMb: 500, opcional: true, ayuda: "Testimonios, casos de éxito, recorrido por el negocio, etc." },
      { id: "v2_logo", titulo: "Sube el logo de tu negocio", tipo: "imagenes", cantidad: 1 },
    ],
  },
];

/** Secciones del formulario según la versión (1 = original, 2 = ágil). */
export function seccionesDe(version?: number): SeccionOnboarding[] {
  return version === 2 ? SECCIONES_V2 : SECCIONES;
}

/** Preguntas planas (con su sección) según la versión. */
export function preguntasPlanasDe(version?: number) {
  return seccionesDe(version).flatMap((s) =>
    s.preguntas.map((p) => ({ ...p, seccionId: s.id, seccionTitulo: s.titulo })),
  );
}

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
  if (esTipoArchivo(p.tipo)) {
    const arr = (valor as ArchivoSubido[]) ?? [];
    if (p.cantidad) {
      if (arr.length !== p.cantidad)
        return `Debes subir exactamente ${p.cantidad} archivo${p.cantidad === 1 ? "" : "s"} (llevas ${arr.length}).`;
    } else if (p.maximo && arr.length > p.maximo) {
      return `Puedes subir hasta ${p.maximo} archivos (llevas ${arr.length}).`;
    }
  }
  return null;
}
