import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withSharedDomain } from "@/lib/supabase/cookie-config";

// Next.js 16 proxy (eski adi: middleware) icin Supabase session refresh +
// optimistik route guard. Asil yetkilendirme `lib/auth.ts.requireAuth` ile
// server-side yapilir; bu fonksiyon sadece UX icin login'siz kullaniciyi
// erken yonlendirip cookie session'ini refresh ediyor.
//
// Cookie domain'i withSharedDomain ile set edilir (.fozanseyfi.com) —
// karardestek + teklif + kardes subdomain'ler ayni Supabase auth cookie'sini
// paylasir, kullanici bir kez login olunca tum sitelerde session aktif.
export async function refreshSupabaseSession(request: NextRequest): Promise<{
  response: NextResponse;
  authed: boolean;
}> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, withSharedDomain(options));
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, authed: !!user };
}
