// Catálogo global de nichos (misma fuente para crear, mostrar y filtrar).
// Combina los nichos por defecto (en su orden original) con los
// personalizados guardados en la base de datos.

import { createClient } from "./supabase/client";
import { NICHOS } from "./ui";

// Lista efectiva: defaults primero (orden original) + personalizados después.
export async function listarNichos(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nichos")
    .select("nombre, created_at")
    .order("created_at", { ascending: true });

  const base: string[] = [...NICHOS];
  if (error || !data) return base;

  const vistos = new Set(base.map((n) => n.toLowerCase()));
  const out = [...base];
  for (const row of data) {
    const nombre = (row as { nombre: string }).nombre;
    const k = nombre.toLowerCase();
    if (!vistos.has(k)) {
      vistos.add(k);
      out.push(nombre);
    }
  }
  return out;
}

// Guarda un nicho nuevo (dedup sin importar mayúsculas). Devuelve el
// nombre canónico si ya existía uno equivalente en `existentes`.
export async function agregarNicho(
  nombre: string,
  existentes: string[],
): Promise<string | null> {
  const limpio = nombre.trim();
  if (!limpio) return null;

  const ya = existentes.find((n) => n.toLowerCase() === limpio.toLowerCase());
  if (ya) return ya; // ya existe: no duplicar

  const supabase = createClient();
  // on conflict lo maneja el índice único; si choca, se ignora.
  await supabase.from("nichos").insert({ nombre: limpio });
  return limpio;
}
