"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutTemplate,
  Sparkles,
  TrendingUp,
  Zap,
  DollarSign,
  Eye,
  EyeOff,
  Lock,
  Activity,
  Sliders,
  ClipboardCheck,
  Layers,
  FileDown,
  CheckCircle2,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Mail,
  UserPlus,
  Shield,
  Check,
  Share2,
  Send,
  Link2,
  Clock,
  ChevronDown,
  Upload,
  FileSpreadsheet,
  QrCode,
  MessageCircle,
  Smartphone,
} from "lucide-react";

interface Slide {
  id: string;
  badge: string;
  kicker: string;
  title: string;
  body: React.ReactNode;
}

const SLIDES: Slide[] = [
  { id: "templates",  badge: "Hazır Şablonlar",        kicker: "01 — TEMPLATE",      title: "10 kWp'den 100 MWp'e fiyatlandırmayı unuttuğun kalem kalmasın", body: <TemplateDemo /> },
  { id: "margins",    badge: "Kar Marjı Kontrolü",     kicker: "02 — MARJLAR",       title: "Contingency, OHC ve Net Kâr'ı tek ekranda kaydır",               body: <MarginDemo /> },
  { id: "pboq-hide",  badge: "Birim Fiyat Cetveli",    kicker: "03 — P-BoQ",         title: "Müşteriye gönderilecek fiyatları gizle, kar otomatik dağılsın",   body: <HideDemo /> },
  { id: "boq-prices", badge: "Fiyatsız BoQ",           kicker: "04 — BoQ",           title: "Tek tıkla fiyat sütununu kapat, kapsam listesini paylaş",        body: <BoqDemo /> },
  { id: "critical",   badge: "Kritik Malzeme",         kicker: "05 — KRİTİK MALZEME", title: "Panel ve inverter alternatiflerini tek ekranda karşılaştır",     body: <CriticalDemo /> },
  { id: "cashflow",   badge: "Cash Flow Simülatörü",   kicker: "06 — CASH FLOW",     title: "Aylık nakit pozisyonu, kredi faizi ve toplam finans maliyeti",   body: <CashFlowDemo /> },
  { id: "ring",       badge: "Maliyet Halkası",        kicker: "07 — ANALİZ",        title: "Hangi grup ne kadar yüküm getiriyor — drill-down halka",         body: <RingDemo /> },
  { id: "dor",        badge: "Kapsam Tablosu (DoR)",   kicker: "08 — KAPSAM",        title: "Tedarik, Montaj ve Devreye Alma — kapsamı detayıyla paylaş",     body: <DorDemo /> },
  { id: "team",       badge: "Ekip & Yetkilendirme",   kicker: "09 — EKİP",          title: "E-postayla davet et, rol ata, kaynak erişimini kişi bazlı ayarla", body: <TeamDemo /> },
  { id: "share",      badge: "Paylaşım Linkleri",      kicker: "10 — PAYLAŞIM",      title: "E-posta ile teklif linki gönder, görüntülenmeyi izle",  body: <ShareDemo /> },
  { id: "import",     badge: "Excel'den Proje Yükle",  kicker: "11 — TOPLU İMPORT",  title: "Eski projelerini Excel'den sürükle-bırak, sayfa kolonları otomatik eşler", body: <ImportDemo /> },
  { id: "qrshare",    badge: "QR + WhatsApp Paylaş",   kicker: "12 — HIZLI PAYLAŞ",  title: "QR kod ile telefonda aç, tek tık WhatsApp veya mail",  body: <QrShareDemo /> },
];

