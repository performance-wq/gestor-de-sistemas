import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Verifica que quien llama sea un admin activo. Devuelve el cliente admin y el id.
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
  return { ok: true as const, admin, callerId: user.id };
}

// GET — lista completa de usuarios con último acceso y quién los creó.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: "No autorizado" }, { status: auth.status });
  const { admin } = auth;

  const { data: perfiles } = await admin
    .from("profiles")
    .select("id,email,nombre,rol,activo,created_at,creado_por")
    .order("created_at", { ascending: true });

  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 });
  const ultimo: Record<string, string | null> = {};
  for (const u of lista?.users ?? []) ultimo[u.id] = u.last_sign_in_at ?? null;

  const nombrePorId: Record<string, string> = {};
  for (const p of perfiles ?? []) nombrePorId[p.id] = p.nombre || p.email;

  const usuarios = (perfiles ?? []).map((p) => ({
    ...p,
    ultimo_acceso: ultimo[p.id] ?? null,
    creado_por_nombre: p.creado_por ? nombrePorId[p.creado_por] ?? null : null,
  }));

  return NextResponse.json({ usuarios });
}

// POST — crear usuario.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: "No autorizado" }, { status: auth.status });
  const { admin, callerId } = auth;

  let body: { email?: string; nombre?: string; password?: string; rol?: string };
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

  await admin
    .from("profiles")
    .update({ nombre: nombre || email, rol, activo: true, creado_por: callerId })
    .eq("id", creado.user.id);

  return NextResponse.json({ id: creado.user.id });
}

// PATCH — editar usuario (nombre) o restablecer contraseña.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: "No autorizado" }, { status: auth.status });
  const { admin } = auth;

  let body: { id?: string; password?: string; nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.id)
    return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  if (body.password !== undefined) {
    if (body.password.length < 8)
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 },
      );
    const { error } = await admin.auth.admin.updateUserById(body.id, {
      password: body.password,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.nombre !== undefined) {
    await admin
      .from("profiles")
      .update({ nombre: body.nombre.trim() })
      .eq("id", body.id);
  }

  return NextResponse.json({ ok: true });
}

// DELETE — eliminar usuario por completo.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: "No autorizado" }, { status: auth.status });
  const { admin, callerId } = auth;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  if (id === callerId)
    return NextResponse.json(
      { error: "No puedes eliminarte a ti mismo." },
      { status: 400 },
    );

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
