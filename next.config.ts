import type { NextConfig } from "next";

// ─── Güvenlik başlıkları ──────────────────────────────────────────────
// Tüm sayfalarda uygulanır. CSP: Supabase, Gmail SMTP (server-side), kendi
// domain'imiz ve Vercel için izinli kaynaklar. Daha sıkı yapmak için
// production'da CSP report-only mod açıp loglara bakılabilir.
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    // Content-Security-Policy:
    // - default-src 'self': aynı origin
    // - script-src: kendi + Vercel/Next.js inline scripts (next/script)
    //   'unsafe-eval' Next.js dev mode için gerek; 'unsafe-inline' next/script
    //   hash-bazlı CSP'ye geçmek istersek kaldırılabilir
    // - style-src: Tailwind inline style'ları için 'unsafe-inline'
    // - img-src: data: (logo'lar inline base64), https: (Supabase Storage,
    //   external image'lar — örn. müşteri logoları)
    // - connect-src: Supabase API + auth + storage
    // - font-src: kendi + data:
    // - frame-src: yok
    // - object-src: yok (PDF iframe yok)
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frankfurter.app",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Sayfa gecislerinde Server Component agacinin client'da onbelleklenme
  // suresi — varsayilan 30sn cok kisa, geri-ileri ve sekmeler arasinda
  // tekrar fetch etmesin diye 5 dakikaya cektik.
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
    // Server Action FormData gövde limiti — varsayılan 1 MB. Firma tanıtım /
    // referans / ek belge PDF'leri 10 MB'a kadar yüklenebildiği için limiti
    // yükseltiyoruz (yoksa büyük PDF yüklemeleri "Body exceeded 1 MB" ile patlar).
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        // Tüm route'lara uygulanır. _next/static gibi yollar Vercel kendi
        // cache header'larını set eder; bu liste onlarla çakışmaz.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
