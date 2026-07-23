import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Verifica que quien llama sea un admin activo.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("profiles")
    .select("rol, activo")
    .eq("id", user.id)
    .single();
  if (!perfil || perfil.rol !== "admin" || perfil.activo === false)
    return { ok: false as const, status: 403 };
  return { ok: true as const, admin };
}

// POST — crear un usuario nuevo (solo admin).
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: "No autorizado" }, { status: auth.status });

  let body: {
    email?: string;
    nombre?: string;
    password?: string;
    rol?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const nombre = (body.nombre ?? "").trim();
  const password = body.password ?? "";
  const rol = body.rol === "admin" ? "admin" : "subcuenta";

  if (!email || password.length < 8)
    return NextResponse.json(
      { error: "Correo y contraseña (mín. 8 caracteres) son obligatorios." },
      { status: 400 },
    );

  const { admin } = auth;

  const { data: creado, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error || !creado.user)
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear el usuario." },
      { status: 400 },
    );

  // El trigger crea el profile; ajustamos nombre y rol.
  await admin
    .from("profiles")
    .update({ nombre: nombre || email, rol, activo: true })
    .eq("id", creado.user.id);

  return NextResponse.json({ id: creado.user.id });
}
