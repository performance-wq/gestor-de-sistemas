import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Intercambia el ?code= del enlace de confirmación de correo (flujo PKCE)
// por una sesión, y redirige al inicio.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
