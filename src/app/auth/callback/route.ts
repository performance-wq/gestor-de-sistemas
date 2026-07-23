import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Intercambia el ?code= del enlace de confirmación de correo (flujo PKCE)
// por una sesión, y redirige al inicio.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Rutas bajo basePath /systemspex.
  const next = searchParams.get("next") ?? "/systemspex/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/systemspex/login?error=auth`);
}
