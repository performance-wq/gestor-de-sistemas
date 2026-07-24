"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";

// El formulario de onboarding lo llena el cliente final: se muestra a pantalla
// completa, sin la cabecera ni el ancho del panel interno.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/onboarding")) return <>{children}</>;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
