import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withSharedDomain } from "@/lib/supabase/cookie-config";

// Server bilesenleri / server actions / route handler icin Supabase istemcisi.
// Cookie sync: gelen istegin cookie'lerini okur, yenilenen session'i ayni
// cookie store'a yazar — withSharedDomain ile cross-subdomain SSO icin
// .fozanseyfi.com domain'i set edilir.
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, withSharedDomain(options));
            });
          } catch {
            // Server Component context — ignore (proxy handles refresh)
          }
        },
      },
    },
  );
}
