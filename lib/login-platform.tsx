/*
 * Giriş sayfasının BU PLATFORMA ÖZGÜ kısmı. Sayfanın geri kalanı
 * components/auth/login-kit.tsx'te — o dosya bütün platformlarda birebir aynıdır.
 */
import type { LoginPlatform } from "@/components/auth/login-kit";
import { BrandMark } from "@/components/shared/brand-mark";
import manifest from "@/lib/tanitim/manifest.json";
import { TOUR } from "@/lib/tanitim/config";

interface TourModule { id: string; title: string; steps: { img: string; title: string }[] }
const MODULES = (manifest.modules as TourModule[]).filter((m) => m.steps.length > 0);

function shot(moduleId: string, step: number) {
  const m = MODULES.find((x) => x.id === moduleId) ?? MODULES[0];
  const s = m?.steps[Math.min(step, (m?.steps.length ?? 1) - 1)];
  return { id: m?.id ?? moduleId, img: s?.img ?? "", title: s?.title ?? "" };
}

export const LOGIN_PLATFORM: LoginPlatform = {
  id: "teklif",
  name: "SolarTeklif",
  fullName: "Solar Teklif Platformu",
  mark: <BrandMark />,
  accent: "#1d6b47",
  accentDark: "#3f9b6f",
  intro: {
    eyebrow: "GES EPC teklifleri için",
    title: "Keşiften imzalı sözleşmeye, teklifin bütün aşamaları tek yerde.",
    text:
      "Keşif kalemlerini girin, kritik malzemeyi seçin, kârı kalem bazında dağıtın. Teklif belgesi, müşteri linki, sözleşme ve maliyet takibi aynı verinin üzerinden çalışır; aynı rakamı üç ayrı dosyada güncellemezsiniz.",
    points: [
      { title: "Keşif ve analiz", text: "Keşif-A / B, kritik malzeme alternatifleri, marj ve nakit akışı" },
      { title: "Teklif ve BoQ çıktıları", text: "Ana teklif, P-BoQ ve kapsam matrisi; PDF ve Excel" },
      { title: "Müşteriyle paylaşım", text: "Süreli link; müşteri onaylar, soru sorar, revize ister" },
      { title: "Sözleşme ve maliyet", text: "Sözleşme taslağı, tahsilat ve tedarikçi ödemeleri" },
    ],
  },
  hero: {
    ...(() => {
      const s = shot("proje-detay", 2);
      return { img: s.img, caption: `Gerçek ekran: ${s.title}`, href: `/tanitim#${s.id}` };
    })(),
  },
  privacy: [
    "Her firma yalnız kendi kayıtlarını görür",
    "Veritabanında satır seviyesinde erişim kuralı",
    "Üçüncü taraf izleme ya da reklam yok",
    "Erişimi yalnız sizin davet ettikleriniz alır",
  ],
  tour: {
    text: TOUR.promoText,
    modules: MODULES.map((m) => ({ id: m.id, title: m.title })),
    total: MODULES.reduce((n, m) => n + m.steps.length, 0),
    previews: TOUR.previews.map((p) => ({ ...shot(p.id, p.step), label: p.label })),
  },
};
