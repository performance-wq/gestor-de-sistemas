import { createClient } from "@supabase/supabase-js";

// Cliente admin (service role) — SOLO servidor. Bypasea RLS.
// Requiere SUPABASE_SECRET_KEY (nunca expuesta al cliente).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
