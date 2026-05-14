import { NextResponse } from "next/server";

/**
 * USD/EUR → TRY kuru. Server-side; çoklu provider fallback + 30 dk cache
 * + son çare hard-coded değer. Tarayıcıdan direkt provider çağırmak
 * yerine bu endpoint kullanılır (CORS/rate-limit yok).
 *
 * Sıralama: TCMB (Türk Merkez Bankası — en sağlam, günde 1 güncellenir,
 * iş günleri) → open.er-api → exchangerate.host → Frankfurter → fallback.
 */

interface FxResult {
  usd: number;
  eur: number;
  source: string;
  fetchedAt: string;
}

// Process içi cache — Vercel cold-start arasında sıfırlanır ama
// sıcakken aynı instance dakikalarca tekrar çağrılırsa cache hit.
let cached: { value: FxResult; expiresAt: number } | null = null;
const CACHE_MS = 30 * 60 * 1000; // 30 dk

// Son çare fallback — TÜM provider'lar başarısızsa bile kullanıcı
// "Kur servisi yanıt vermedi" yerine yaklaşık değerle devam etsin.
// Bu değerler periyodik güncellenmeli — şu an Mayıs 2026 makul orta:
const FALLBACK_USD = 39.5;
const FALLBACK_EUR = 43.0;

export async function GET(): Promise<NextResponse> {
  // Cache hit
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const result = await fetchFresh();
  cached = { value: result, expiresAt: Date.now() + CACHE_MS };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function fetchFresh(): Promise<FxResult> {
  const providers: Array<() => Promise<{ usd: number; eur: number; source: string }>> = [
    fetchTcmb,
    fetchOpenErApi,
    fetchExchangerateHost,
    fetchFrankfurter,
  ];

  for (const provider of providers) {
    try {
      const r = await provider();
      if (r.usd > 0 && r.eur > 0) {
        return { ...r, fetchedAt: new Date().toISOString() };
      }
    } catch (e) {
      console.warn(`[fx-api] provider failed:`, (e as Error).message);
    }
  }

  // Hiçbiri çalışmadı — fallback
  return {
    usd: FALLBACK_USD,
    eur: FALLBACK_EUR,
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  };
}

// TCMB (Türkiye Merkez Bankası) — XML feed, iş günleri 15:30'da güncellenir.
// En sağlam ve resmi kaynak. Hafta sonu cuma kuru gözükür.
async function fetchTcmb(): Promise<{ usd: number; eur: number; source: string }> {
  const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("TCMB HTTP " + res.status);
  const xml = await res.text();

  // Basit XML parse — sadece <Currency CurrencyCode="USD/EUR"> bloklarını
  // bul, ForexSelling değerini al (forex satış = bizim "kac TRY = 1 USD" değerimiz)
  const usd = extractTcmbRate(xml, "USD");
  const eur = extractTcmbRate(xml, "EUR");
  if (!usd || !eur) throw new Error("TCMB parse failed");
  return { usd, eur, source: "TCMB" };
}

function extractTcmbRate(xml: string, code: string): number | null {
  // <Currency CurrencyCode="USD" ...> ... <ForexSelling>34.1234</ForexSelling> ... </Currency>
  const blockMatch = xml.match(
    new RegExp(`<Currency[^>]*CurrencyCode="${code}"[\\s\\S]*?</Currency>`, "i"),
  );
  if (!blockMatch) return null;
  const rateMatch = blockMatch[0].match(/<ForexSelling>([\d.]+)<\/ForexSelling>/);
  if (!rateMatch) return null;
  const val = parseFloat(rateMatch[1]);
  return isFinite(val) && val > 0 ? val : null;
}

async function fetchOpenErApi(): Promise<{ usd: number; eur: number; source: string }> {
  const res = await fetch("https://open.er-api.com/v6/latest/TRY", {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("open.er-api HTTP " + res.status);
  const data = await res.json();
  const usd = data?.rates?.USD;
  const eur = data?.rates?.EUR;
  if (!usd || !eur) throw new Error("open.er-api no rates");
  // base=TRY, dolayısıyla 1/usd = 1 USD'nin TRY karşılığı
  return { usd: 1 / usd, eur: 1 / eur, source: "open.er-api" };
}

async function fetchExchangerateHost(): Promise<{ usd: number; eur: number; source: string }> {
  const res = await fetch(
    "https://api.exchangerate.host/latest?base=TRY&symbols=USD,EUR",
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error("exchangerate.host HTTP " + res.status);
  const data = await res.json();
  const usd = data?.rates?.USD;
  const eur = data?.rates?.EUR;
  if (!usd || !eur) throw new Error("exchangerate.host no rates");
  return { usd: 1 / usd, eur: 1 / eur, source: "exchangerate.host" };
}

async function fetchFrankfurter(): Promise<{ usd: number; eur: number; source: string }> {
  const [usdRes, eurRes] = await Promise.all([
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    }),
    fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    }),
  ]);
  const usdData = await usdRes.json();
  const eurData = await eurRes.json();
  const usd = usdData?.rates?.TRY;
  const eur = eurData?.rates?.TRY;
  if (!usd || !eur) throw new Error("Frankfurter no rates");
  return { usd, eur, source: "frankfurter" };
}
