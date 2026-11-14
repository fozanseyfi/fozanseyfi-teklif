import type { PlatformId } from "./platform-logos";

/**
 * Tüm platformlarda ORTAK veri — components/common/ klasörü her platformda birebir aynıdır.
 * Bir bilgi değişirse dört platformda da aynı şekilde güncellenmelidir.
 */

export const DEVELOPER = {
  name: "Furkan Ozan Seyfi",
  role: "Elektrik Mühendisi",
  position: "Senior Business Development Manager",
  company: "Huawei",
  education: "Yıldız Teknik Üniversitesi",
  expertise: "Utility scale projelerin yönetimi, yatırım ve operasyon",
  phone: "+90 506 684 29 33",
  email: "fozanseyfi@gmail.com",
  linkedin: { label: "linkedin.com/in/fozanseyfi", href: "https://www.linkedin.com/in/fozanseyfi/" },
  website: { label: "fozanseyfi.com", href: "https://fozanseyfi.com" },
} as const;

export interface PlatformInfo {
  id: PlatformId;
  title: string;
  tagline: string;
  description: string;
  /** Yayın adresi; yoksa kart tıklanamaz */
  href?: string;
  status: "live" | "soon";
}

export const PLATFORMS: PlatformInfo[] = [
  {
    id: "fizibilite",
    title: "Solar Fizibilite Platformu",
    tagline: "Yatırım & geri ödeme analizi",
    description:
      "Utility ve C&I GES yatırımları için saatlik mahsuplaşma, NPV, IRR, LCOE ve nakit akışı. Senaryo karşılaştırması ve paylaşılabilir rapor.",
    href: "https://fizibilite.fozanseyfi.com",
    status: "live",
  },
  {
    id: "teklif",
    title: "Solar Teklif Platformu",
    tagline: "EPC fiyatlandırma & nakit akışı",
    description:
      "Solar EPC projeleri için fiyatlandırma, marj hesabı ve nakit akışı yönetimi. Hazır şablonlar, PDF ve Excel çıktıları ile teklif analizi.",
    href: "https://teklif.fozanseyfi.com",
    status: "live",
  },
  {
    id: "proje",
    title: "Proje Yönetim Platformu",
    tagline: "Çoklu proje, ekip & ilerleme takibi",
    description:
      "GES/RES/HES projeleri için WBS, S-eğrisi, günlük gerçekleşme, puantaj, claim ve günlük rapor modülleri. SPI/CPI/EAC otomatik hesaplanır.",
    href: "https://pm.fozanseyfi.com",
    status: "live",
  },
  {
    id: "karardestek",
    title: "Satınalma Karar Destek",
    tagline: "Çoklu kriterli tedarik kararı",
    description:
      "GES/RES projeleri için 10 metrikli ağırlıklı skor algoritması, revize karşılaştırma, PDF ve Excel çıktı. Taşeron, malzeme ve hizmet tekliflerini tek panelden değerlendirin.",
    href: "https://karardestek.fozanseyfi.com",
    status: "live",
  },
  {
    id: "bom",
    title: "Konstrüksiyon BoM Platformu",
    tagline: "Solar BOM · Konstrüksiyon tonaj hesabı",
    description:
      "GES konstrüksiyon masalarının (kolon, kiriş, aşık, çapraz ve bağlantı elemanları, galvaniz) ağırlığını otomatik hesaplar. Proje tonajı, sevk malzeme listesi, Excel/PDF rapor ve 3D önizleme.",
    status: "live",
  },
  {
    id: "ges-muh",
    title: "GES Mühendislik Platformu",
    tagline: "Tasarım, hesap & dokümantasyon",
    description:
      "Tasarım hesabı, kayıp analizi, kablo ve inverter seçimi. Tek hat şeması ve teknik dokümantasyon üretimi.",
    status: "soon",
  },
];
