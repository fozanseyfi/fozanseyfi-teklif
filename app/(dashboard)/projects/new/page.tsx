import { createProject } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Sun, ClipboardList, BarChart3, FileDown, ArrowRight } from "lucide-react";

export default function NewProjectPage() {
  // Sidebar nav yapisi ile birebir: VERI GIRIS -> KARAR & AKIS -> CIKTILAR
  const steps = [
    {
      icon: ClipboardList,
      label: "Veri Girişi",
      bullets: [
        "Proje bilgileri (müşteri, il/ilçe, kurulum tipi)",
        "Teknik: DC/AC güç, panel & inverter modelleri",
        "Keşif-A (malzeme) + Keşif-B (iş kalemleri)",
        "Timeline: aylık nakit akış planı",
      ],
    },
    {
      icon: BarChart3,
      label: "Karar & Akış",
      bullets: [
        "Maliyet kalemlerini karda dağıt, marj kontrol et",
        "Sale price + duyarlılık senaryoları",
        "Aylık nakit akış grafiği ve kümülatif bakiye",
      ],
    },
    {
      icon: FileDown,
      label: "Çıktılar",
      bullets: [
        "BoQ — Malzeme ve fiyat listelerini çıktı al, müşteriyle incele",
        "Birim Fiyat Cetveli — Satış fiyatı esaslı kâr yüzdelerini istediğin kalemlere uygula",
        "DoR — Taraflar arası sorumluluk dağılımı",
      ],
    },
  ];

  return (
    <div className="mx-auto mt-16 max-w-lg px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sun className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Yeni Proje Oluştur
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Adım adım süreç ile profesyonel solar EPC teklifinizi hazırlayın
        </p>
      </div>

      {/* Steps */}
      <div className="mb-8 space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
              <step.icon className="size-5 text-primary-soft-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Adım {i + 1}
              </span>
              <p className="text-sm font-medium">{step.label}</p>
              <ul className="mt-1.5 space-y-0.5">
                {step.bullets.map((b, bi) => (
                  <li
                    key={bi}
                    className="flex gap-1.5 text-[11.5px] leading-snug text-muted-foreground"
                  >
                    <span className="text-primary/60">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <form action={createProject}>
        <Button type="submit" size="lg" className="w-full text-base">
          Projeyi Başlat <ArrowRight className="size-5" />
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Bilgileriniz otomatik kaydedilir
      </p>
    </div>
  );
}
