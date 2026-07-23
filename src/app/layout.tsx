import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppHeader } from "@/components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Systems PEX",
  description:
    "Herramienta interna Pex para gestionar implementaciones de CRM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full">
        <StoreProvider>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
