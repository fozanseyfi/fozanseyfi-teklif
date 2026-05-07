import type { CookieOptions } from "@supabase/ssr";

/**
 * Cross-subdomain SSO için cookie domain'i.
 *
 * Production'da `.fozanseyfi.com` set edilir → tüm kardeş subdomain'lere
 * aynı Supabase auth cookie gider (karardestek + teklif + diğerleri).
 * Localhost'ta `undefined` döner → tarayıcı default'u (host-only) kullanılır,
 * lokal geliştirme etkilenmez.
 */
const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? ".fozanseyfi.com")
    : undefined;

/** Auth cookie option override — domain + sameSite + secure ortak ayarı. */
export function withSharedDomain(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    domain: COOKIE_DOMAIN ?? options.domain,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
