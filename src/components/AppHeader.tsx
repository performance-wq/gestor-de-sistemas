"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { esGestor } from "@/lib/tasks";
import { UserMenu } from "./UserMenu";
import { NotificacionesMenu } from "./NotificacionesMenu";

const NAV = [
  { href: "/tablero", label: "Tablero", match: ["/tablero"], soloGestor: true },
  { href: "/dashboard", label: "Proyectos", match: ["/dashboard", "/proyecto"], soloGestor: false },
  { href: "/tareas", label: "Gestión de tareas", match: ["/tareas"], soloGestor: false },
];

export function AppHeader() {
  const pathname = usePathname() ?? "";
  const { usuario } = useStore();
  const gestor = esGestor(usuario?.rol);
  const items = NAV.filter((i) => !i.soloGestor || gestor);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              S
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight sm:block">
              Systems PEX
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const activo = item.match.some((m) => pathname.startsWith(m));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activo
                      ? "bg-slate-100 text-foreground"
                      : "text-muted hover:bg-slate-50 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <NotificacionesMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
