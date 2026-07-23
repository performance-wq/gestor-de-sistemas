"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { puntoCompleto } from "@/lib/progress";
import { toEmbedUrl } from "@/lib/video";
import { subirAsset, urlFirmada } from "@/lib/storage";
import { descargarTexto, descargarArchivo, nombreDesdePath } from "@/lib/download";
import { formatFechaHora } from "@/lib/ui";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Toast } from "@/components/Toast";

export default function PuntoView() {
  const { id, sid, pid } = useParams<{ id: string; sid: string; pid: string }>();
  const router = useRouter();
  const { cargado, getProyecto, actualizarPunto, eliminarPunto } = useStore();
  const imgRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [videoLink, setVideoLink] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [copyLocal, setCopyLocal] = useState("");
  const [urlLocal, setUrlLocal] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const notificar = (m: string) => setToast(m);

  const proyecto = getProyecto(id);
  const sistema = proyecto?.sistemas.find((s) => s.id === sid);
  const punto = sistema?.puntos.find((p) => p.id === pid);

  const imagen = punto?.imagen;
  const video = punto?.video;

  // Sincroniza los campos editables al cambiar de punto.
  useEffect(() => {
    if (punto) {
      setCopyLocal(punto.copy);
      setUrlLocal(punto.url ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punto?.id]);

  useEffect(() => {
    let activo = true;
    urlFirmada(imagen).then((u) => activo && setImgUrl(u));
    return () => {
      activo = false;
    };
  }, [imagen]);

  const videoEsArchivo = !!video && !video.startsWith("http");
  useEffect(() => {
    let activo = true;
    if (videoEsArchivo) urlFirmada(video).then((u) => activo && setVideoUrl(u));
    else setVideoUrl(null);
    return () => {
      activo = false;
    };
  }, [video, videoEsArchivo]);

  if (cargado && (!proyecto || !sistema || !punto)) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Este punto de contacto no existe.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-accent">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }
  if (!proyecto || !sistema || !punto)
    return <div className="py-20 text-center text-muted">Cargando…</div>;

  const completo = puntoCompleto(punto);
  const embed = video && !videoEsArchivo ? toEmbedUrl(video) : null;
  const esTexto = punto.tipo === "texto";
  const esLanding = punto.tipo === "landing";
  const copySinGuardar = copyLocal !== punto.copy;
  const urlSinGuardar = urlLocal !== (punto.url ?? "");

  async function guardarCopy() {
    await actualizarPunto(id, sid, pid, { copy: copyLocal });
    notificar(esTexto ? "Contenido guardado correctamente" : "Copy guardado correctamente");
  }

  function descargarCopy() {
    if (!punto) return;
    descargarTexto(punto.nombre, copyLocal);
  }

  async function guardarUrl() {
    const v = urlLocal.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      alert("Ingresa un enlace válido que empiece por https://");
      return;
    }
    await actualizarPunto(id, sid, pid, { url: v || undefined });
    notificar("Enlace guardado correctamente");
  }

  async function onImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen debe pesar menos de 10 MB.");
      return;
    }
    setSubiendoImg(true);
    const path = await subirAsset(file, `${id}/${sid}/${pid}/img`);
    if (path) {
      await actualizarPunto(id, sid, pid, { imagen: path });
      notificar("Imagen guardada correctamente");
    }
    setSubiendoImg(false);
  }

  async function onVideoArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) e.target.value = "";
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      alert("El video debe pesar menos de 100 MB.");
      return;
    }
    setSubiendoVideo(true);
    const path = await subirAsset(file, `${id}/${sid}/${pid}/video`);
    if (path) {
      await actualizarPunto(id, sid, pid, { video: path });
      notificar("Video guardado correctamente");
    }
    setSubiendoVideo(false);
  }

  const nombreEditable = !punto.fijo;
  const btnSec =
    "rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-40";

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Proyectos", href: "/dashboard" },
          { label: proyecto.nombre, href: `/proyecto/${proyecto.id}` },
          {
            label: sistema.nombre,
            href: `/proyecto/${proyecto.id}/sistema/${sistema.id}`,
          },
          { label: punto.nombre },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          {nombreEditable ? (
            <input
              value={punto.nombre}
              onChange={(e) =>
                actualizarPunto(id, sid, pid, { nombre: e.target.value })
              }
              className="-ml-1 rounded px-1 text-2xl font-semibold tracking-tight outline-none focus:bg-slate-100"
            />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">
              {punto.nombre}
            </h1>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                completo
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {completo ? "Completo" : "Vacío"}
            </span>
            {punto.programacion && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                ⏱ {punto.programacion}
              </span>
            )}
            {punto.actualizadoEn && (
              <span className="text-xs text-muted">
                {punto.actualizadoPorNombre
                  ? `Subido por ${punto.actualizadoPorNombre} · `
                  : "Última edición: "}
                {formatFechaHora(punto.actualizadoEn)}
              </span>
            )}
          </div>
        </div>
        {nombreEditable && (
          <button
            onClick={() => {
              if (confirm(`¿Eliminar el punto "${punto.nombre}"?`)) {
                eliminarPunto(id, sid, pid);
                router.push(`/proyecto/${proyecto.id}/sistema/${sistema.id}`);
              }
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Eliminar punto
          </button>
        )}
      </div>

      <div
        className={`mt-6 grid gap-6 ${esTexto || esLanding ? "" : "lg:grid-cols-2"}`}
      >
        {/* Copy / Texto */}
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{esTexto ? "Contenido" : "Copy"}</h2>
            <span className="text-xs text-muted">
              {esTexto
                ? "Documento de texto"
                : "Obligatorio · define si el punto está completo"}
            </span>
          </div>
          <textarea
            value={copyLocal}
            onChange={(e) => setCopyLocal(e.target.value)}
            placeholder={
              esTexto
                ? "Escribe aquí el contenido…"
                : "Escribe aquí el copy de este punto…"
            }
            rows={esTexto ? 20 : 14}
            className="w-full resize-y rounded-lg border border-border bg-white p-3 text-sm leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {copySinGuardar ? "Cambios sin guardar" : "Todo guardado"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={descargarCopy}
                disabled={!copyLocal.trim()}
                className={btnSec}
              >
                ⬇ Descargar
              </button>
              <button
                onClick={guardarCopy}
                disabled={!copySinGuardar}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>
        </section>

        {/* Landing: URL */}
        {esLanding && (
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">URL de la Landing</h2>
              <span className="text-xs text-muted">Opcional · enlace</span>
            </div>
            <input
              value={urlLocal}
              onChange={(e) => setUrlLocal(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={guardarUrl}
                disabled={!urlSinGuardar}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Guardar
              </button>
              {punto.url && (
                <a
                  href={punto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20"
                >
                  🔗 Abrir landing en nueva pestaña
                </a>
              )}
            </div>
          </section>
        )}

        {/* Estándar: Imagen + Video */}
        {!esTexto && !esLanding && (
          <div className="space-y-6">
            {/* Imagen */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Imagen</h2>
                <span className="text-xs text-muted">Opcional · máx 10 MB</span>
              </div>
              {imagen ? (
                <div>
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl}
                      alt={punto.nombre}
                      className="max-h-64 w-full rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-border text-sm text-muted">
                      Cargando imagen…
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        imgUrl && descargarArchivo(imgUrl, nombreDesdePath(imagen))
                      }
                      disabled={!imgUrl}
                      className={btnSec}
                    >
                      ⬇ Descargar
                    </button>
                    <button
                      onClick={() => imgRef.current?.click()}
                      disabled={subiendoImg}
                      className={btnSec}
                    >
                      {subiendoImg ? "Subiendo…" : "Reemplazar"}
                    </button>
                    <button
                      onClick={() => actualizarPunto(id, sid, pid, { imagen: undefined })}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => imgRef.current?.click()}
                  disabled={subiendoImg}
                  className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <span className="text-2xl">🖼️</span>
                  <span className="mt-1">
                    {subiendoImg ? "Subiendo…" : "Subir imagen (jpg, png, webp, gif)"}
                  </span>
                </button>
              )}
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                onChange={onImagen}
                className="hidden"
              />
            </section>

            {/* Video */}
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Video</h2>
                <span className="text-xs text-muted">Opcional · link o archivo</span>
              </div>
              {video ? (
                <div>
                  {videoEsArchivo ? (
                    videoUrl ? (
                      <video
                        src={videoUrl}
                        controls
                        className="w-full rounded-lg border border-border"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-border text-sm text-muted">
                        Cargando video…
                      </div>
                    )
                  ) : embed ? (
                    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
                      <iframe
                        src={embed}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-accent"
                    >
                      {video}
                    </a>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {videoEsArchivo && (
                      <button
                        onClick={() =>
                          videoUrl &&
                          descargarArchivo(videoUrl, nombreDesdePath(video))
                        }
                        disabled={!videoUrl}
                        className={btnSec}
                      >
                        ⬇ Descargar
                      </button>
                    )}
                    <button
                      onClick={() => actualizarPunto(id, sid, pid, { video: undefined })}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Quitar video
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!videoLink.trim()) return;
                      actualizarPunto(id, sid, pid, { video: videoLink.trim() });
                      setVideoLink("");
                      notificar("Video guardado correctamente");
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      placeholder="Pega link de YouTube, Loom o Drive"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Añadir
                    </button>
                  </form>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="h-px flex-1 bg-border" />o
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <button
                    onClick={() => videoRef.current?.click()}
                    disabled={subiendoVideo}
                    className="w-full rounded-lg border border-dashed border-border py-3 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {subiendoVideo ? "Subiendo…" : "🎬 Subir archivo de video (mp4, mov · máx 100 MB)"}
                  </button>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/*"
                    onChange={onVideoArchivo}
                    className="hidden"
                  />
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {toast && <Toast mensaje={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
