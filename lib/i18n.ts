/**
 * Hafif i18n — Fizibilite platformu ile aynı yaklaşım.
 *
 * Arayüz metinleri Türkçe yazılır. Dil EN seçiliyse lib/i18n-dom.ts sayfadaki metinleri
 * lib/i18n-en.json sözlüğüyle çevirir. Seçim `locale` cookie'sinde (ve localStorage'da) tutulur;
 * tamamı istemci tarafında çalışır, sunucu render'ı Türkçe kalır.
 */

export type Locale = "tr" | "en";

const COOKIE_NAME = "locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 yıl

export function getClientLocale(): Locale {
  if (typeof document === "undefined") return "tr";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (match) return match[1] === "en" ? "en" : "tr";
  try {
    if (localStorage.getItem("locale") === "en") return "en";
  } catch {}
  return "tr";
}

export function setClientLocale(l: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${l}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    localStorage.setItem("locale", l);
  } catch {}
}

/** Etkin dil (istemci). Sunucuda her zaman "tr". */
export const appLocale = (): Locale => getClientLocale();

/** Intl biçimlendirme yereli: "tr-TR" veya "en-US" */
export const numLocale = (): string => (appLocale() === "en" ? "en-US" : "tr-TR");
