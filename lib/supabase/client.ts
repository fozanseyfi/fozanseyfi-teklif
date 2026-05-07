"use client";

import { createBrowserClient } from "@supabase/ssr";

// Tarayicidan kullanilan Supabase istemcisi.
// 4 site arasinda paylasilan oturum icin cookie SameSite=Lax, Secure ve
// (production'da) Domain=.fozanseyfi.com olarak set edilir; bu degerler
// middleware tarafindan ayarlanir.
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
