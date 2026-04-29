import { createProject } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Sun, Zap, BarChart3, FileText, ArrowRight } from "lucide-react";

export default function NewProjectPage() {
  const steps = [
    { icon: FileText, label: "Proje Bilgileri", desc: "Müşteri ve konum bilgilerini girin" },
    { icon: Zap, label: "Teknik Parametreler", desc: "DC/AC güç, panel ve inverter ayarları" },
    { icon: BarChart3, label: "Fizibilite", desc: "Tüketim ve tasarruf analizi" },
    { icon: Sun, label: "Kesif & Analiz", desc: "EPC maliyet hesaplama ve teklif" },
  ];

  return (
    <div className="max-w-lg mx-auto mt-16 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 8px 24px rgba(245,158,11,0.4)" }}>
          <Sun className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Yeni Proje Oluştur</h1>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          Adım adım süreç ile profesyonel solar EPC teklifinizi hazırlayın
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border border-slate-200/70 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)" }}>
              <step.icon className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adım {i + 1}</span>
              </div>
              <p className="font-semibold text-slate-800 text-sm">{step.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <form action={createProject}>
        <Button type="submit" size="lg" className="w-full text-base">
          Projeyi Başlat <ArrowRight className="w-5 h-5" />
        </Button>
      </form>
      <p className="text-center text-xs text-slate-400 mt-4">Bilgileriniz otomatik kaydedilir</p>
    </div>
  );
}
