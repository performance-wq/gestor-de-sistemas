// Exporta las respuestas del onboarding a un ZIP listo para usar con IA:
//   respuestas.md  +  imagenes/  +  videos/  +  documentos/
// El documento incluye todo el texto, los enlaces y referencias a los archivos.

import {
  SECCIONES,
  esTipoArchivo,
  type ArchivoSubido,
  type Par,
  type Pregunta,
  type Respuestas,
} from "./onboarding-schema";
import { urlFirmada } from "./storage";
import { crearZip } from "./zip";
import { nombreDesdePath } from "./download";

function carpetaDe(pregunta: Pregunta): string {
  switch (pregunta.tipo) {
    case "imagenes":
      return "imagenes";
    case "videos":
      return "videos";
    case "media":
      return "media";
    default:
      return "documentos";
  }
}

function limpiarNombre(s: string) {
  return s.replace(/[^\w.\-áéíóúñ ]+/gi, "_").trim();
}

function textoRespuesta(p: Pregunta, valor: unknown): string {
  if (p.tipo === "lista") {
    return (valor as string[])
      .filter((x) => x?.trim())
      .map((x, i) => `${i + 1}. ${x}`)
      .join("\n");
  }
  if (p.tipo === "lista_pares") {
    return (valor as Par[])
      .filter((x) => x?.p?.trim())
      .map((x, i) => `${i + 1}. **${x.p}**\n   ${x.r}`)
      .join("\n");
  }
  return String(valor ?? "");
}

function tieneValor(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Construye el documento Markdown. `rutas` mapea path de storage → ruta en el ZIP. */
export function construirMarkdown(
  proyecto: string,
  cliente: string | undefined,
  respuestas: Respuestas,
  rutas: Map<string, string>,
): string {
  const l: string[] = [];
  l.push(`# Onboarding — ${proyecto}`);
  if (cliente) l.push(`\n**Cliente:** ${cliente}`);
  l.push(`\n**Exportado:** ${new Date().toLocaleString("es")}`);
  l.push("\n---");

  for (const sec of SECCIONES) {
    l.push(`\n## ${sec.titulo}`);
    for (const p of sec.preguntas) {
      const v = respuestas[p.id];
      l.push(`\n### ${p.titulo}`);
      if (!tieneValor(v)) {
        l.push("_Sin responder_");
        continue;
      }
      if (esTipoArchivo(p.tipo)) {
        for (const a of v as ArchivoSubido[]) {
          const ruta = rutas.get(a.path);
          l.push(ruta ? `- \`${ruta}\` — ${a.nombre}` : `- ${a.nombre}`);
        }
      } else if (p.tipo === "url") {
        l.push(`<${v as string}>`);
      } else {
        l.push(textoRespuesta(p, v));
      }
    }
  }
  return l.join("\n") + "\n";
}

/**
 * Descarga todos los archivos, arma el ZIP y lo baja al equipo.
 * onProgreso: (hechos, total) para mostrar avance.
 */
export async function descargarOnboardingZip(
  proyecto: string,
  cliente: string | undefined,
  respuestas: Respuestas,
  onProgreso?: (hechos: number, total: number) => void,
): Promise<{ ok: boolean; fallidos: number }> {
  // 1) Recolectar todos los archivos referenciados.
  const archivos: { pregunta: Pregunta; a: ArchivoSubido }[] = [];
  for (const sec of SECCIONES) {
    for (const p of sec.preguntas) {
      if (!esTipoArchivo(p.tipo)) continue;
      const v = respuestas[p.id];
      if (Array.isArray(v))
        for (const a of v as ArchivoSubido[]) archivos.push({ pregunta: p, a });
    }
  }

  const total = archivos.length;
  let hechos = 0;
  let fallidos = 0;
  const rutas = new Map<string, string>();
  const usados = new Set<string>();
  const entradas: { nombre: string; datos: Uint8Array }[] = [];

  // 2) Descargar cada archivo y asignarle una ruta única dentro del ZIP.
  for (const { pregunta, a } of archivos) {
    const carpeta = carpetaDe(pregunta);
    const base = limpiarNombre(nombreDesdePath(a.path) || a.nombre || "archivo");
    let ruta = `${carpeta}/${base}`;
    let i = 1;
    while (usados.has(ruta)) {
      const punto = base.lastIndexOf(".");
      const nom = punto > 0 ? base.slice(0, punto) : base;
      const ext = punto > 0 ? base.slice(punto) : "";
      ruta = `${carpeta}/${nom}-${i++}${ext}`;
    }
    usados.add(ruta);

    try {
      const url = await urlFirmada(a.path);
      if (!url) throw new Error("sin url");
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = new Uint8Array(await res.arrayBuffer());
      entradas.push({ nombre: ruta, datos: buf });
      rutas.set(a.path, ruta);
    } catch {
      fallidos++;
    }
    onProgreso?.(++hechos, total);
  }

  // 3) Documento con todas las respuestas + referencias a los archivos.
  const md = construirMarkdown(proyecto, cliente, respuestas, rutas);
  entradas.unshift({
    nombre: "respuestas.md",
    datos: new TextEncoder().encode(md),
  });

  // 4) Empaquetar y descargar.
  const blob = crearZip(entradas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `onboarding-${limpiarNombre(proyecto) || "proyecto"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { ok: true, fallidos };
}
