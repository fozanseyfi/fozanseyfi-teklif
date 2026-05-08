import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PLATFORM_KEY } from "@/lib/platform";

// Supabase email confirmation / magic link / password recovery / invite linkleri
// kullaniciyi buraya yonlendirir; code -> session takasi yapilir, sonra
// hedef sayfaya redirect edilir.
//
// Hedef yonlendirme oncelikleri:
// 1. ?next= query param (forgot-password gibi)
// 2. user_metadata.invitation_token (admin invite akisi — platform = bu platform mu?)
// 3. pending_invite_token cookie (eski signup akisi)
// 4. /dashboard (default)
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

  let target = queryNext;

  if (!target) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const meta = authUser?.user_metadata as Record<string, unknown> | undefined;
    const inviteToken = typeof meta?.invitation_token === "string" ? meta.invitation_token : null;
    const platform = typeof meta?.platform === "string" ? meta.platform : null;

    if (inviteToken && platform === PLATFORM_KEY) {
      target = `/invite/${inviteToken}`;
    }
  }

  if (!target) {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("pending_invite_token")?.value;
    if (cookieToken) {
      cookieStore.delete("pending_invite_token");
      target = `/invite/${cookieToken}`;
    }
  }

  if (!target) target = "/dashboard";

  // Open-redirect koruma: sadece relative path'lere izin
  if (!target.startsWith("/") || target.startsWith("//")) {
    target = "/dashboard";
  }

  return NextResponse.redirect(`${origin}${target}`);
}
