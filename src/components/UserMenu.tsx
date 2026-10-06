"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { etiquetaRol } from "@/lib/roles";
import { MiCodigoModal } from "./MiCodigoModal";

export function UserMenu() {
  const { usuario } = useStore();
  const router = useRouter();
  const [codigoAbierto, setCodigoAbierto] = useState(false);

  if (!usuario) return null;

  async function salir() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const inicial = (usuario.nombre || usuario.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {codigoAbierto && <MiCodigoModal onClose={() => setCodigoAbierto(false)} />}
      <button
        onClick={() => setCodigoAbierto(true)}
        className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground sm:block"
        title="Configura tu código para tomar y entregar tareas"
      >
        🔑 Mi código
      </button>
      <Link
        href="/auditoria"
        className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground sm:block"
      >
        Actividad
      </Link>
      {usuario.rol === "admin" && (
        <>
          <Link
            href="/archivados"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground sm:block"
            title="Proyectos archivados"
          >
            🗑 Papelera
          </Link>
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
          >
            Admin
          </Link>
        </>
      )}
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-tight">{usuario.nombre}</div>
        <div className="text-xs text-muted">{etiquetaRol(usuario.rol)}</div>
      </div>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
        {inicial}
      </span>
      <button
        onClick={salir}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
      >
        Salir
      </button>
    </div>
  );
}
