"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Modo = "login" | "registro";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [modo, setModo] = useState<Modo>("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    setAviso("");

    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(
            error.message.toLowerCase().includes("not confirmed")
              ? "Debes confirmar tu correo antes de entrar. Revisa tu bandeja."
              : "Correo o contraseña incorrectos.",
          );
          setCargando(false);
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre },
            emailRedirectTo: `${window.location.origin}/systemspex/auth/callback`,
          },
        });
        if (error) {
          setError(error.message);
          setCargando(false);
          return;
        }
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setAviso(
            "Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.",
          );
          setModo("login");
          setCargando(false);
        }
      }
    } catch (err) {
      setError(
        "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
      );
      setCargando(false);
      console.error("Error de autenticación:", err);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Systems PEX</h1>
          <p className="mt-1 text-sm text-muted">
            {modo === "login"
              ? "Inicia sesión para continuar"
              : "Crea tu cuenta"}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          {modo === "registro" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {aviso && <p className="text-sm text-emerald-600">{aviso}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {cargando
              ? "Un momento…"
              : modo === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </button>

          <p className="text-center text-sm text-muted">
            {modo === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button
              type="button"
              onClick={() => {
                setModo(modo === "login" ? "registro" : "login");
                setError("");
                setAviso("");
              }}
              className="font-medium text-accent hover:underline"
            >
              {modo === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
