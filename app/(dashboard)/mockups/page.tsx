import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Search,
  Sun,
  FileText,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Palette,
} from "lucide-react";

/**
 * Mockup turu — gelecekte yapılabilecek özelliklerin görsel önizlemesi.
 * Tüm sayfalar fake data ile çalışır; gerçek DB veya API entegrasyonu yok.
 * Karar vermek için "neye benzeyecek?" sorusuna cevap.
 */

interface MockupCard {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  effort: string;
  highlights: string[];
  href: string;
}

const MOCKUPS: MockupCard[] = [
  {
    id: "kpi",
    code: "D1",
    title: "Yönetici KPI Dashboard",
    subtitle: "Direktör — firmasal toplam görünüm",
    description:
      "Şu an dashboard kişisel iş listesi gibi. Direktör/CEO için firmasal toplam: bu ay teklif sayısı, MWp, kazanma oranı, $/Wp, bekleyen ciro, 12 ay trend.",
    icon: BarChart3,
    effort: "~1.5 gün",
    highlights: [
      "6 KPI kartı (teklif sayısı, MWp, win rate, $/Wp, pipeline, ciro)",
      "12 aylık trend grafiği (Recharts bar+line)",
      "Y/Y karşılaştırma (geçen yıl bu ay vs şimdi)",
      "Top 3 kazanan satışçı listesi",
    ],
    href: "/mockups/kpi-dashboard",
  },
  {
    id: "search",
    code: "E1",
    title: "Ctrl+K Global Arama",
    subtitle: "Operatör — her sayfadan hızlı erişim",
    description:
      "Her sayfada Ctrl+K basınca modal açılır. Proje adı, müşteri, kalem kodu (A.1.3) ile her yerden ara. Son açılan + sık açılan sıralı, ↑↓ Enter ile gez.",
    icon: Search,
    effort: "~0.5 gün",
    highlights: [
      "Cmdk modal — tüm sayfada Ctrl+K shortcut",
      "Proje / müşteri / kalem koduyla arama",
      "Son açılan + sık açılan sıralı sonuçlar",
      "Klavye odaklı (↑↓ Enter ESC)",
    ],
    href: "/mockups/global-search",
  },
  {
    id: "pvgis",
    code: "B1",
    title: "PVGIS Üretim Simülasyonu",
    subtitle: "Mühendis — gerçekçi yıllık üretim",
    description:
      "Şu an fizibilite kaba (peakSunHoursPerDay × 365). PVGIS API ile lokasyon-bazlı saatlik irradiation çekilirse IRR/NPV gerçeğe yakın olur.",
    icon: Sun,
    effort: "~1 gün",
    highlights: [
      "İl/ilçe → enlem/boylam çevirimi",
      "PVGIS Europa API üzerinden saatlik üretim profili",
      "Aylık + yıllık üretim grafiği",
      "Fizibilite IRR/NPV otomatik güncellenir",
    ],
    href: "/mockups/pvgis",
  },
  {
    id: "yearly",
    code: "D6",
    title: "Yıllık Rapor PDF",
    subtitle: "Direktör + Patron — kurumsal özet",
    description:
      "Yıl sonunda otomatik (veya manuel) 'Firma Performans Raporu' PDF — yatırımcıya, bankaya, muhasebeciye verilir. Toplam ciro, win rate, segment, top projeler.",
    icon: FileText,
    effort: "~1.5 gün",
    highlights: [
      "Kapak: firma logosu + '2026 Yıllık Rapor'",
      "12 ay KPI özeti + trend",
      "Segment dağılımı (sektör/lokasyon)",
      "Top 10 proje + 3 kayıp + 3 kazanım",
      "Otomatik aylık takvim ile yılda 1 mail",
    ],
    href: "/mockups/yearly-report",
  },
  {
    id: "sidebar-alts",
    code: "UI",
    title: "Sidebar Renk Alternatifleri",
    subtitle: "Tasarım — mevcut karanlık sidebar yerine 5 farklı stil",
    description:
      "Mevcut sidebar (slate-900) çok koyu. 5 alternatif renk/stil yan yana: Light & Clean, Soft Gray, Mid Dark, Emerald Tinted, Hybrid (header+white). Beğeneni gerçek sidebar'a uygulayalım.",
    icon: Palette,
    effort: "30 dk",
    highlights: [
      "5 farklı palet — mini sidebar önizlemesi",
      "Aktif item state'i her tasarımda gösterilir",
      "Hover, group label, logout butonu hepsi render edilir",
      "Karar verdikten sonra ~30 dk'lık iş",
    ],
    href: "/mockups/sidebar-alts",
  },
];

export default async function MockupsIndexPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden border-amber-200 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
                  Önizleme · Henüz Gerçek Veri Yok
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Mockup Turu — Gelecek Özellikler
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  4 büyük özelliğin nasıl görüneceğini görmek için hazırlanmış
                  görsel önizlemeler. <strong>Veri sahte</strong>, sadece UI/UX karar
                  vermek için. Birine tıkla, beğendiklerini söyle — gerçek
                  implementasyona o zaman geçeriz.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Bu sayfalardaki rakamlar, projeler ve grafikler <strong>tamamen sahte</strong>;
                hesaplama yok, DB sorgusu yok. Sadece görüntü amaçlı.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 mockup */}
      <div className="grid gap-4 sm:grid-cols-2">
        {MOCKUPS.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.id} href={m.href} className="group">
              <Card className="h-full overflow-hidden border-slate-200 shadow-sm transition-all group-hover:border-emerald-300 group-hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {m.code}
                        </Badge>
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                          {m.effort}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold tracking-tight text-slate-900">
                        {m.title}
                      </h3>
                      <p className="text-[11.5px] text-slate-500">{m.subtitle}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600">
                    {m.description}
                  </p>

                  <ul className="mt-3 space-y-1">
                    {m.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-start gap-1.5 text-[11.5px] text-slate-700"
                      >
                        <ArrowRight className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-emerald-700 group-hover:text-emerald-800">
                    Önizlemeyi Aç <ArrowRight className="size-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
