import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

// Auth callback (Supabase email link redirect) ve API route'lari guard'in
// disinda tutulur — kendi yetkilendirmelerini yapar veya zaten public'tir.
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/auth/callback") ||
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

  if (!authed && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authed && isAuthRoute) {
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
