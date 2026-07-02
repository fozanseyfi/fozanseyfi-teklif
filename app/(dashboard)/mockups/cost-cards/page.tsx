import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";

/**
 * Mockup — Maliyet Kontrol proje kartı için 5 kurumsal tasarım alternatifi.
 * Tamamen sahte veri; sadece görünüm kararı için. Beğenilen tasarımı gerçek
 * cost-list-client.tsx CostCard bileşenine uygularız.
 */

function fmt(n: number): string {
  return Math.round(n).toLocaleString("tr-TR");
}

interface Sample {
  name: string;
  customer: string;
  status: "ACTIVE" | "DONE";
  sym: string;
  salesGross: number;
  costGross: number;
  vok: number;
  current: number;
  receivable: number;
  collectedPct: number;
  payableRemaining: number;
  lines: number;
}

const SAMPLES: Sample[] = [
  {
    name: "Çimsa Mersin GES Sahası",
    customer: "Çimsa Çimento San. A.Ş.",
    status: "ACTIVE",
    sym: "₺",
    salesGross: 12_450_000,
    costGross: 9_180_000,
    vok: 3_270_000,
    current: 1_850_000,
    receivable: 4_200_000,
    collectedPct: 66,
    payableRemaining: 640_000,
    lines: 42,
  },
  {
    name: "Konya OSB Çatı GES",
    customer: "Konya OSB Yönetimi",
    status: "DONE",
    sym: "₺",
    salesGross: 6_980_000,
    costGross: 7_240_000,
    vok: -260_000,
    current: -120_000,
    receivable: 0,
    collectedPct: 100,
    payableRemaining: 0,
    lines: 28,
  },
];

