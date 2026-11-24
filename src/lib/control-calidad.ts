// Checklist del proceso "Control de calidad".
// Lo pasa primero la implementadora y después la supervisora, sistema por
// sistema. Las claves (`key`) deben ser estables: las marcas guardadas en
// Supabase (tabla control_calidad) se enlazan por clave.

export type RolCalidad = "implementadora" | "supervisora";

export interface PuntoCalidad {
  key: string;
  texto: string;
  detalle?: string;
  opcional?: boolean;
}

export interface SistemaCalidad {
  id: string;
  nombre: string;
  puntos: PuntoCalidad[];
}

export const CONTROL_CALIDAD: SistemaCalidad[] = [
  {
    id: "ia",
    nombre: "1 · Inteligencia artificial",
    puntos: [
      { key: "ia.prompt", texto: "Prompt creado y cargado en la IA" },
      {
        key: "ia.base",
        texto: "Base de conocimiento creada y conectada al prompt",
      },
      {
        key: "ia.seg30",
        texto: "Seguimiento a los 30 minutos",
        detalle: "«Hola, ¿sigues ahí?»",
      },
      {
        key: "ia.seg4h",
        texto: "Seguimiento a las 4 horas",
        detalle:
          "«Hola, nuevamente por aquí. Quisiera saber si podemos continuar con la conversación.»",
      },
      { key: "ia.limite15", texto: "Límite de 15 mensajes habilitado" },
      {
        key: "ia.activa2h",
        texto: "Activa 2 horas y luego se apaga",
      },
      {
        key: "ia.agenda_tarea",
        texto: "Agenda o crea tarea según el negocio",
        detalle:
          "Si agenda: agendamiento activo. Si no agenda: «Crear tarea» activo en las derivaciones de la IA.",
      },
      { key: "ia.nombre", texto: "La IA tiene nombre", opcional: true },
      {
        key: "ia.emojis",
        texto: "Las listas (por ejemplo, horarios) van con emojis",
      },
      {
        key: "ia.closer",
        texto: "Persuade como closer, no solo informa",
      },
      {
        key: "ia.no_interesa",
        texto: "Prueba «No me interesa»: la IA retoma la conversación",
      },
      {
        key: "ia.15preguntas",
        texto: "Prueba real con 15 preguntas diversas",
        detalle: "Responde como en el ensayo de la IA de la Sesión 1.",
      },
    ],
  },
  {
    id: "seguimiento",
    nombre: "2 · Seguimiento continuo",
    puntos: [
      {
        key: "seg.palabras",
        texto: "Palabras clave que encienden el sistema alineadas",
        detalle: "Por ejemplo, «más información».",
      },
      {
        key: "seg.imagen_texto",
        texto: "Cada mensaje tiene imagen y texto",
      },
      {
        key: "seg.imagenes_marca",
        texto: "Imágenes alineadas al negocio (colores, estilo)",
      },
    ],
  },
  {
    id: "nutricion",
    nombre: "3 · Nutrición",
    puntos: [
      {
        key: "nut.correo",
        texto: "Correo registrado para que los envíos lleguen",
      },
      {
        key: "nut.contenido",
        texto: "Correos, imágenes o videos y copies alineados al negocio",
      },
    ],
  },
  {
    id: "agendamiento",
    nombre: "4 · Agendamiento",
    puntos: [
      { key: "age.calendario", texto: "Calendario activo" },
      {
        key: "age.horario",
        texto: "Personal del calendario activo con su horario comercial",
        detalle: "Sábado, domingo y recesos según el negocio.",
      },
      {
        key: "age.formulario",
        texto: "Formulario de agenda vinculado al calendario",
      },
      {
        key: "age.evento",
        texto: "Notificaciones según el tipo de evento",
        detalle: "Evento de reuniones o evento de servicios.",
      },
      {
        key: "age.automatizaciones",
        texto: "Automatizaciones coherentes con el calendario",
      },
      {
        key: "age.aviso_cliente",
        texto: "Aviso al cliente por correo y SMS",
      },
      {
        key: "age.aviso_interno",
        texto: "Aviso interno al empresario (Particular user)",
      },
    ],
  },
  {
    id: "landing",
    nombre: "5 · Landing page",
    puntos: [
      { key: "lan.estructura", texto: "Cumple la estructura designada" },
      { key: "lan.logo", texto: "Logo correcto y alineado" },
      {
        key: "lan.dominio",
        texto: "El dominio principal redirige a la página principal",
      },
      { key: "lan.botones", texto: "Botones probados" },
    ],
  },
  {
    id: "fidelizacion",
    nombre: "6 · Fidelización",
    puntos: [
      {
        key: "fid.activacion",
        texto: "Se activa al ganar la oportunidad (Won)",
      },
      { key: "fid.creativo", texto: "Imagen y copy congruentes" },
      {
        key: "fid.oferta",
        texto: "Oferta congruente con el negocio",
        detalle: "Recurrencia o pago por comisión.",
      },
    ],
  },
  {
    id: "redes",
    nombre: "7 · Redes sociales",
    puntos: [
      {
        key: "red.facebook",
        texto: "Prueba en Facebook: responde de forma congruente",
      },
      {
        key: "red.instagram",
        texto: "Prueba en Instagram: responde de forma congruente",
      },
      {
        key: "red.variedad",
        texto: "Probado con «más información», un halago y un emoji",
      },
      { key: "red.dm", texto: "Continúa la conversación por DM" },
    ],
  },
];

export const obsKey = (sistemaId: string) => `${sistemaId}.obs`;

export const PUNTOS_REQUERIDOS = CONTROL_CALIDAD.flatMap((s) =>
  s.puntos.filter((p) => !p.opcional),
);