export function LoginDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, [paused]);

  const prev = () => setActive((a) => (a - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setActive((a) => (a + 1) % SLIDES.length);

  return (
    <div
      className="relative isolate flex h-[600px] w-full flex-col gap-5 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 shadow-[0_24px_70px_-30px_rgb(15_23_42_/_0.25)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute -right-24 -top-32 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-info/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #0f172a 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Tab indicators + manual nav */}
      <div className="relative flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prev}
          className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft hover:text-primary-soft-foreground"
          aria-label="Önceki"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active
                  ? "w-7 bg-primary"
                  : "w-2 bg-foreground/15 hover:w-3 hover:bg-foreground/30",
              )}
              aria-label={`Slide ${i + 1}: ${s.badge}`}
            />
          ))}
        </div>
        <span className="rounded-full border border-primary/20 bg-primary-soft/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-soft-foreground">
          {String(active + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={next}
          className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft hover:text-primary-soft-foreground"
          aria-label="Sonraki"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div key={active} className="relative flex min-h-0 flex-1 flex-col gap-3 animate-in-up">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary-soft-foreground">
            {SLIDES[active].kicker}
          </p>
          <h3 className="mt-1.5 text-[1.3rem] font-bold leading-tight tracking-tight text-foreground">
            {SLIDES[active].title}
          </h3>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch">{SLIDES[active].body}</div>
      </div>

      <div className="relative grid grid-cols-4 gap-2 border-t border-foreground/5 pt-3">
        {[
          { icon: LayoutTemplate, label: "9 Şablon" },
          { icon: Sliders, label: "Akıllı Marj" },
          { icon: Activity, label: "Cash Flow" },
          { icon: FileDown, label: "PDF & Excel" },
        ].map((f) => (
          <div key={f.label} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/70 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm">
            <f.icon className="size-3 shrink-0 text-primary-soft-foreground" />
            <span className="truncate">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 01 — Templates ──────────────────────────────────────────────────── */

function TemplateDemo() {
  const items = [
    { label: "10 kWp", type: "Çatı", price: "$13k", per: "$1.30/Wp" },
    { label: "25 kWp", type: "Çatı", price: "$31k", per: "$1.24/Wp" },
    { label: "500 kWp", type: "Çatı", price: "$520k", per: "$1.04/Wp" },
    { label: "1 MWp", type: "Arazi", price: "$890k", per: "$0.89/Wp", featured: true },
    { label: "5 MWp", type: "Arazi", price: "$4.1M", per: "$0.82/Wp" },
    { label: "10 MWp", type: "Arazi", price: "$7.8M", per: "$0.78/Wp" },
    { label: "30 MWp", type: "Arazi", price: "$22M", per: "$0.74/Wp" },
    { label: "50 MWp", type: "Arazi", price: "$36M", per: "$0.72/Wp" },
    { label: "100 MWp", type: "Arazi", price: "$72M", per: "$0.72/Wp" },
  ];
  return (
    <div className="grid w-full grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className={cn(
            "relative rounded-xl border bg-white p-2.5 shadow-sm transition-transform hover:scale-[1.02]",
            it.featured
              ? "scale-[1.04] border-primary/40 shadow-[0_8px_30px_-12px_rgb(5_150_105_/_0.35)]"
              : "border-border/70",
          )}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="rounded-full border border-primary/20 bg-primary-soft/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary-soft-foreground">
              {it.label}
            </span>
            <Zap className="size-3 text-primary-soft-foreground/60" />
          </div>
          <p className="text-[10px] font-semibold text-foreground">{it.type} GES</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{it.price}</p>
          <p className="text-[9px] text-muted-foreground">{it.per}</p>
          {it.featured && (
            <div className="absolute -top-1.5 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
              ÖNERİ
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── 02 — Margin sliders, live KPI ───────────────────────────────────── */

const MARGIN_FRAMES = [
  { cont: 2.5, ohc: 5.0, net: 14.5, sale: 890_000, kar: 129_000 },
  { cont: 3.5, ohc: 6.5, net: 16.0, sale: 941_300, kar: 158_500 },
  { cont: 4.0, ohc: 4.0, net: 12.0, sale: 853_500, kar: 102_400 },
  { cont: 1.5, ohc: 7.5, net: 18.0, sale: 977_400, kar: 188_200 },
];

function MarginDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % MARGIN_FRAMES.length), 1900);
    return () => clearInterval(t);
  }, []);
  const f = MARGIN_FRAMES[step];
  const fmt$ = (n: number) => `$${(n / 1000).toFixed(0)}k`;

  const rows = [
    { label: "Contingency", color: "bg-primary",  trackBg: "bg-primary/15",  pct: f.cont, max: 10 },
    { label: "OHC",          color: "bg-info",     trackBg: "bg-info/15",     pct: f.ohc,  max: 20 },
    { label: "Net Kâr",      color: "bg-success",  trackBg: "bg-success/15",  pct: f.net,  max: 30 },
  ];
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sliders className="size-3.5" />
          Marj Slider'ları · canlı oynat
        </p>
        <div className="space-y-3">
          {rows.map((r) => {
            const left = `${(r.pct / r.max) * 100}%`;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] font-semibold text-foreground">
                  {r.label}
                </span>
                <div className={cn("relative h-2 flex-1 rounded-full", r.trackBg)}>
                  <div
                    className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out", r.color)}
                    style={{ width: left }}
                  />
                  <div
                    className={cn(
                      "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-all duration-700 ease-out",
                      r.color,
                    )}
                    style={{ left }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-foreground">
                  %{r.pct.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <KpiSwap label="Maliyet (A+B)" value="$640k" tone="muted" />
        <KpiSwap label="Brüt Kâr" value={fmt$(f.kar)} tone="success" pulse />
        <KpiSwap label="Satış" value={fmt$(f.sale)} tone="primary" pulse />
      </div>
    </div>
  );
}

function KpiSwap({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  tone: "muted" | "success" | "primary";
  pulse?: boolean;
}) {
  const T = {
    muted: "bg-muted text-foreground border-foreground/5",
    success: "bg-success-soft text-success-soft-foreground border-success/30",
    primary: "bg-primary-soft text-primary-soft-foreground border-primary/30",
  };
  return (
    <div className={cn("relative overflow-hidden rounded-xl border px-3 py-2 shadow-sm transition-all", T[tone])}>
      {pulse && (
        <div className="pointer-events-none absolute inset-0 animate-pulse-soft bg-primary/5" aria-hidden="true" />
      )}
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p
        key={value}
        className="mt-0.5 text-base font-bold tabular-nums animate-in-up"
        style={{ animationDuration: "350ms" }}
      >
        {value}
      </p>
    </div>
  );
}

/* ─── 03 — Hide/Show row in P-BoQ ─────────────────────────────────────── */

function HideDemo() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setHidden((h) => !h), 2400);
    return () => clearInterval(t);
  }, []);

  const base = [
    { code: "A.1.1", name: "PV Panel 625 Wp",   price: 320_000 },
    { code: "A.2.1", name: "İnverter 250 kVA",  price: 78_500 },
    { code: "A.4.1", name: "DC Kablo 6 mm²",    price: 42_300, hideTarget: true },
    { code: "A.6.5", name: "Konstrüksiyon",     price: 165_000 },
  ];
  const baseTotal = 605_800;
  const hiddenAmt = 42_300;
  const visibleBase = baseTotal - hiddenAmt;
  // Karşılaştırmada toplam SATIŞ aynı kalır (605,800), gizlenen kalemin payı
  // diğer 3 kaleme maliyet oranında dağıtılır.
  const factor = baseTotal / visibleBase;

  const fmt$ = (n: number) => `$${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> Birim Fiyat Cetveli — düzenle
          </span>
          <span className="rounded-full bg-primary-soft/60 px-2 py-0.5 font-mono text-[9px] text-primary-soft-foreground">
            Toplam · $605,800
          </span>
        </div>
        <div className="divide-y">
          {base.map((r) => {
            const isHiddenRow = !!r.hideTarget && hidden;
            const displayed =
              r.hideTarget
                ? hidden ? 0 : r.price
                : hidden ? r.price * factor : r.price;
            return (
              <div
                key={r.code}
                className={cn(
                  "flex items-center gap-2 py-1.5 text-xs transition-all duration-500",
                  isHiddenRow && "opacity-40",
                )}
              >
                <span className="w-14 font-mono text-[10px] text-muted-foreground">{r.code}</span>
                <span className={cn("flex-1 truncate text-foreground", isHiddenRow && "line-through")}>
                  {r.name}
                </span>
                <span
                  key={`${r.code}-${displayed}`}
                  className={cn(
                    "font-bold tabular-nums tracking-tight transition-colors animate-in-up",
                    isHiddenRow ? "text-muted-foreground/60 line-through" : "text-foreground",
                    !r.hideTarget && hidden && "text-success-soft-foreground",
                  )}
                  style={{ animationDuration: "350ms" }}
                >
                  {fmt$(displayed)}
                </span>
                {r.hideTarget ? (
                  <RowToggle hidden={hidden} />
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-semibold text-success-soft-foreground">
                    <Eye className="size-2.5" /> Görünür
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-info-soft/50 px-2.5 py-1.5 text-[10px] text-info-soft-foreground">
          <span>Gizlenen kalemin payı diğerlerine pro-rata dağıtılır.</span>
          <span className="font-mono font-bold text-foreground">
            Genel Toplam · $605,800
          </span>
        </div>
      </div>
    </div>
  );
}

function RowToggle({ hidden }: { hidden: boolean }) {
  return (
    <span className="relative inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
      <span
        className={cn(
          "relative inline-block h-3.5 w-7 rounded-full transition-colors",
          hidden ? "bg-slate-400" : "bg-primary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-2.5 rounded-full bg-white shadow-sm transition-all duration-300",
            hidden ? "left-0.5" : "left-3.5",
          )}
        />
      </span>
      {hidden ? (
        <EyeOff className="size-2.5 text-muted-foreground" />
      ) : (
        <Eye className="size-2.5 text-primary-soft-foreground" />
      )}
    </span>
  );
}

function ToggleAnim() {
  return (
    <span className="relative inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
      <span
        className="relative inline-block h-3.5 w-7 rounded-full"
        style={{ animation: "demo-toggle 3.5s ease-in-out infinite" }}
      >
        <span
          className="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-white shadow-sm"
          style={{ animation: "demo-toggle-knob 3.5s ease-in-out infinite" }}
        />
      </span>
      <EyeOff className="size-2.5 text-muted-foreground" />
    </span>
  );
}

/* ─── 04 — BoQ price toggle ───────────────────────────────────────────── */

function BoqDemo() {
  const rows = [
    { code: "A.1.1", name: "Panel 625 Wp", qty: "1,920", unit: "Ad.", price: "$320,000" },
    { code: "A.2.1", name: "İnverter 250 kVA", qty: "5", unit: "Ad.", price: "$78,500" },
    { code: "A.3.1", name: "Konstrüksiyon", qty: "1,150", unit: "kWp", price: "$165,000" },
    { code: "A.4.5", name: "DC Kablo 6 mm²", qty: "12,400", unit: "m", price: "$42,300" },
  ];
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-white p-2.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
          <ArrowDownUp className="size-3.5 text-primary" />
          Fiyatları gizle/aç
        </div>
        <div className="flex items-center gap-2">
          <ToggleAnim />
          <span className="rounded-md border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <FileDown className="mr-0.5 inline size-2.5" /> PDF
          </span>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid grid-cols-[60px_1fr_70px_50px_90px] bg-muted/60 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Kod</span>
          <span>Tanım</span>
          <span className="text-right">Miktar</span>
          <span>Birim</span>
          <span className="text-right">Tutar</span>
        </div>
        <div className="divide-y">
          {rows.map((r, i) => (
            <div key={r.code} className="grid grid-cols-[60px_1fr_70px_50px_90px] items-center px-2.5 py-1.5 text-[11px]">
              <span className="font-mono text-[10px] text-muted-foreground">{r.code}</span>
              <span className="truncate text-foreground">{r.name}</span>
              <span className="text-right tabular-nums text-foreground">{r.qty}</span>
              <span className="text-muted-foreground">{r.unit}</span>
              <span
                className="text-right font-bold tabular-nums text-foreground"
                style={{
                  animation: "demo-fade-row 4s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                {r.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── 05 — Critical Material with cursor + dynamic KPI ────────────────── */

const CRITICAL_GROUPS = [
  {
    label: "Panel",
    alts: [
      { brand: "Jinko",    model: "625W Bifacial",  spec: "$0.092/Wp", sale: 890_000 },
      { brand: "Trina",    model: "Vertex S+ 600W", spec: "$0.087/Wp", sale: 880_400 },
      { brand: "JA Solar", model: "DeepBlue 615W",  spec: "$0.095/Wp", sale: 895_700 },
    ],
  },
  {
    label: "İnverter",
    alts: [
      { brand: "Huawei",  model: "SUN2000-250HX",  spec: "250 kVA", sale: 890_000 },
      { brand: "Sungrow", model: "SG250HX",         spec: "250 kVA", sale: 885_800 },
      { brand: "Goodwe",  model: "HT 250kW",        spec: "250 kVA", sale: 893_100 },
    ],
  },
  {
    label: "Konstrüksiyon",
    alts: [
      { brand: "Schletter", model: "PvMax Roof",    spec: "$185/kW", sale: 890_000 },
      { brand: "Krinner",   model: "Ground Screw",  spec: "$172/kW", sale: 883_800 },
      { brand: "K2 Systems", model: "TerraGrid",    spec: "$192/kW", sale: 894_400 },
    ],
  },
] as const;

const ALT_TONES = [
  "border-primary/40 bg-primary-soft text-primary-soft-foreground",
  "border-info/30 bg-info-soft text-info-soft-foreground",
  "border-success/30 bg-success-soft text-success-soft-foreground",
];

function CriticalDemo() {
  const [sel, setSel] = useState<[number, number, number]>([0, 1, 2]);
  useEffect(() => {
    const t = setInterval(() => {
      setSel((prev) => {
        const next: [number, number, number] = [...prev];
        const which = (Date.now() / 2400) % 3 | 0;
        next[which] = (next[which] + 1) % 3;
        return next;
      });
    }, 2400);
    return () => clearInterval(t);
  }, []);

  const totalSale = sel.reduce((s, i, idx) => s + CRITICAL_GROUPS[idx].alts[i].sale, 0) / 3;
  const kar = totalSale * 0.145;
  const fmt$ = (n: number) => `$${Math.round(n / 1000)}k`;

  return (
    <div className="flex w-full flex-col gap-2.5">
      {CRITICAL_GROUPS.map((g, gi) => {
        const a = g.alts[sel[gi]];
        return (
          <div
            key={g.label}
            className="rounded-xl border bg-white p-2.5 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Layers className="size-3 text-primary-soft-foreground" />
                {g.label}
              </p>
              <p
                key={a.brand}
                className="text-[10px] font-mono tabular-nums text-muted-foreground animate-in-up"
                style={{ animationDuration: "350ms" }}
              >
                {a.spec}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {g.alts.map((alt, i) => (
                <div
                  key={alt.brand}
                  className={cn(
                    "relative rounded-lg border px-2 py-2 text-center shadow-sm transition-all duration-500",
                    ALT_TONES[i],
                    i === sel[gi]
                      ? "scale-[1.04] ring-2 ring-primary/40"
                      : "opacity-50",
                  )}
                >
                  <p className="text-[10px] font-bold leading-tight">{alt.brand}</p>
                  <p className="mt-0.5 truncate text-[9px] opacity-80">{alt.model}</p>
                  {i === sel[gi] && (
                    <CheckCircle2 className="absolute -right-1 -top-1 size-3.5 rounded-full bg-white text-primary shadow-sm" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-3 gap-2">
        <KpiSwap label="Sale" value={fmt$(totalSale)} tone="primary" pulse />
        <KpiSwap label="Brüt Kâr" value={fmt$(kar)} tone="success" pulse />
        <KpiSwap label="USD/Wp" value={`$${(totalSale / 1_000_000).toFixed(3)}`} tone="muted" />
      </div>
    </div>
  );
}

/* ─── 06 — Cash Flow ──────────────────────────────────────────────────── */

const CF_FRAMES = [
  { rate: 12, faiz: "$6.4k", credit: "$185k" },
  { rate: 15, faiz: "$8.2k", credit: "$215k" },
  { rate: 18, faiz: "$10.1k", credit: "$248k" },
];

function CashFlowDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % CF_FRAMES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const f = CF_FRAMES[step];

  // Aylık giriş / çıkış (000 USD) ve kümülatif pozisyon
  const inflow =  [30,  8, 25, 20, 18, 12,  6,  4,  4,  3,  2,  2];
  const outflow = [18, 25, 22, 15,  8,  4,  3,  3,  2,  2,  1,  1];
  const cum: number[] = [];
  inflow.reduce((acc, v, i) => {
    const next = acc + v - outflow[i];
    cum.push(next);
    return next;
  }, 0);

  const W = 320;
  const H = 110;
  const minY = Math.min(...cum, 0);
  const maxY = Math.max(...cum, 0);
  const yScale = (v: number) => H - 5 - ((v - minY) / (maxY - minY || 1)) * (H - 10);
  const xScale = (i: number) => (i / (cum.length - 1)) * W;
  const pathD = cum
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(" ");
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`;
  const zeroY = yScale(0);
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

  // Yatay arka plan barlari icin scale
  const barMax = Math.max(...inflow, ...outflow);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <KpiSwap label="Toplam Giriş" value="$890k" tone="primary" />
        <KpiSwap label="Maks. Kredi" value={f.credit} tone="muted" pulse />
        <KpiSwap label="Faiz Maliyeti" value={f.faiz} tone="success" pulse />
      </div>
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Kümülatif Nakit Pozisyonu (000 USD)</span>
          <span
            key={f.rate}
            className="rounded-full bg-warning-soft/60 px-2 py-0.5 font-mono text-[9px] text-warning-soft-foreground animate-in-up"
          >
            Yıllık Kredi Faizi · %{f.rate}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 16}`} className="h-32 w-full">
          <defs>
            <linearGradient id="cf-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cf-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <filter id="cf-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Yatay grid */}
          {[0.25, 0.5, 0.75].map((p) => (
            <line
              key={p}
              x1="0"
              x2={W}
              y1={H * p}
              y2={H * p}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
          ))}
          {/* Inflow / Outflow arka plan barlari */}
          {inflow.map((v, i) => {
            const cx = xScale(i);
            const inH = (v / barMax) * 22;
            const outH = (outflow[i] / barMax) * 22;
            return (
              <g key={i}>
                <rect
                  x={cx - 5}
                  y={zeroY - inH}
                  width="3.5"
                  height={inH}
                  rx="1"
                  fill="#10b981"
                  opacity="0.35"
                  style={{
                    animation: "demo-bar-grow 3s ease-in-out infinite",
                    animationDelay: `${i * 0.07}s`,
                    transformOrigin: `${cx}px ${zeroY}px`,
                  }}
                />
                <rect
                  x={cx + 1.5}
                  y={zeroY}
                  width="3.5"
                  height={outH}
                  rx="1"
                  fill="#dc2626"
                  opacity="0.35"
                  style={{
                    animation: "demo-bar-grow 3s ease-in-out infinite",
                    animationDelay: `${i * 0.07 + 0.25}s`,
                    transformOrigin: `${cx}px ${zeroY}px`,
                  }}
                />
              </g>
            );
          })}
          {/* Sıfır referans çizgisi */}
          <line
            x1="0"
            x2={W}
            y1={zeroY}
            y2={zeroY}
            stroke="#cbd5e1"
            strokeDasharray="4 3"
            strokeWidth="1"
          />
          {/* Filled area */}
          <path d={areaD} fill="url(#cf-area)" />
          {/* Drawn line — gradient + glow */}
          <path
            id="cumLine"
            d={pathD}
            fill="none"
            stroke="url(#cf-line)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="900"
            filter="url(#cf-glow)"
            style={{ animation: "demo-line-draw 5s ease-in-out infinite" }}
          />
          {/* Sabit data points */}
          {cum.map((v, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(v)}
              r="2.2"
              fill="#059669"
              stroke="white"
              strokeWidth="1.2"
              opacity="0.9"
            />
          ))}
          {/* Hareketli izleyici nokta — eğri boyunca gezer */}
          <circle r="5" fill="#059669" stroke="white" strokeWidth="2.5" filter="url(#cf-glow)">
            <animateMotion dur="5s" repeatCount="indefinite" rotate="auto">
              <mpath href="#cumLine" />
            </animateMotion>
          </circle>
          <circle r="9" fill="#059669" opacity="0.25">
            <animateMotion dur="5s" repeatCount="indefinite">
              <mpath href="#cumLine" />
            </animateMotion>
            <animate
              attributeName="r"
              values="6;12;6"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>
          {/* Ay etiketleri */}
          {months.map((m, i) => (
            <text
              key={i}
              x={xScale(i)}
              y={H + 12}
              fontSize="7"
              textAnchor="middle"
              fill="#94a3b8"
              fontWeight="600"
            >
              {m.charAt(0)}
            </text>
          ))}
        </svg>
        <div className="mt-1 flex items-center justify-between gap-3 text-[9.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-500/70" />
            Aylık Giriş
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-red-500/70" />
            Aylık Çıkış
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-700" />
            Kümülatif
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── 07 — Cost Ring with animated highlight ──────────────────────────── */

const RING_SEGS = [
  { label: "A.1 Panel",        pct: 36, color: "#059669" },
  { label: "A.2 İnverter",     pct: 9,  color: "#10b981" },
  { label: "A.3 Konstrüksiyon", pct: 18, color: "#34d399" },
  { label: "A.4 Kablo",        pct: 7,  color: "#6ee7b7" },
  { label: "A.5–A.18 Diğer",   pct: 12, color: "#a7f3d0" },
  { label: "B Toplam",         pct: 18, color: "#3b82f6" },
];

function RingDemo() {
  const [hi, setHi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHi((h) => (h + 1) % RING_SEGS.length), 1700);
    return () => clearInterval(t);
  }, []);

  let acc = 0;
  return (
    <div className="grid w-full grid-cols-[1fr_auto] items-center gap-4">
      <div className="space-y-1">
        {RING_SEGS.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] transition-all",
              i === hi ? "bg-primary-soft/50 ring-1 ring-primary/30" : "",
            )}
          >
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 truncate text-foreground">{s.label}</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              %{s.pct}
            </span>
          </div>
        ))}
      </div>
      <div className="relative">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <g transform="translate(85 85)">
            {RING_SEGS.map((s, i) => {
              const start = (acc / 100) * Math.PI * 2 - Math.PI / 2;
              acc += s.pct;
              const end = (acc / 100) * Math.PI * 2 - Math.PI / 2;
              const r1 = 52, r2 = 75;
              const expand = i === hi ? 5 : 0;
              const r2e = r2 + expand;
              const large = end - start > Math.PI ? 1 : 0;
              const x1 = Math.cos(start) * r2e, y1 = Math.sin(start) * r2e;
              const x2 = Math.cos(end) * r2e,   y2 = Math.sin(end) * r2e;
              const x3 = Math.cos(end) * r1,    y3 = Math.sin(end) * r1;
              const x4 = Math.cos(start) * r1,  y4 = Math.sin(start) * r1;
              return (
                <path
                  key={s.label}
                  d={`M ${x1} ${y1} A ${r2e} ${r2e} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`}
                  fill={s.color}
                  stroke="white"
                  strokeWidth="1.5"
                  opacity={i === hi ? 1 : 0.55}
                  style={{ transition: "opacity 400ms ease, d 400ms ease" }}
                />
              );
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground">
            {RING_SEGS[hi].label}
          </p>
          <p key={hi} className="text-base font-bold tabular-nums text-foreground animate-in-up" style={{ animationDuration: "350ms" }}>
            %{RING_SEGS[hi].pct}
          </p>
          <p className="text-[8px] text-muted-foreground">$640k toplam</p>
        </div>
      </div>
    </div>
  );
}

/* ─── 08 — DoR (Kapsam) — 3 columns + animated role ───────────────────── */

const ROLE_CYCLE = ["Yüklenici", "İşveren", "Paylaşımlı"] as const;
const ROLE_TONE: Record<string, string> = {
  "Yüklenici": "bg-success-soft text-success-soft-foreground border-success/30",
  "İşveren":   "bg-info-soft text-info-soft-foreground border-info/30",
  "Paylaşımlı": "bg-warning-soft text-warning-soft-foreground border-warning/30",
  "—":          "bg-muted/50 text-muted-foreground border-border/40",
};

const DOR_ROWS: { sec: string; desc: string; t: string; m: string; d: string; flex?: boolean }[] = [
  { sec: "1.1", desc: "Sözleşme damga vergisi",          t: "Paylaşımlı", m: "—",        d: "—" },
  { sec: "1.4", desc: "ÇED Raporu",                       t: "İşveren",    m: "—",        d: "—" },
  { sec: "1.7", desc: "İmar ve İnşaat İzinleri",          t: "İşveren",    m: "—",        d: "—" },
  { sec: "2.1", desc: "Personel Ücretleri",               t: "Yüklenici",  m: "Yüklenici", d: "—", flex: true },
  { sec: "2.3", desc: "Personel yemek giderleri",         t: "Yüklenici",  m: "Yüklenici", d: "—" },
  { sec: "3.4", desc: "Şantiye sahası temizliği",         t: "Yüklenici",  m: "Yüklenici", d: "—" },
  { sec: "3.6", desc: "Şantiye elektrik enerjisi",        t: "Yüklenici",  m: "Yüklenici", d: "—" },
  { sec: "5.1", desc: "All Risk Sigortası",               t: "Yüklenici",  m: "—",        d: "—" },
  { sec: "5.2", desc: "Mali Mesuliyet Sigortası",         t: "Yüklenici",  m: "—",        d: "—" },
  { sec: "7.3", desc: "Test & Devreye Alma",              t: "Yüklenici",  m: "Yüklenici", d: "Yüklenici" },
];

function DorDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % ROLE_CYCLE.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex w-full min-h-0 flex-col">
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ClipboardCheck className="size-3.5" /> Division of Responsibility
          </span>
          <span className="rounded-full bg-primary-soft/60 px-2 py-0.5 font-mono text-[9px] text-primary-soft-foreground">
            48 madde · 12 başlık
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[40px_1fr_84px_84px_84px] bg-muted/60 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>#</span>
            <span>Madde</span>
            <span className="text-center">Tedarik</span>
            <span className="text-center">Montaj</span>
            <span className="text-center">Devreye Alma</span>
          </div>
          <div className="divide-y">
            {DOR_ROWS.map((r) => {
              const tedarik = r.flex ? ROLE_CYCLE[step] : r.t;
              return (
                <div
                  key={r.sec}
                  className="grid grid-cols-[40px_1fr_84px_84px_84px] items-center gap-1 px-2 py-1.5 text-[10.5px]"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{r.sec}</span>
                  <span className="truncate text-foreground">{r.desc}</span>
                  <RolePill value={tedarik} animated={r.flex} />
                  <RolePill value={r.m} />
                  <RolePill value={r.d} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RolePill({ value, animated }: { value: string; animated?: boolean }) {
  return (
    <span
      key={animated ? value : undefined}
      className={cn(
        "mx-auto inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all",
        ROLE_TONE[value] ?? ROLE_TONE["—"],
        animated && "animate-in-up",
      )}
      style={animated ? { animationDuration: "350ms" } : undefined}
    >
      {value}
    </span>
  );
}

/* ─── 09 — Team Invite & Role Management ──────────────────────────────── */

type TeamRole = "Yönetici" | "Kullanıcı" | "Görüntüleyici";
type AccessLevel = "Tam" | "Salt" | "Gizli";

const TEAM_ROLE_TONE: Record<TeamRole, string> = {
  Yönetici: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Kullanıcı: "border-blue-200 bg-blue-50 text-blue-700",
  Görüntüleyici: "border-slate-200 bg-slate-50 text-slate-600",
};

const ACCESS_TONE: Record<AccessLevel, string> = {
  Tam: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Salt: "border-amber-200 bg-amber-50 text-amber-700",
  Gizli: "border-rose-200 bg-rose-50 text-rose-600",
};

interface TeamMember {
  initials: string;
  name: string;
  email: string;
  role: TeamRole;
  access: AccessLevel;
  isNew?: boolean;
}

// 4 frame'lik animasyon: davet yazılıyor → gönderildi → kullanıcı katıldı →
// rol/erişim güncellendi.
const TEAM_FRAMES: {
  emailTyped: string;
  selectedRole: TeamRole;
  inviteSent: boolean;
  members: TeamMember[];
  highlightRoleChange?: boolean;
}[] = [
  // Frame 0: Form boş, ekipte 2 kişi
  {
    emailTyped: "",
    selectedRole: "Kullanıcı",
    inviteSent: false,
    members: [
      { initials: "MA", name: "Mehmet A.", email: "mehmet@…", role: "Yönetici", access: "Tam" },
      { initials: "AS", name: "Ayşe S.",   email: "ayse@…",   role: "Kullanıcı", access: "Tam" },
    ],
  },
  // Frame 1: E-posta yazılıyor, rol seçildi
  {
    emailTyped: "ozan@firma.com",
    selectedRole: "Görüntüleyici",
    inviteSent: false,
    members: [
      { initials: "MA", name: "Mehmet A.", email: "mehmet@…", role: "Yönetici", access: "Tam" },
      { initials: "AS", name: "Ayşe S.",   email: "ayse@…",   role: "Kullanıcı", access: "Tam" },
    ],
  },
  // Frame 2: Davet gönderildi, yeni üye listede
  {
    emailTyped: "",
    selectedRole: "Kullanıcı",
    inviteSent: true,
    members: [
      { initials: "MA", name: "Mehmet A.", email: "mehmet@…", role: "Yönetici", access: "Tam" },
      { initials: "AS", name: "Ayşe S.",   email: "ayse@…",   role: "Kullanıcı", access: "Tam" },
      { initials: "OZ", name: "Ozan F.",   email: "ozan@…",   role: "Görüntüleyici", access: "Tam", isNew: true },
    ],
  },
  // Frame 3: Yeni üyenin erişimi 1 projede "Salt" yapıldı
  {
    emailTyped: "",
    selectedRole: "Kullanıcı",
    inviteSent: false,
    members: [
      { initials: "MA", name: "Mehmet A.", email: "mehmet@…", role: "Yönetici", access: "Tam" },
      { initials: "AS", name: "Ayşe S.",   email: "ayse@…",   role: "Kullanıcı", access: "Tam" },
      { initials: "OZ", name: "Ozan F.",   email: "ozan@…",   role: "Görüntüleyici", access: "Salt" },
    ],
    highlightRoleChange: true,
  },
];

function TeamDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % TEAM_FRAMES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const f = TEAM_FRAMES[step];

  return (
    <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {/* ── Sol: Davet formu ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <UserPlus className="size-3.5" />
          Yeni kullanıcı davet et
        </p>

        {/* E-posta input — caret efekti */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            E-posta
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-[12px] font-medium text-slate-700">
            <Mail className="size-3.5 text-slate-400" />
            <span className="font-mono text-[12px] tabular-nums">
              {f.emailTyped || (
                <span className="text-slate-400">davet@firma.com</span>
              )}
            </span>
            {step === 1 && (
              <span className="ml-0.5 inline-block h-3 w-[1.5px] animate-pulse bg-slate-700" />
            )}
          </div>
        </div>

        {/* Rol seçici */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Rol
          </p>
          <div className="grid grid-cols-3 gap-1">
            {(["Yönetici", "Kullanıcı", "Görüntüleyici"] as TeamRole[]).map((r) => {
              const isSel = f.selectedRole === r;
              return (
                <div
                  key={r}
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-center text-[10px] font-semibold transition-all",
                    isSel
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500",
                  )}
                >
                  <Shield
                    className={cn(
                      "mx-auto mb-0.5 size-3",
                      isSel ? "text-emerald-600" : "text-slate-400",
                    )}
                  />
                  {r}
                </div>
              );
            })}
          </div>
        </div>

        {/* Davet gönder butonu — pulse efekti */}
        <button
          type="button"
          className={cn(
            "mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all",
            f.inviteSent
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
          )}
          tabIndex={-1}
        >
          {f.inviteSent ? (
            <>
              <Check className="size-3.5" />
              Davet gönderildi
            </>
          ) : (
            <>
              <Mail className="size-3.5" />
              Davet Gönder
            </>
          )}
        </button>
      </div>

      {/* ── Sağ: Ekip listesi ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ClipboardCheck className="size-3.5" />
            Ekip ({f.members.length})
          </p>
          <span className="text-[10px] text-slate-400">Erişim: bir proje</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {f.members.map((m, i) => (
            <div
              key={m.email}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all",
                m.isNew
                  ? "border-emerald-300 bg-emerald-50/60 animate-in-up"
                  : "border-slate-200 bg-white",
                f.highlightRoleChange && i === f.members.length - 1
                  ? "border-amber-300 bg-amber-50/40"
                  : "",
              )}
              style={m.isNew ? { animationDuration: "400ms" } : undefined}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  m.role === "Yönetici"
                    ? "bg-emerald-600 text-white"
                    : m.role === "Kullanıcı"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-400 text-white",
                )}
              >
                {m.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[11.5px] font-semibold text-slate-900">
                    {m.name}
                  </p>
                  {m.isNew && (
                    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-1.5 py-0 text-[8.5px] font-bold uppercase tracking-wider text-emerald-700">
                      Yeni
                    </span>
                  )}
                </div>
                <p className="truncate font-mono text-[9.5px] text-slate-400">
                  {m.email}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-semibold",
                  TEAM_ROLE_TONE[m.role],
                )}
              >
                {m.role}
              </span>
              <span
                key={`${m.email}-${m.access}`}
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-semibold transition-all",
                  ACCESS_TONE[m.access],
                  f.highlightRoleChange && i === f.members.length - 1 && "animate-in-up",
                )}
                style={
                  f.highlightRoleChange && i === f.members.length - 1
                    ? { animationDuration: "350ms" }
                    : undefined
                }
              >
                {m.access === "Tam" ? (
                  <Check className="inline size-2.5" />
                ) : m.access === "Salt" ? (
                  <Lock className="inline size-2.5" />
                ) : (
                  <EyeOff className="inline size-2.5" />
                )}{" "}
                {m.access}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-auto pt-1 text-[10px] leading-snug text-slate-500">
          Roller ve proje-bazlı erişim seviyeleri tek tıkla değişir; davet
          edilen kullanıcı kendi panelini de korur.
        </p>
      </div>
    </div>
  );
}

/* ─── 10 — Public Share Link & E-mail ────────────────────────────────── */

// 4 frame'lik animasyon: proje seçildi → e-posta yazılıyor → tab'ler
// işaretli, "Link Oluştur" pulse → mail gönderildi, sağda müşteri postası
// + görüntülenme sayacı.
type ShareTabId = "kesif-a" | "boq" | "p-boq" | "analiz" | "dor";

interface ShareTabDot {
  id: ShareTabId;
  label: string;
  checked: boolean;
}

const SHARE_FRAMES: {
  projectPicked: boolean;
  projectLabel: string;
  emailTyped: string;
  tabs: ShareTabDot[];
  buttonPulse: boolean;
  buttonSent: boolean;
  emailOpen: boolean;
  viewCount: number;
}[] = [
  // Frame 0: form boş, sağ taraf gri "Henüz link yok"
  {
    projectPicked: false,
    projectLabel: "Proje seç…",
    emailTyped: "",
    tabs: [
      { id: "kesif-a", label: "Keşif-A", checked: false },
      { id: "boq",     label: "Fiyatsız BoQ", checked: false },
      { id: "p-boq",   label: "Özet P-BoQ",  checked: false },
      { id: "analiz",  label: "Analiz",      checked: false },
      { id: "dor",     label: "DoR",         checked: false },
    ],
    buttonPulse: false,
    buttonSent: false,
    emailOpen: false,
    viewCount: 0,
  },
  // Frame 1: proje seçildi + e-posta yazılıyor (caret)
  {
    projectPicked: true,
    projectLabel: "Örnek-1 GES",
    emailTyped: "satinalma@firma.com",
    tabs: [
      { id: "kesif-a", label: "Keşif-A", checked: true },
      { id: "boq",     label: "Fiyatsız BoQ", checked: true },
      { id: "p-boq",   label: "Özet P-BoQ",  checked: false },
      { id: "analiz",  label: "Analiz",      checked: false },
      { id: "dor",     label: "DoR",         checked: false },
    ],
    buttonPulse: false,
    buttonSent: false,
    emailOpen: false,
    viewCount: 0,
  },
  // Frame 2: tab'ler işaretli, "Link Oluştur" butonu pulse
  {
    projectPicked: true,
    projectLabel: "Örnek-1 GES",
    emailTyped: "satinalma@firma.com",
    tabs: [
      { id: "kesif-a", label: "Keşif-A", checked: true },
      { id: "boq",     label: "Fiyatsız BoQ", checked: true },
      { id: "p-boq",   label: "Özet P-BoQ",  checked: true },
      { id: "analiz",  label: "Analiz",      checked: false },
      { id: "dor",     label: "DoR",         checked: true },
    ],
    buttonPulse: true,
    buttonSent: false,
    emailOpen: false,
    viewCount: 0,
  },
  // Frame 3: link gönderildi, sağda müşteri e-postası + görüntüleme sayacı 3
  {
    projectPicked: true,
    projectLabel: "Örnek-1 GES",
    emailTyped: "satinalma@firma.com",
    tabs: [
      { id: "kesif-a", label: "Keşif-A", checked: true },
      { id: "boq",     label: "Fiyatsız BoQ", checked: true },
      { id: "p-boq",   label: "Özet P-BoQ",  checked: true },
      { id: "analiz",  label: "Analiz",      checked: false },
      { id: "dor",     label: "DoR",         checked: true },
    ],
    buttonPulse: false,
    buttonSent: true,
    emailOpen: true,
    viewCount: 3,
  },
];

function ShareDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % SHARE_FRAMES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const f = SHARE_FRAMES[step];

  return (
    <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Sol: Paylaşım formu ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Share2 className="size-3.5" />
          Yeni paylaşım oluştur
        </p>

        {/* Proje dropdown */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Proje
          </p>
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-2.5 py-2 text-[12px] font-medium transition-colors",
              f.projectPicked
                ? "border-emerald-200 bg-emerald-50/40 text-slate-900"
                : "border-slate-200 bg-slate-50/60 text-slate-400",
            )}
          >
            <span className="truncate">{f.projectLabel}</span>
            <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
          </div>
        </div>

        {/* Müşteri e-posta — caret */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Müşteri E-postası
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-[12px] font-medium text-slate-700">
            <Mail className="size-3.5 text-slate-400" />
            <span className="font-mono text-[12px] tabular-nums">
              {f.emailTyped || <span className="text-slate-400">musteri@firma.com</span>}
            </span>
            {step === 1 && (
              <span className="ml-0.5 inline-block h-3 w-[1.5px] animate-pulse bg-slate-700" />
            )}
          </div>
        </div>

        {/* Tab checkbox listesi */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Paylaşılacak Bölümler
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {f.tabs.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-all",
                  t.checked
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-400",
                )}
              >
                <span
                  className={cn(
                    "flex size-3 shrink-0 items-center justify-center rounded-sm border transition-all",
                    t.checked
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white",
                  )}
                >
                  {t.checked && <Check className="size-2" />}
                </span>
                <span className="truncate">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Link Oluştur butonu — pulse efekti */}
        <button
          type="button"
          className={cn(
            "mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all",
            f.buttonSent
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-emerald-600 text-white shadow-sm",
            f.buttonPulse && !f.buttonSent && "scale-105 shadow-lg ring-2 ring-emerald-300",
          )}
          tabIndex={-1}
        >
          {f.buttonSent ? (
            <>
              <Check className="size-3.5" />
              Mail gönderildi
            </>
          ) : (
            <>
              <Send className="size-3.5" />
              Link Oluştur & Mail Gönder
            </>
          )}
        </button>
      </div>

      {/* ── Sağ: Müşteri mail önizleme + Görüntülenme ──────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Üst: e-posta önizleme (Gmail tarzı) */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm transition-all",
            f.emailOpen ? "opacity-100" : "opacity-40",
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
              S
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-slate-900">
                Solar Teklif
              </p>
              <p className="truncate font-mono text-[9.5px] text-slate-400">
                noreply@…  ·  satinalma@firma.com
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[9px] font-semibold text-emerald-700">
              Yeni
            </span>
          </div>

          <p className="text-[12px] font-bold text-slate-900">
            Örnek-1 GES teklif belgesi
          </p>

          {/* Mail içerik özeti */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
            <p className="text-[10.5px] leading-relaxed text-slate-600">
              Merhaba, hazırladığımız teklif belgeleri için aşağıdaki bağlantıyı
              kullanabilirsiniz.
            </p>
            <div className="mt-2 flex justify-center">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[10.5px] font-semibold text-white shadow-sm",
                  f.emailOpen && "animate-in-up",
                )}
                style={f.emailOpen ? { animationDuration: "400ms" } : undefined}
              >
                <Link2 className="size-3" />
                Teklifi Görüntüle →
              </span>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-[9.5px] text-slate-400">
              <Clock className="size-2.5" />
              7 gün geçerli
            </p>
          </div>
        </div>

        {/* Alt: Aktif Linkler tablosu (görüntülenme sayacı) */}
        <div className="flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="size-3.5" />
            Aktif link · canlı izlenme
          </p>

          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-900">
                  Örnek-1 GES
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-slate-500">
                  <Mail className="size-2.5" />
                  satinalma@firma.com
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[9px] font-semibold text-emerald-700">
                Aktif
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Eye className="size-2.5" />
                Görüntülenme
              </span>
              <span
                key={f.viewCount}
                className={cn(
                  "tabular-nums text-[14px] font-extrabold text-slate-900 transition-all",
                  f.viewCount > 0 && "animate-in-up text-emerald-700",
                )}
                style={f.viewCount > 0 ? { animationDuration: "400ms" } : undefined}
              >
                {f.viewCount}
              </span>
            </div>
          </div>

          <p className="text-[10px] leading-snug text-slate-500">
            Süresiz, 1 günlük, 7 günlük… senin belirlediğin sürede otomatik
            kapanır. İstediğin an iptal edersin.
          </p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// ImportDemo — Excel'den proje yükleme akışı
// ───────────────────────────────────────────────────────────────────────

interface ImportFrame {
  stage: "idle" | "dropping" | "parsing" | "preview" | "done";
  hint: string;
}

const IMPORT_FRAMES: ImportFrame[] = [
  { stage: "idle", hint: "Excel'i sürükle bırak" },
  { stage: "dropping", hint: "Dosya alındı..." },
  { stage: "parsing", hint: "Kolonlar okunuyor..." },
  { stage: "preview", hint: "Auto-detect ile eşlendi — onayla" },
  { stage: "done", hint: "Proje oluşturuldu ✓" },
];

const IMPORT_ROWS = [
  { kod: "A.1.1", tanim: "Solar Panel 540W", miktar: "1.000.000", fiyat: "$0.185", birim: "Wp" },
  { kod: "A.2.1", tanim: "String İnverter 100kW", miktar: "10", fiyat: "$4.500", birim: "adet" },
  { kod: "A.4.1", tanim: "DC Kablo 1x6", miktar: "12.000", fiyat: "$0.72", birim: "mt" },
  { kod: "B.1.1", tanim: "Panel Montaj İşçilik", miktar: "1", fiyat: "$25.000", birim: "MW" },
];

const IMPORT_MAPPINGS = [
  { our: "Kod", their: "Kalem Kodu", matched: true },
  { our: "Tanım", their: "Açıklama", matched: true },
  { our: "Miktar", their: "Adet", matched: true },
  { our: "Fiyat", their: "Birim Fiyat USD", matched: true },
  { our: "Birim", their: "Ölçü", matched: true },
];

function ImportDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % IMPORT_FRAMES.length), 2200);
    return () => clearInterval(t);
  }, []);
  const f = IMPORT_FRAMES[step];

  return (
    <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {/* SOL: Drop zone + mapping */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Upload className="size-3.5" />
          Excel'den İçe Aktar
        </p>

        {/* Drop zone — animation */}
        <div
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-all",
            f.stage === "idle"
              ? "border-slate-300 bg-slate-50/40"
              : f.stage === "dropping"
                ? "scale-[1.02] border-emerald-400 bg-emerald-50/50 shadow-md ring-2 ring-emerald-200"
                : "border-emerald-300 bg-emerald-50/30",
          )}
        >
          {f.stage === "idle" ? (
            <Upload className="size-7 text-slate-400" />
          ) : f.stage === "dropping" ? (
            <FileSpreadsheet className="size-7 animate-bounce text-emerald-600" />
          ) : (
            <FileSpreadsheet className="size-7 text-emerald-600" />
          )}
          <p className="text-center text-[11px] font-semibold text-slate-700">
            {f.stage === "idle" ? (
              "Excel'i buraya sürükle"
            ) : (
              <span className="text-emerald-700">
                eski-projelerim.xlsx <span className="text-[9.5px] text-slate-500">(24 satır)</span>
              </span>
            )}
          </p>
          <p className="text-[9.5px] text-slate-400">{f.hint}</p>
        </div>

        {/* Auto-detect mapping list */}
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="mb-1.5 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
            <Sparkles className="size-2.5 text-emerald-600" />
            Kolon Eşleme (Otomatik)
          </p>
          <ul className="space-y-1">
            {IMPORT_MAPPINGS.map((m, i) => {
              const visible =
                f.stage === "parsing" ? i < 3 : f.stage === "idle" || f.stage === "dropping" ? false : true;
              return (
                <li
                  key={m.our}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1 text-[10px] transition-all duration-300",
                    visible
                      ? "bg-emerald-50/40 opacity-100"
                      : "bg-slate-50 opacity-0",
                  )}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] text-slate-500">
                      {m.their}
                    </span>
                    <ArrowDownUp className="size-2.5 rotate-90 text-slate-300" />
                    <span className="font-semibold text-slate-800">{m.our}</span>
                  </span>
                  {visible && (
                    <Check className="size-3 text-emerald-600" strokeWidth={3} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* SAĞ: Önizleme tablosu + sonuç */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <FileSpreadsheet className="size-3.5" />
            Önizleme
          </p>
          {f.stage === "done" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-2.5" />
              Aktarıldı
            </span>
          )}
        </div>

        {/* Tablo */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-[10.5px]">
            <thead className="bg-slate-100 text-[8.5px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-2 py-1.5 text-left font-bold">Kod</th>
                <th className="px-2 py-1.5 text-left font-bold">Tanım</th>
                <th className="px-2 py-1.5 text-right font-bold">Miktar</th>
                <th className="px-2 py-1.5 text-right font-bold">Fiyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {IMPORT_ROWS.map((r, i) => {
                const visible =
                  f.stage === "preview" || f.stage === "done"
                    ? true
                    : f.stage === "parsing" && i === 0;
                return (
                  <tr
                    key={r.kod}
                    className={cn(
                      "transition-all duration-300",
                      visible ? "opacity-100" : "opacity-0",
                      r.kod.startsWith("A") ? "bg-white" : "bg-slate-50/50",
                    )}
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    <td className="px-2 py-1 font-mono text-[9.5px] text-slate-500">
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[8.5px] font-bold",
                          r.kod.startsWith("A")
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-sky-100 text-sky-700",
                        )}
                      >
                        {r.kod}
                      </span>
                    </td>
                    <td className="px-2 py-1 truncate font-medium text-slate-800">
                      {r.tanim}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                      {r.miktar}
                    </td>
                    <td className="px-2 py-1 text-right font-bold tabular-nums text-emerald-700">
                      {r.fiyat}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sonuç banner */}
        <div
          className={cn(
            "mt-auto flex items-center gap-2 rounded-lg border px-3 py-2 transition-all",
            f.stage === "done"
              ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200"
              : "border-slate-200 bg-slate-50/40",
          )}
        >
          {f.stage === "done" ? (
            <>
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
                <Check className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-emerald-800">
                  Proje oluşturuldu
                </p>
                <p className="text-[9.5px] text-slate-600">
                  Keşif-A: 3 grup · Keşif-B: 1 grup · 24 kalem
                </p>
              </div>
            </>
          ) : (
            <>
              <Sparkles className="size-3.5 text-slate-400" />
              <p className="text-[10px] text-slate-500">
                A.x kodlar Keşif-A'ya, B.x kodlar Keşif-B'ye otomatik dağılır.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// QrShareDemo — QR + WhatsApp hızlı paylaşım modalı
// ───────────────────────────────────────────────────────────────────────

interface QrFrame {
  hover: "qr" | "wa" | "mail" | null;
  phoneStep: 0 | 1 | 2; // 0=idle, 1=scanning, 2=opened
}

const QR_FRAMES: QrFrame[] = [
  { hover: null, phoneStep: 0 },
  { hover: "qr", phoneStep: 1 },
  { hover: "qr", phoneStep: 2 },
  { hover: "wa", phoneStep: 2 },
  { hover: "mail", phoneStep: 2 },
];

function QrShareDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % QR_FRAMES.length), 2000);
    return () => clearInterval(t);
  }, []);
  const f = QR_FRAMES[step];

  return (
    <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {/* SOL: Paylaş modalı */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Share2 className="size-3.5" />
            Paylaş
          </p>
          <span className="text-[10px] text-slate-400">Örnek Proje · 2.5 MWp</span>
        </div>

        {/* QR kod — fake pattern */}
        <div className="mx-auto flex flex-col items-center gap-1.5">
          <div
            className={cn(
              "relative rounded-xl border-2 bg-white p-2 transition-all",
              f.hover === "qr"
                ? "scale-105 border-emerald-400 shadow-lg ring-2 ring-emerald-200"
                : "border-slate-200 shadow-sm",
            )}
          >
            <FakeQrCode />
            {/* Scanning line — sadece phone "scanning" durumundayken */}
            {f.phoneStep === 1 && (
              <div
                className="pointer-events-none absolute inset-x-2 top-2 h-[3px] rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                style={{ animation: "qr-scan 1.5s ease-in-out infinite" }}
              />
            )}
          </div>
          <p className="text-[9.5px] font-semibold text-slate-500">
            Telefonun kamerasıyla taratabilirsin
          </p>
        </div>

        {/* URL satırı */}
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
          <Link2 className="size-3 text-slate-400" />
          <code className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-slate-600">
            solarteklif.com/share/x9k2…
          </code>
          <span className="rounded bg-white px-1.5 py-0.5 text-[8.5px] font-bold text-slate-700 ring-1 ring-slate-200">
            Kopyala
          </span>
        </div>

        {/* Aksiyon butonları */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all",
              f.hover === "wa"
                ? "scale-[1.04] bg-[#1ebe57] shadow-md ring-2 ring-emerald-300"
                : "bg-[#25D366]",
            )}
            tabIndex={-1}
          >
            <MessageCircle className="size-3.5" />
            WhatsApp
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all",
              f.hover === "mail"
                ? "scale-[1.04] bg-slate-900 shadow-md ring-2 ring-slate-400"
                : "bg-slate-800",
            )}
            tabIndex={-1}
          >
            <Mail className="size-3.5" />
            Mail
          </button>
        </div>
      </div>

      {/* SAĞ: Telefon mockup */}
      <div className="flex items-center justify-center">
        <div className="relative rounded-[24px] border-[6px] border-slate-800 bg-slate-900 px-1 py-3 shadow-xl">
          {/* Notch */}
          <div className="absolute left-1/2 top-1 h-1 w-12 -translate-x-1/2 rounded-full bg-slate-700" />

          {/* Ekran */}
          <div className="flex h-[260px] w-[140px] flex-col gap-1 overflow-hidden rounded-[16px] bg-white p-2">
            {f.phoneStep === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <Smartphone className="size-8" />
                <p className="text-center text-[9px]">QR'ı taratınca burası açılır</p>
              </div>
            )}

            {f.phoneStep === 1 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                <div className="rounded-md border-2 border-emerald-500 p-2">
                  <FakeQrCode size={60} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <p className="text-[9px] font-semibold text-emerald-700">Taranıyor...</p>
                </div>
              </div>
            )}

            {f.phoneStep === 2 && (
              <>
                {/* Mini browser bar */}
                <div className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                  <Lock className="size-2 text-emerald-600" />
                  <span className="font-mono text-[7px] text-slate-500">solarteklif.com</span>
                </div>
                {/* Sayfa içeriği — hero */}
                <div className="rounded-md bg-gradient-to-br from-slate-900 to-slate-700 p-1.5 text-white">
                  <p className="text-[7px] font-bold text-emerald-300">HOŞ GELDİN</p>
                  <p className="text-[8.5px] font-bold">Solar GES Teklifi</p>
                  <p className="mt-0.5 text-[6.5px] text-slate-300">2.5 MWp · Çatı GES</p>
                </div>
                {/* Tab nav */}
                <div className="flex gap-0.5">
                  <span className="rounded bg-emerald-600 px-1 py-0.5 text-[6px] font-bold text-white">
                    Özet
                  </span>
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[6px] text-slate-600">
                    BoQ
                  </span>
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[6px] text-slate-600">
                    Analiz
                  </span>
                </div>
                {/* Mini grafik */}
                <div className="flex flex-1 flex-col gap-1 rounded border border-slate-200 bg-slate-50/50 p-1">
                  <p className="text-[6.5px] font-bold text-slate-600">EPC Satış</p>
                  <p className="text-[10px] font-black text-emerald-700">$1.2M</p>
                  <p className="text-[6px] text-slate-500">25 yıl: $4.8M tasarruf</p>
                  <div className="mt-auto flex h-3 items-end gap-0.5">
                    {[40, 65, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-emerald-500"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Basit fake QR — 13x13 grid, decorative
function FakeQrCode({ size = 100 }: { size?: number }) {
  const dots = [
    "1111111010101011111111",
    "1000001011101011000001",
    "1011101001010011011101",
    "1011101010111011011101",
    "1011101011010011011101",
    "1000001011001011000001",
    "1111111010101011111111",
    "0000000011001100000000",
    "1010110111010101110100",
    "0011001011010110100110",
    "1100110010110101010111",
    "0101010111001101011010",
    "1011100110111001100101",
    "0010101010101010101101",
    "1101011001011010110010",
    "0000000010110111100110",
    "1111111011001100100111",
    "1000001001101110110010",
    "1011101010010100001101",
    "1011101011110110110111",
    "1011101001011000011001",
    "1000001011110011010101",
    "1111111010010110010110",
  ];
  const cell = size / 22;
  return (
    <div
      className="relative grid bg-white"
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(22, ${cell}px)`,
        gridTemplateRows: `repeat(22, ${cell}px)`,
      }}
    >
      {dots.slice(0, 22).map((row, ri) =>
        row.slice(0, 22).split("").map((c, ci) => (
          <div
            key={`${ri}-${ci}`}
            style={{
              backgroundColor: c === "1" ? "#0f172a" : "#fff",
            }}
          />
        )),
      )}
    </div>
  );
}
