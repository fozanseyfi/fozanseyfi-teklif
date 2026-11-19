/**
 * Platform logosu — "Güneşli Teklif": koyu zümrüt degrade zemin üzerinde kıvrık
 * köşeli beyaz teklif belgesi, üstünde altın güneş, altında fiyat satırları.
 * Fizibilite logosuyla aynı aile (degrade kare + beyaz ana şekil + tek altın vurgu).
 * Aynı sanat app/icon.svg (sekme simgesi) ve public/icon-*.png'de kullanılır;
 * değişirse `node scripts/brand-icons.mjs` ile PNG'leri yeniden üret.
 */
import { useId } from "react";

export function BrandMark({ className }: { className?: string }) {
  // Sayfada birden çok logo olabilir (ör. gizli mobil menü); degrade kimliği her biri için ayrı olmalı,
  // yoksa display:none olan ilk kopyadaki degradeye bağlanır ve zemin görünmez.
  const gid = `tk-bm-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#064E3B" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gid})`} />
      <path d="M19 10h18l12 12v28a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#FFFFFF" />
      <path d="M37 10v9a3 3 0 0 0 3 3h9z" fill="#A7F3D0" />
      <circle cx="26" cy="26" r="6.5" fill="#F5A524" />
      <rect x="22" y="37" width="22" height="5" rx="2.5" fill="#059669" />
      <rect x="22" y="46" width="14" height="5" rx="2.5" fill="#059669" opacity="0.55" />
    </svg>
  );
}
