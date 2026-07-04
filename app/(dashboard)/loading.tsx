import { BrandLoader } from "@/components/shared/brand-loader";

/**
 * Dashboard içi sayfa geçişlerinde (Projeler, Müşteriler, 3D Tasarım, ...)
 * hedef sayfa hazırlanana kadar gösterilen kurumsal yükleniyor ekranı.
 * Next.js App Router bu fallback'i geçiş başlar başlamaz anında gösterir,
 * sayfa hazır olunca kaldırır — kullanıcı "bozuldu mu" diye düşünmez.
 */
export default function Loading() {
  return <BrandLoader />;
}
