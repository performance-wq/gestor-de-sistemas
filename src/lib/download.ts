// Utilidades de descarga para la biblioteca de recursos del proyecto.

// Descarga un texto como archivo .txt (o la extensión indicada).
export function descargarTexto(
  nombreBase: string,
  contenido: string,
  extension = "txt",
) {
  const limpio = (nombreBase || "copy").replace(/[^\w.\-áéíóúñ ]+/gi, "_").trim();
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${limpio}.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Deriva un nombre de archivo legible desde un path de storage
// (ej. "id/sid/pid/img/1712345678-foto.jpg" -> "foto.jpg").
export function nombreDesdePath(path?: string): string {
  if (!path) return "archivo";
  const ultimo = path.split("/").pop() ?? "archivo";
  return ultimo.replace(/^\d+-/, "");
}

// Descarga un archivo (imagen/video) desde una URL firmada, conservando
// su formato original y forzando el nombre indicado.
export async function descargarArchivo(
  urlFirmada: string,
  nombreArchivo: string,
): Promise<boolean> {
  try {
    const res = await fetch(urlFirmada);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    // Respaldo: abrir en una pestaña nueva si la descarga directa falla.
    window.open(urlFirmada, "_blank", "noopener,noreferrer");
    return false;
  }
}
