import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

// Supabase email confirmation / magic link / password recovery linkleri
// kullaniciyi buraya yonlendirir; code -> session takasi yapilir, sonra
// hedef sayfaya redirect edilir.
//
// Hedef belirleme oncelikleri:
// 1. ?next= query param (forgot-password, manuel yonlendirmeler)
// 2. pending_invite_token cookie (signup sirasinda davet token'i set edilmisse)
// 3. /dashboard (default — email confirmation sonrasi normal akis)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const queryNext = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`);
  }

  // Hedef yonlendirme
  let target = queryNext;

  if (!target) {
    const cookieStore = await cookies();
    const inviteToken = cookieStore.get("pending_invite_token")?.value;
    if (inviteToken) {
      cookieStore.delete("pending_invite_token");
      target = `/invite/${inviteToken}`;
    }
  }

  if (!target) target = "/dashboard";

  // Guvenlik: sadece relative path'lere izin ver (open redirect koruma)
  if (!target.startsWith("/") || target.startsWith("//")) {
    target = "/dashboard";
  }

  return NextResponse.redirect(`${origin}${target}`);
}
