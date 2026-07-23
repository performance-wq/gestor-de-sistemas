// Subida de archivos al bucket privado 'assets' y generación de URLs firmadas
// para previsualización (los archivos nunca son públicos).

import { createClient } from "./supabase/client";

export async function subirAsset(
  file: File,
  prefix: string,
): Promise<string | null> {
  const supabase = createClient();
  const limpio = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${prefix}/${Date.now()}-${limpio}`;
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, file, { upsert: false });
  if (error) {
    console.error("Error subiendo archivo:", error.message);
    return null;
  }
  return path;
}

export async function urlFirmada(path?: string): Promise<string | null> {
  if (!path) return null;
  // Links externos o data URLs se devuelven tal cual.
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("assets")
    .createSignedUrl(path, 3600);
  if (error) {
    console.error("Error firmando URL:", error.message);
    return null;
  }
  return data.signedUrl;
}
