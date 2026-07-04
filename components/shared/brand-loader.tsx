import { Sun } from "lucide-react";

/**
 * Kurumsal sayfa-geçişi yükleniyor ekranı — dönen logo halkası + marka adı
 * (shimmer) + animasyonlu "Yükleniyor" noktaları. Saf CSS animasyon; client JS
 * gerektirmez, bu yüzden `loading.tsx` (Server Component) fallback'lerinde
 * doğrudan kullanılabilir. Stiller: `.brand-loader*` (app/globals.css).
 */
export function BrandLoader({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <div className="brand-loader-mark">
        <span className="brand-loader-pulse" aria-hidden />
        <span className="brand-loader-ring" aria-hidden />
        <span className="brand-loader-badge">
          <Sun className="size-7" />
        </span>
      </div>
      <p className="shimmer-text brand-loader-title">Teklif Platformu</p>
      <p className="brand-loader-sub">
        {label}
        <span className="brand-loader-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </p>
      <span className="sr-only">Sayfa yükleniyor, lütfen bekleyin.</span>
    </div>
  );
}
