// Convierte un link de YouTube / Loom / Google Drive en una URL embebible
// para previsualización. Devuelve null si no se reconoce (se mostrará el link).

export function toEmbedUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;

  // YouTube
  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;

  // Loom
  const loom = u.match(/loom\.com\/share\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;

  // Google Drive
  const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  return null;
}
