import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// Supabase email confirmation / magic link / password recovery linkleri
// kullaniciyi buraya yonlendirir; code -> session takasi yapilir, sonra
// hedef sayfaya redirect edilir.
//
// Reset-password akisi: resetPasswordForEmail(redirectTo='/reset-password')
// kullaniciya gonderdigi link sablon olarak <BASE>/auth/callback?code=...
// kullanir; takas tamamlaninca /reset-password'a 302 atilir.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/reset-password";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Hata varsa kullaniciyi forgot-password'a yonlendir, yeniden link talep etsin.
  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`);
}
