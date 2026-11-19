import { Wrench } from "lucide-react";

/**
 * Platformların GERÇEK logoları — her biri kendi projesinden birebir alındı:
 * - teklif      : teklif/app/icon.svg (zümrüt degrade + güneşli teklif belgesi)
 * - proje       : proje-takip/src/components/brand/logo.tsx LogoMark (slate gradient + 3 sütun + emerald nokta)
 * - karardestek : https://karardestek.fozanseyfi.com/icon.svg (sarı gradient + kupa)
 * - fizibilite  : bu projenin src/app/icon.svg
 * - bom         : mounting/src/app/icon.svg (Solar BOM — konstrüksiyon)
 * - ges-muh     : henüz yayında değil, kendi logosu yok → diğer platform listelerindeki anahtar simgesi
 */
export type PlatformId = "teklif" | "proje" | "karardestek" | "fizibilite" | "bom" | "ges-muh";

export function PlatformLogo({ id, size = 40, className }: { id: PlatformId; size?: number; className?: string }) {
  const p = { width: size, height: size, className, "aria-hidden": true } as const;
  switch (id) {
    case "teklif":
      return (
        <svg {...p} viewBox="0 0 64 64">
          <defs>
            <linearGradient id="pl-teklif" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#064E3B" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#pl-teklif)" />
          <path d="M19 10h18l12 12v28a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#FFFFFF" />
          <path d="M37 10v9a3 3 0 0 0 3 3h9z" fill="#A7F3D0" />
          <circle cx="26" cy="26" r="6.5" fill="#F5A524" />
          <rect x="22" y="37" width="22" height="5" rx="2.5" fill="#059669" />
          <rect x="22" y="46" width="14" height="5" rx="2.5" fill="#059669" opacity="0.55" />
        </svg>
      );
    case "proje":
      return (
        <svg {...p} viewBox="0 0 32 32">
          <defs>
            <linearGradient id="pl-proje" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0f172a" />
              <stop offset=".55" stopColor="#1e293b" />
              <stop offset="1" stopColor="#334155" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="7" fill="url(#pl-proje)" />
          <g transform="translate(7.2 7.2) scale(0.733)" fill="#ffffff">
            <rect x="3" y="14" width="4.5" height="7" rx="1" opacity="0.55" />
            <rect x="9.75" y="9" width="4.5" height="12" rx="1" opacity="0.8" />
            <rect x="16.5" y="4" width="4.5" height="17" rx="1" />
          </g>
          <circle cx="24.6" cy="7.4" r="4.9" fill="#0f172a" />
          <circle cx="24.6" cy="7.4" r="2.9" fill="#059669" />
        </svg>
      );
    case "karardestek":
      return (
        <svg {...p} viewBox="0 0 32 32">
          <defs>
            <linearGradient id="pl-kd" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="7" fill="url(#pl-kd)" />
          <g transform="translate(4 4)" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </g>
        </svg>
      );
    case "fizibilite":
      return (
        <svg {...p} viewBox="0 0 64 64">
          <defs>
            <linearGradient id="pl-fz" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0B2350" />
              <stop offset="1" stopColor="#1A4A94" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#pl-fz)" />
          <path d="M16 34 L27 45 L38 32" fill="none" stroke="#FFFFFF" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M38 32 L46 23" fill="none" stroke="#E8A020" strokeWidth="6.5" strokeLinecap="round" />
        </svg>
      );
    case "bom":
      return (
        <svg {...p} viewBox="0 0 64 64">
          <defs>
            <linearGradient id="pl-bom" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0B2350" />
              <stop offset="1" stopColor="#1A4A94" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#pl-bom)" />
          <path d="M22 28 V46 M42 21 V46" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M13 31 L51 18" fill="none" stroke="#FFFFFF" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M13 47 H51" fill="none" stroke="#E8A020" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    case "ges-muh":
      return (
        <span className={className} style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: size * 0.22, background: "#e11d48", color: "#fff" }} aria-hidden>
          <Wrench style={{ width: size * 0.5, height: size * 0.5 }} />
        </span>
      );
  }
}
