import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service role key ile admin yetkili Supabase istemcisi.
// auth.admin.* metodlarini cagirmak icin gerekli (inviteUserByEmail, vb.).
// Server actions ve route handler'lar disinda KESINLIKLE kullanilmamali.
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
