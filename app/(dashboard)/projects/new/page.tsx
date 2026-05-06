import { createProject } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Sun, Zap, BarChart3, FileText, ArrowRight } from "lucide-react";

export default function NewProjectPage() {
  const steps = [
    {
      icon: FileText,
      label: "Proje Bilgileri",
      desc: "Müşteri ve konum bilgilerini girin",
    },
    {
      icon: Zap,
      label: "Teknik Parametreler",
      desc: "DC/AC güç, panel ve inverter ayarları",
    },
    {
      icon: BarChart3,
      label: "Fizibilite",
      desc: "Tüketim ve tasarruf analizi",
    },
    {
      icon: Sun,
      label: "Keşif & Analiz",
      desc: "EPC maliyet hesaplama ve teklif",
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
            className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
              <step.icon className="size-5 text-primary-soft-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Adım {i + 1}
              </span>
              <p className="text-sm font-medium">{step.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
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
