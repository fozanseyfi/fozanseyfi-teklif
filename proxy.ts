import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = publicRoutes.some((r) => pathname === r || pathname.startsWith(r + "?"));
  const isAuthRoute = authRoutes.some((r) => pathname === r || pathname.startsWith(r + "?"));

  const sessionCookie = request.cookies.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/admin") && session?.role !== "FIRM_ADMIN") {
    // Platform admin kontrolü için ayrı bir env veya flag gerekir
    // Şimdilik FIRM_ADMIN rolünü platform admin olarak değerlendiriyoruz
    // TODO: platform_admin flag ekle
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
