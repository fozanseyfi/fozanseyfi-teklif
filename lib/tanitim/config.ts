/**
 * Tanıtım sayfasının platforma özgü ayarları. Tanıtım bileşenleri (components/tanitim/tour-view.tsx,
 * components/auth/tour-promo.tsx) bütün platformlarda birebir aynıdır; yalnız bu dosya ve
 * manifest/görüntüler platforma göre değişir.
 */
export const TOUR = {
  /** Platformun ana rengi (vurgu, numaralar, kaydırma çubuğu) */
  accent: "#047857",
  /** Gece modunda vurgu rengi */
  accentDark: "#34d399",
  /** Tarayıcı çerçevesindeki adres */
  domain: "teklif.fozanseyfi.com",
  /** Giriş sayfasındaki tanıtım şeridinin açıklaması */
  promoText:
    "Teklif hazırlamadan müşteriyle paylaşıma, sözleşmeden maliyet kontrolüne kadar bütün modüller gerçek ekranlar üzerinden anlatılıyor: hangi butona basılır, form nasıl doldurulur, sonuç nerede görünür.",
  /** Giriş sayfasında gösterilen örnek ekranlar (bölüm id + adım sırası, 0'dan) */
  previews: [
    { id: "giris", step: 1, label: "Dashboard" },
    { id: "proje-detay", step: 2, label: "Teklif analizi" },
    { id: "paylasim", step: 6, label: "Müşteri ekranı" },
  ],
};
