"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, formatFechaHora } from "@/lib/ui";
import { Breadcrumb } from "@/components/Breadcrumb";

interface Perfil {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "subcuenta";
  activo: boolean;
  created_at: string;
  ultimo_acceso?: string | null;
  creado_por_nombre?: string | null;
}

export default function AdminPage() {
  const { usuario, cargado, proyectos } = useStore();
  const supabase = createClient();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [asignaciones, setAsignaciones] = useState<
    { proyecto_id: string; user_id: string }[]
  >([]);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"admin" | "subcuenta">("subcuenta");
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(
    null,
  );

  const esAdmin = usuario?.rol === "admin";

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/usuarios", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setUsuarios(j.usuarios as Perfil[]);
      } else {
        throw new Error("api");
      }
    } catch {
      // Respaldo (p. ej. en local sin acceso server): datos base sin último acceso.
      const { data } = await supabase
        .from("profiles")
        .select("id,email,nombre,rol,activo,created_at,creado_por")
        .order("created_at", { ascending: true });
      setUsuarios(
        (data ?? []).map((p) => ({
          ...(p as Perfil),
          ultimo_acceso: null,
          creado_por_nombre: null,
        })),
      );
    }
    const a = await supabase.from("asignaciones").select("proyecto_id,user_id");
    if (a.data) setAsignaciones(a.data);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

  if (cargado && !esAdmin) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">
          Acceso restringido. Solo el administrador puede entrar aquí.
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-accent">
          ← Volver al panel
        </Link>
      </div>
    );
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nombre, password, rol }),
      });
      const j = await r.json();
      if (!r.ok) setMsg({ tipo: "err", texto: j.error ?? "No se pudo crear." });
      else {
        setMsg({ tipo: "ok", texto: `Usuario ${email} creado.` });
        setNombre("");
        setEmail("");
        setPassword("");
        setRol("subcuenta");
        await cargar();
      }
    } catch {
      setMsg({
        tipo: "err",
        texto:
          "Error de conexión. La creación de usuarios funciona en la versión publicada.",
      });
    }
    setCreando(false);
  }

  async function toggleActivo(id: string, activo: boolean) {
    setUsuarios((prev) =>
      prev.map((u) => (u.id === id ? { ...u, activo } : u)),
    );
    await supabase.from("profiles").update({ activo }).eq("id", id);
  }

  async function cambiarRol(id: string, r: "admin" | "subcuenta") {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, rol: r } : u)));
    await supabase.from("profiles").update({ rol: r }).eq("id", id);
  }

  async function editarNombre(id: string, actual: string) {
    const nuevo = window.prompt("Nuevo nombre:", actual);
    if (nuevo === null || nuevo.trim() === "") return;
    setUsuarios((prev) =>
      prev.map((u) => (u.id === id ? { ...u, nombre: nuevo.trim() } : u)),
    );
    await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nombre: nuevo.trim() }),
    });
  }

  async function resetPassword(id: string) {
    const pw = window.prompt(
      "Nueva contraseña temporal (mínimo 8 caracteres):",
    );
    if (!pw) return;
    const r = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password: pw }),
    });
    const j = await r.json();
    setMsg(
      r.ok
        ? { tipo: "ok", texto: "Contraseña restablecida. Comunícasela al usuario." }
        : { tipo: "err", texto: j.error ?? "No se pudo restablecer." },
    );
  }

  async function eliminarUsuario(id: string, nombre: string) {
    if (
      !confirm(
        `¿Eliminar a ${nombre}? Se borrará su cuenta por completo. Esta acción no se puede deshacer.`,
      )
    )
      return;
    const r = await fetch("/api/admin/usuarios?id=" + id, { method: "DELETE" });
    const j = await r.json();
    if (r.ok) {
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
      setMsg({ tipo: "ok", texto: "Usuario eliminado." });
    } else setMsg({ tipo: "err", texto: j.error ?? "No se pudo eliminar." });
  }

  async function toggleAsignacion(
    userId: string,
    proyectoId: string,
    asignar: boolean,
  ) {
    if (asignar) {
      setAsignaciones((p) => [...p, { proyecto_id: proyectoId, user_id: userId }]);
      await supabase
        .from("asignaciones")
        .insert({ proyecto_id: proyectoId, user_id: userId });
    } else {
      setAsignaciones((p) =>
        p.filter((a) => !(a.proyecto_id === proyectoId && a.user_id === userId)),
      );
      await supabase
        .from("asignaciones")
        .delete()
        .eq("proyecto_id", proyectoId)
        .eq("user_id", userId);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div>
      <Breadcrumb items={[{ label: "Administración" }]} />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Consola de administración
      </h1>
      <p className="mt-1 text-sm text-muted">
        Gestión privada de usuarios, roles y acceso a proyectos.
      </p>

      {/* Crear usuario */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-semibold">Crear usuario</h2>
        <form
          onSubmit={crearUsuario}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Contraseña temporal
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mín. 8 caracteres"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as "admin" | "subcuenta")}
              className={inputCls}
            >
              <option value="subcuenta">Colaborador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creando}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {creando ? "Creando…" : "Crear usuario"}
          </button>
        </form>
        {msg && (
          <p
            className={`mt-3 text-sm ${
              msg.tipo === "ok" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {msg.texto}
          </p>
        )}
      </div>

      {/* Lista de usuarios */}
      <h2 className="mt-8 text-lg font-semibold">
        Usuarios ({usuarios.length})
      </h2>
      <div className="mt-4 space-y-3">
        {cargando ? (
          <p className="text-sm text-muted">Cargando usuarios…</p>
        ) : (
          usuarios.map((u) => {
            const esYo = u.id === usuario?.id;
            return (
              <div
                key={u.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.nombre || u.email}</span>
                      {esYo && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          tú
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.activo
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{u.email}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                      <span>Alta: {formatFecha(u.created_at)}</span>
                      <span>Último acceso: {formatFechaHora(u.ultimo_acceso)}</span>
                      {u.creado_por_nombre && (
                        <span>Creado por: {u.creado_por_nombre}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={u.rol}
                      disabled={esYo}
                      onChange={(e) =>
                        cambiarRol(u.id, e.target.value as "admin" | "subcuenta")
                      }
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm outline-none disabled:opacity-50"
                    >
                      <option value="subcuenta">Colaborador</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button
                      onClick={() => toggleActivo(u.id, !u.activo)}
                      disabled={esYo}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                        u.activo
                          ? "text-red-600 hover:bg-red-50"
                          : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => editarNombre(u.id, u.nombre || "")}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => resetPassword(u.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
                    >
                      Contraseña
                    </button>
                    <button
                      onClick={() => eliminarUsuario(u.id, u.nombre || u.email)}
                      disabled={esYo}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Asignación de proyectos (colaboradores) */}
                {u.rol === "subcuenta" && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium text-muted">
                      Proyectos que puede ver:
                    </p>
                    {proyectos.length === 0 ? (
                      <p className="text-xs text-muted">
                        No hay proyectos todavía.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {proyectos.map((p) => {
                          const asignado = asignaciones.some(
                            (a) => a.proyecto_id === p.id && a.user_id === u.id,
                          );
                          return (
                            <button
                              key={p.id}
                              onClick={() =>
                                toggleAsignacion(u.id, p.id, !asignado)
                              }
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                asignado
                                  ? "bg-accent text-white"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {asignado ? "✓ " : ""}
                              {p.nombre}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
