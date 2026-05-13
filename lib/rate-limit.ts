import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash Ratelimit wrapper'ı — env vars (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN) tanımlı değilse no-op olarak çalışır (her
 * istek geçer). Bu sayede local dev'de veya kullanıcı Upstash hesabı
 * açmadığında uygulama bozulmaz.
 *
 * Aktif olduğunda:
 *   - sliding window algoritması
 *   - identifier IP veya kullanıcı ID
 *   - ayrı kovalar: "login", "share-view", "share-response", "mail-send"
 */

const HAS_UPSTASH =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = HAS_UPSTASH ? Redis.fromEnv() : null;

interface BucketConfig {
  // Verilen pencerede kaç istek izinli
  limit: number;
  // Pencere boyutu (örn. "60 s", "10 m", "1 h")
  window: `${number} ${"s" | "m" | "h" | "d"}`;
}

const BUCKETS: Record<string, BucketConfig> = {
  // Login: brute-force koruması. IP başına 10 dk'da 8 deneme.
  login: { limit: 8, window: "10 m" },
  // Public share görüntülenmesi: scraping / bot koruma. Token başına 5 dk'da 30 view.
  "share-view": { limit: 30, window: "5 m" },
  // Müşteri yanıtı: spam koruma. Token başına 1 saatte 20 yanıt.
  "share-response": { limit: 20, window: "1 h" },
  // Mail gönderim: Gmail quota koruma. Kullanıcı başına 1 saatte 30 mail.
  "mail-send": { limit: 30, window: "1 h" },
  // Davet: Supabase quota koruma. Kullanıcı başına 1 saatte 20 davet.
  invite: { limit: 20, window: "1 h" },
  // Generic API rate limit (fallback). IP başına 1 dakikada 60 istek.
  generic: { limit: 60, window: "1 m" },
};

const limiters: Partial<Record<keyof typeof BUCKETS, Ratelimit>> = {};

function getLimiter(bucket: keyof typeof BUCKETS): Ratelimit | null {
  if (!redis) return null;
  if (limiters[bucket]) return limiters[bucket]!;
  const cfg = BUCKETS[bucket];
  const lim = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
    prefix: `rl:${bucket}`,
    analytics: true,
  });
  limiters[bucket] = lim;
  return lim;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  // Upstash yapılandırılmamışsa (env yoksa) noop=true; çağıran sessizce geçer.
  noop?: boolean;
}

/**
 * Bir kovayı identifier (IP veya user ID) ile kontrol eder.
 * success=false dönerse çağıran 429 yanıtı veya toast hatası vermeli.
 */
export async function checkRateLimit(
  bucket: keyof typeof BUCKETS,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(bucket);
  if (!limiter) {
    return { success: true, remaining: Infinity, reset: 0, noop: true };
  }
  try {
    const r = await limiter.limit(identifier);
    return {
      success: r.success,
      remaining: r.remaining,
      reset: r.reset,
    };
  } catch (err) {
    // Upstash erişilemezse uygulamayı kırmadan geç.
    console.warn("[rate-limit] check failed, allowing:", err);
    return { success: true, remaining: 0, reset: 0, noop: true };
  }
}

/**
 * NextRequest'ten IP çıkarır — Vercel + standart proxy header'ları kontrol eder.
 */
export function getClientIp(req: Request | { headers: Headers }): string {
  const h = req.headers;
  // Vercel: x-forwarded-for, x-real-ip
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = h.get("x-real-ip");
  if (xri) return xri;
  return "unknown";
}
