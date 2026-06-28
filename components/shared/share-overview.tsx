import Link from "next/link";
import {
  Building2,
  Award,
  FileText,
  ListChecks,
  Receipt,
  BarChart3,
  ClipboardCheck,
  ArrowRight,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import { CUSTOMER_TAB_INFO } from "@/lib/share-tabs";

interface TabItem {
  id: string;
  label: string;
}

// İkon eşlemesi — etiket/açıklama merkezi CUSTOMER_TAB_INFO'dan gelir.
const TAB_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  firma: Building2,
  referanslar: Award,
  belgeler: FileText,
  teklif: Receipt,
  "boq-unpriced": ListChecks,
  "boq-priced": ListChecks,
  "priced-boq-summary": Receipt,
  "priced-boq-detailed": Receipt,
  "kesif-a": ListChecks,
  "kesif-b": ListChecks,
  analiz: BarChart3,
  dor: ClipboardCheck,
};

export function ShareOverview({
  firmName,
  customerName,
  projectName,
  accent,
  token,
  tabs,
}: {
  firmName: string;
  customerName: string;
  projectName: string;
  accent: string;
  token: string;
  tabs: TabItem[];
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Karşılama */}
      <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: `${accent}40` }}>
        <div className="px-6 py-7 text-white sm:px-8" style={{ backgroundColor: accent }}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-sm">
            <Sparkles className="size-3" /> Teklif
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {customerName ? `Sayın ${customerName},` : "Hoş geldiniz"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90 sm:text-[15px]">
            <strong>{firmName}</strong> olarak{projectName ? <> <strong>{projectName}</strong> için</> : null} sizin
            için hazırladığımız teklifi aşağıdaki bölümlerden inceleyebilirsiniz.
          </p>
        </div>
      </div>

      {/* İçindekiler — kartlar */}
      <div>
        <h2 className="mb-3 px-1 text-sm font-semibold text-slate-700">Bu teklifte neler var?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tabs.map((t) => {
            const info = CUSTOMER_TAB_INFO[t.id as keyof typeof CUSTOMER_TAB_INFO] ?? { label: t.label, desc: "" };
            const Icon = TAB_ICON[t.id] ?? FileText;
            return (
              <Link
                key={t.id}
                href={`/share/${token}/${t.id}`}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: accent }}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{info.label}</p>
                  {info.desc && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{info.desc}</p>}
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Yönlendirme */}
      <div
        className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
        style={{ borderColor: `${accent}40` }}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}1a`, color: accent }}>
          <ArrowDown className="size-5" />
        </div>
        <p className="text-[13px] leading-relaxed text-slate-600">
          Teklifi <strong className="text-slate-800">onaylamak</strong>, <strong className="text-slate-800">revizyon istemek</strong> veya{" "}
          <strong className="text-slate-800">soru sormak</strong> için sayfanın <strong className="text-slate-800">en altındaki</strong> butonları kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}
