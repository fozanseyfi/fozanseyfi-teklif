// Sentry client-side init — env yoksa no-op.
// Yapılandırma için: vercel.com → Project → Settings → Env Variables
//   NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
//
// DSN tanımlı değilse sentry init edilmez, console.warn'da gözükür.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Performance: %10 transaction sample. Yüksek trafikte aşağı çekilebilir.
    tracesSampleRate: 0.1,
    // Replay: %1 normal, %100 error session. Maliyet kontrolü için düşük tutuldu.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    // PII (kişisel veri) gönderme — KVKK uyumu için kapalı.
    sendDefaultPii: false,
  });
}
