import type { CookieOptions } from "@supabase/ssr";

// Tek-tenant ayri Supabase projesi — paylasilan cookie domain gerekmez.
// Cookie kullanicinin geldigi host'a (teklif.fozanseyfi.com / localhost) set edilir.
// Production'da NEXT_PUBLIC_COOKIE_DOMAIN env'i set edilirse override edilir
// (ileride alt-subdomain'lere yayma istenirse).
const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined)
    : undefined;

/** Auth cookie option override — sameSite + secure ortak ayarı, domain opsiyonel. */
export function withSharedDomain(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