export default async function CostCardsMockupPage() {
  await requireAuth();

  const designs: { code: string; title: string; note: string; render: (s: Sample) => React.ReactNode }[] = [
    { code: "1", title: "Finansal Tablo (Ledger)", note: "Banka ekstresi disiplini — sol accent şerit, düzenli sayı tablosu.", render: (s) => <DesignLedger s={s} /> },
    { code: "2", title: "Kurumsal Koyu Başlık", note: "Koyu slate başlık bandı + beyaz gövde. Premium/yönetici hissi.", render: (s) => <DesignDarkHeader s={s} /> },
    { code: "3", title: "Metrik Izgara + İlerleme", note: "4 metrik ızgarası, VÖK vurgulu, altta tahsilat çubuğu. Modern SaaS.", render: (s) => <DesignMetricGrid s={s} /> },
    { code: "4", title: "Minimal Muhasebe", note: "Tek renk slate, ince çizgiler, sağda büyük tek VÖK. Sade kurumsal.", render: (s) => <DesignMinimal s={s} /> },
    { code: "5", title: "Durum Panosu", note: "Sola durum rayı, büyük VÖK, ikincil metrikler çip, tahsilat halkası.", render: (s) => <DesignStatusPanel s={s} /> },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/mockups" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Mockup Turu
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Maliyet Kartı — 5 Kurumsal Tasarım
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Her tasarım iki örnek projeyle gösteriliyor: biri <strong>kârlı/devam eden</strong>, biri{" "}
          <strong>zararlı/tamamlanmış</strong>. Beğendiğin numarayı söyle, gerçek karta uygulayalım. Veriler sahtedir.
        </p>
      </div>

      {designs.map((d) => (
        <section key={d.code} className="space-y-3">
          <div className="flex items-baseline gap-3 border-b pb-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              {d.code}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">{d.title}</h2>
              <p className="text-xs text-slate-500">{d.note}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {SAMPLES.map((s) => (
              <div key={s.name}>{d.render(s)}</div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusBadge({ status, tone = "default" }: { status: "ACTIVE" | "DONE"; tone?: "default" | "onDark" }) {
  const done = status === "DONE";
  if (tone === "onDark") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? "bg-white/15 text-white/90" : "bg-emerald-400/20 text-emerald-100"}`}>
        {done ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
        {done ? "Tamamlandı" : "Devam"}
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${done ? "border-slate-300 bg-slate-100 text-slate-600" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
      {done ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
      {done ? "Tamamlandı" : "Devam"}
    </span>
  );
}

// ————————————————————————————————————————————————————————————————
// 1) Finansal Tablo (Ledger)
// ————————————————————————————————————————————————————————————————
function DesignLedger({ s }: { s: Sample }) {
  const vokPos = s.vok >= 0;
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${vokPos ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500"}`}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{s.name}</p>
          <p className="truncate text-xs text-slate-500">{s.customer}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {[
            ["Satış (KDV dahil)", `${s.sym}${fmt(s.salesGross)}`, "text-slate-900"],
            ["Maliyet (KDV dahil)", `${s.sym}${fmt(s.costGross)}`, "text-slate-900"],
            ["İş Sonu VÖK", `${s.sym}${fmt(s.vok)}`, vokPos ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"],
            ["Kalan Alacak", `${s.sym}${fmt(s.receivable)}`, "text-amber-600"],
          ].map(([l, v, cls], i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2 text-[12px] uppercase tracking-wide text-slate-500">{l}</td>
              <td className={`px-4 py-2 text-right font-semibold tabular-nums ${cls}`}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><Package className="size-3" /> {s.lines} kalem</span>
        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">Detay <ArrowRight className="size-3" /></span>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// 2) Kurumsal Koyu Başlık
// ————————————————————————————————————————————————————————————————
function DesignDarkHeader({ s }: { s: Sample }) {
  const vokPos = s.vok >= 0;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{s.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-300">
              <Building2 className="size-3" /> {s.customer}
            </p>
          </div>
          <StatusBadge status={s.status} tone="onDark" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 text-sm">
        <Cell label="Satış (KDV dahil)" value={`${s.sym}${fmt(s.salesGross)}`} />
        <Cell label="Maliyet (KDV dahil)" value={`${s.sym}${fmt(s.costGross)}`} />
        <Cell label="İş Sonu VÖK" value={`${s.sym}${fmt(s.vok)}`} accent={vokPos ? "emerald" : "rose"} />
        <Cell label="Kalan Alacak" value={`${s.sym}${fmt(s.receivable)}`} accent="amber" />
      </div>
      <div className="px-4 pb-3">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>Tahsilat</span>
          <span>%{s.collectedPct}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${s.collectedPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "rose" | "amber" }) {
  const cls = accent === "emerald" ? "text-emerald-700" : accent === "rose" ? "text-rose-600" : accent === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`truncate font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// 3) Metrik Izgara + İlerleme
// ————————————————————————————————————————————————————————————————
function DesignMetricGrid({ s }: { s: Sample }) {
  const vokPos = s.vok >= 0;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{s.name}</p>
          <p className="truncate text-xs text-slate-500">{s.customer}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label="Satış" value={`${s.sym}${fmt(s.salesGross)}`} bg="bg-slate-50" />
        <Tile label="Maliyet" value={`${s.sym}${fmt(s.costGross)}`} bg="bg-slate-50" />
        <Tile label="İş Sonu VÖK" value={`${s.sym}${fmt(s.vok)}`} bg={vokPos ? "bg-emerald-50" : "bg-rose-50"} valueCls={vokPos ? "text-emerald-700" : "text-rose-600"} />
        <Tile label="Kalan Alacak" value={`${s.sym}${fmt(s.receivable)}`} bg="bg-amber-50" valueCls="text-amber-700" />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1"><Wallet className="size-3" /> Tahsilat ilerlemesi</span>
          <span className="font-semibold">%{s.collectedPct}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.collectedPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, bg, valueCls = "text-slate-900" }: { label: string; value: string; bg: string; valueCls?: string }) {
  return (
    <div className={`rounded-lg ${bg} px-3 py-2`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`truncate text-[15px] font-bold tabular-nums ${valueCls}`}>{value}</p>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// 4) Minimal Muhasebe
// ————————————————————————————————————————————————————————————————
function DesignMinimal({ s }: { s: Sample }) {
  const vokPos = s.vok >= 0;
  return (
    <div className="flex items-stretch gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-slate-900">{s.name}</p>
          <span className={`size-1.5 shrink-0 rounded-full ${s.status === "DONE" ? "bg-slate-400" : "bg-emerald-500"}`} />
        </div>
        <p className="truncate text-xs text-slate-500">{s.customer}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
          <MiniStat label="Satış" value={`${s.sym}${fmt(s.salesGross)}`} />
          <MiniStat label="Maliyet" value={`${s.sym}${fmt(s.costGross)}`} />
          <MiniStat label="Kalan Alacak" value={`${s.sym}${fmt(s.receivable)}`} />
          <MiniStat label="Kalem" value={`${s.lines}`} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center border-l border-slate-100 pl-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">İş Sonu VÖK</p>
        <p className={`text-xl font-bold tabular-nums ${vokPos ? "text-emerald-700" : "text-rose-600"}`}>
          {s.sym}{fmt(s.vok)}
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-400">anlık {s.sym}{fmt(s.current)}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-slate-600">
      <span className="text-slate-400">{label}: </span>
      <span className="font-semibold tabular-nums text-slate-800">{value}</span>
    </span>
  );
}

// ————————————————————————————————————————————————————————————————
// 5) Durum Panosu
// ————————————————————————————————————————————————————————————————
function DesignStatusPanel({ s }: { s: Sample }) {
  const vokPos = s.vok >= 0;
  const rail = s.status === "DONE" ? "bg-slate-400" : vokPos ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`w-1.5 shrink-0 ${rail}`} />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{s.name}</p>
            <p className="truncate text-xs text-slate-500">{s.customer}</p>
          </div>
          <StatusBadge status={s.status} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">İş Sonu VÖK</p>
            <p className={`flex items-center gap-1 text-2xl font-bold tabular-nums ${vokPos ? "text-emerald-700" : "text-rose-600"}`}>
              {vokPos ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
              {s.sym}{fmt(s.vok)}
            </p>
          </div>
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#10b981 ${s.collectedPct * 3.6}deg, #e2e8f0 0)` }}>
            <div className="flex size-11 flex-col items-center justify-center rounded-full bg-white">
              <span className="text-[11px] font-bold text-slate-700">%{s.collectedPct}</span>
              <span className="text-[7px] uppercase text-slate-400">tahsil</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip label="Satış" value={`${s.sym}${fmt(s.salesGross)}`} />
          <Chip label="Maliyet" value={`${s.sym}${fmt(s.costGross)}`} />
          <Chip label="Kalan Alacak" value={`${s.sym}${fmt(s.receivable)}`} tone="amber" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><Package className="size-3" /> {s.lines} kalem</span>
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">Aç <ChevronRight className="size-3" /></span>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  const cls = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] ${cls}`}>
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
