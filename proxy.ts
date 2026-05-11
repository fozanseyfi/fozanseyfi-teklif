import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

// /invite/* path'i auth gerektirmez (login degilse register'a yonlendirir);
// auth ise normal sayfa render eder.
function isInviteRoute(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

// /share/* path'i public — token ile yetkilendirme yapilir, auth aranmaz.
// Misafire/yatirimciya read-only sayfa gosterir.
function isShareRoute(pathname: string): boolean {
  return pathname.startsWith("/share/");
}

// Auth callback (Supabase email link redirect) ve API route'lari guard'in
// disinda tutulur — kendi yetkilendirmelerini yapar veya zaten public'tir.
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/handler") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isExempt(pathname)) {
    // Sadece session cookie'sini refresh et, yonlendirme yapma.
    const { response } = await refreshSupabaseSession(request);
    return response;
  }

  const { response, authed } = await refreshSupabaseSession(request);

  const isPublicRoute = publicRoutes.some((r) => pathname === r || pathname.startsWith(r + "?"));
  const isAuthRoute = authRoutes.some((r) => pathname === r || pathname.startsWith(r + "?"));
  const isInvite = isInviteRoute(pathname);
  const isShare = isShareRoute(pathname);

  if (!authed && !isPublicRoute && !isInvite && !isShare) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Auth route'larina (login/register) auth ile gelirse dashboard'a at,
  // ancak `next` query param varsa ona yonlendir (invite akisinda kullanilir).
  if (authed && isAuthRoute) {
    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/")) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Statik asset'ler ve favicon disindaki tum istekleri kapsa.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
