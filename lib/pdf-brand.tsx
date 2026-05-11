/**
 * PDF/HTML çıktıları için marka render helper'ları + paylaşılan tipler.
 *
 * Her PDF generator'i (boq-view print, kesif-print, priced-boq, dor, api/pdf
 * route'ları) buradan inline-style HTML parçaları çekip kendi template'ine
 * gömer. Tek-noktada brand davranışı, kullanıcı ayarları (logoEnabled,
 * colorEnabled vb.) burada tek seferde çözülür.
 */

/**
 * Marka ayarlari — Organization.brandSettings JSON sema'sinin TS tipi.
 * `app/actions/firm.ts` "use server" dosyasi non-async export edemedigi icin
 * bu tip + parser burada.
 */
export interface BrandSettings {
  logoUrl?: string;
  logoEnabled?: boolean;
  color?: string;
  colorEnabled?: boolean;
  slogan?: string;
  sloganEnabled?: boolean;
  watermarkEnabled?: boolean;
  taxNumber?: string;
  contact?: string;
}

/** JSON'dan tip-guvenli BrandSettings okur — eski org'larda alan yoksa default. */
export function parseBrandSettings(raw: unknown): BrandSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const pickStr = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string) : undefined;
  const pickBool = (k: string) =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : undefined;
  return {
    logoUrl: pickStr("logoUrl"),
    logoEnabled: pickBool("logoEnabled"),
    color: pickStr("color"),
    colorEnabled: pickBool("colorEnabled"),
    slogan: pickStr("slogan"),
    sloganEnabled: pickBool("sloganEnabled"),
    watermarkEnabled: pickBool("watermarkEnabled"),
    taxNumber: pickStr("taxNumber"),
    contact: pickStr("contact"),
  };
}

/** Marka rengi default emerald. colorEnabled false ise default kullanılır. */
export const DEFAULT_BRAND_COLOR = "#059669";

/** Hex stringini RGB'ye çevirip 3 ton üretir — gradient için. */
function shade(hex: string, lighten: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const blend = (c: number) =>
    Math.round(c + (lighten > 0 ? (255 - c) * lighten : c * lighten));
  const to2 = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${to2(blend(r))}${to2(blend(g))}${to2(blend(b))}`;
}

export interface BrandContext {
  // Kullanılacak ana renk (colorEnabled ? brand.color : default)
  primary: string;
  // Gradient için iki yan ton (koyu → açık)
  primaryDark: string;
  primaryLight: string;
  // Cover gradient CSS string'i
  coverGradient: string;
  // Accent bar CSS string'i
  accentGradient: string;
  // Logo (logoEnabled && logoUrl varsa)
  logoUrl?: string;
  showLogo: boolean;
  // Slogan (sloganEnabled && slogan varsa)
  slogan?: string;
  showSlogan: boolean;
  // Watermark
  showWatermark: boolean;
  // Footer extras
  taxNumber?: string;
  contact?: string;
}

export function resolveBrand(brand: BrandSettings | null | undefined): BrandContext {
  const b = brand ?? {};
  const colorOn = b.colorEnabled === true;
  const primary = colorOn && b.color ? b.color : DEFAULT_BRAND_COLOR;
  const primaryDark = shade(primary, -0.55);
  const primaryLight = shade(primary, 0.45);
  const coverGradient = `linear-gradient(135deg, ${primaryDark} 0%, ${primary} 55%, ${primaryLight} 100%)`;
  const accentGradient = `linear-gradient(90deg, ${primary}, ${primaryLight}, transparent)`;

  return {
    primary,
    primaryDark,
    primaryLight,
    coverGradient,
    accentGradient,
    logoUrl: b.logoUrl,
    showLogo: b.logoEnabled === true && !!b.logoUrl,
    slogan: b.slogan,
    showSlogan: b.sloganEnabled === true && !!b.slogan?.trim(),
    showWatermark: b.watermarkEnabled === true,
    taxNumber: b.taxNumber,
    contact: b.contact,
  };
}

/** Insan-okur kısa ID: 9 karakter, 3-3-3 dilim. Audit'te aramayı kolaylaştırır. */
export function generateDocId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // O/0/I/1 ayıklı
  const part = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part(3)}-${part(3)}-${part(3)}`;
}

/** PDF print için brand-row HTML parçası — cover'ın en üstüne gömülür.
 *  Logo arka plansız (transparent) render edilir; cover gradient'inin üzerine
 *  doğrudan oturur. PNG/SVG transparency korunur. */
export function brandRowHtml(brand: BrandContext, firmName: string): string {
  if (!brand.showLogo && !brand.showSlogan) return "";
  const logo = brand.showLogo
    ? `<img src="${escapeHtml(brand.logoUrl!)}" alt="" style="max-height:42px;max-width:140px;object-fit:contain;flex-shrink:0"/>`
    : "";
  const slogan = brand.showSlogan
    ? `<div style="font-size:9.5px;color:rgba(255,255,255,0.85);font-style:italic;margin-top:2px">${escapeHtml(brand.slogan!)}</div>`
    : "";
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
    ${logo}
    <div style="min-width:0">
      <div style="font-size:13px;font-weight:800;color:#fff;letter-spacing:-0.01em;line-height:1.1">${escapeHtml(firmName)}</div>
      ${slogan}
    </div>
  </div>`;
}

/** PDF print için footer fingerprint HTML'i. */
export function brandFooterHtml(
  brand: BrandContext,
  firmName: string,
  userEmail: string,
  docId: string,
): string {
  const date = new Date().toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const extras = [brand.taxNumber, brand.contact].filter(Boolean).join(" · ");
  return `<div style="position:fixed;bottom:8px;left:0;right:0;text-align:center;font-size:8px;color:#94a3b8;font-family:'Courier New',monospace;letter-spacing:0.04em;padding:0 16px">
    <strong style="color:#475569;font-weight:600">${escapeHtml(firmName.toUpperCase())}</strong>
    ${extras ? ` · <span style="font-family:'Inter',sans-serif">${escapeHtml(extras)}</span>` : ""}
     · ${escapeHtml(userEmail)} · ${date} · doc-id: <strong style="color:#475569">${docId}</strong>
  </div>`;
}

/** Çapraz arka plan filigranı — her sayfada repeating background olarak. */
export function watermarkHtml(brand: BrandContext, firmName: string): string {
  if (!brand.showWatermark) return "";
  return `<div style="position:fixed;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:0;overflow:hidden">
    <span style="font-size:96px;font-weight:900;color:rgba(15,23,42,0.05);transform:rotate(-32deg);white-space:nowrap;letter-spacing:0.1em;text-transform:uppercase">${escapeHtml(firmName)}</span>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
