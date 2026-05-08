import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PLATFORM_KEY } from "@/lib/platform";

// Supabase email confirmation / magic link / invite / password recovery linkleri
// kullaniciyi buraya yonlendirir. Iki ayri auth flow'unu da destekler:
// 1. PKCE flow (?code=xxx) — register/signup, exchangeCodeForSession
// 2. OTP/Token-Hash flow (?token_hash=xxx&type=invite|recovery|signup|email)
//    — invite, magic link, password reset
// 3. Parametresiz — Supabase server-side verify yapip session cookie'ye yazmis,
//    user zaten authenticated, sadece yonlendirelim
//
// Hedef yonlendirme oncelikleri:
// 1. ?next= query param (forgot-password, manuel yonlendirmeler)
// 2. user_metadata.invitation_token (admin invite akisi)
// 3. pending_invite_token cookie (eski signup akisi)
// 4. /dashboard (default)

type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email" | "email_change";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as OtpType | null;
  const queryNext = searchParams.get("next");

  const supabase = await createSupabaseServer();
  let sessionEstablished = false;

  if (code) {
    // PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    sessionEstablished = !error;
  } else if (tokenHash && otpType) {
    // OTP / Token-Hash flow (invite, magic link, recovery)
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    sessionEstablished = !error;
  } else {
    // Parametresiz — session zaten cookie'de olabilir (Supabase server-side verify)
    const { data } = await supabase.auth.getUser();
    sessionEstablished = !!data.user;
  }

  if (!sessionEstablished) {
    return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`);
  }

  // Hedef belirle
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

  // Open-redirect koruma: sadece relative path
  if (!target.startsWith("/") || target.startsWith("//")) {
    target = "/dashboard";
  }

  return NextResponse.redirect(`${origin}${target}`);
}
