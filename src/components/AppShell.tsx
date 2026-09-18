"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";

// El formulario de onboarding lo llena el cliente final: se muestra a pantalla
// completa, sin la cabecera ni el ancho del panel interno.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Onboarding (V1 y V2): identidad visual LexBrain (dorado sobre blanco),
  // acotada a esta ruta mediante la clase de tema.
  if (pathname?.startsWith("/onboarding"))
    return <div className="onb-lexbrain">{children}</div>;

  if (pathname?.startsWith("/progreso")) return <>{children}</>;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
