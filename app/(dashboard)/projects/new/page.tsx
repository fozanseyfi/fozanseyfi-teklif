import { createProject } from "@/app/actions/project";
import { createMaterialServiceProject } from "@/app/actions/quote";
import { Button } from "@/components/ui/button";
import { Sun, Package, ArrowRight, ClipboardList, BarChart3, FileDown } from "lucide-react";

export default function NewProjectPage() {
  return (
    <div className="mx-auto mt-12 max-w-3xl px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Yeni Teklif Oluştur</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ne tür bir teklif hazırlamak istersin?
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Anahtar Teslim Proje */}
        <div className="flex flex-col rounded-2xl border-2 border-primary/30 bg-emerald-50/40 p-6 shadow-sm">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sun className="size-7" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Anahtar Teslim Proje</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Tam GES EPC teklifi — teknik parametreler, keşif, nakit akış ve analiz.
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-[12px] text-muted-foreground">
            <li className="flex gap-1.5">
              <ClipboardList className="size-3.5 shrink-0 text-primary/70" />
              Teknik + Keşif-A/B + Timeline
            </li>
            <li className="flex gap-1.5">
              <BarChart3 className="size-3.5 shrink-0 text-primary/70" />
              Maliyet/kâr analizi + duyarlılık
            </li>
            <li className="flex gap-1.5">
              <FileDown className="size-3.5 shrink-0 text-primary/70" />
              BoQ / P-BoQ / DoR çıktıları
            </li>
          </ul>
          <form action={createProject} className="mt-6">
            <Button type="submit" size="lg" className="w-full">
              Anahtar Teslim Başlat <ArrowRight className="size-5" />
            </Button>
          </form>
        </div>

        {/* Malzeme & Hizmet Teklifi */}
        <div className="flex flex-col rounded-2xl border-2 border-info/30 bg-info-soft/20 p-6 shadow-sm">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-info text-info-foreground shadow-sm">
            <Package className="size-7" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Malzeme &amp; Hizmet</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Sade malzeme veya hizmet teklifi — proje gerektirmez, 1-2 sayfa PDF.
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-[12px] text-muted-foreground">
            <li className="flex gap-1.5">
              <ClipboardList className="size-3.5 shrink-0 text-info-soft-foreground/70" />
              Müşteri bilgileri
            </li>
            <li className="flex gap-1.5">
              <Package className="size-3.5 shrink-0 text-info-soft-foreground/70" />
              Kalem listesi (kod ile katalogdan)
            </li>
            <li className="flex gap-1.5">
              <FileDown className="size-3.5 shrink-0 text-info-soft-foreground/70" />
              Kâr/KDV ayarı + teklif PDF&apos;i
            </li>
          </ul>
          <form action={createMaterialServiceProject} className="mt-6">
            <Button type="submit" size="lg" variant="outline" className="w-full border-info/40 bg-white">
              Malzeme &amp; Hizmet Başlat <ArrowRight className="size-5" />
            </Button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Bilgileriniz otomatik kaydedilir
      </p>
    </div>
  );
}
