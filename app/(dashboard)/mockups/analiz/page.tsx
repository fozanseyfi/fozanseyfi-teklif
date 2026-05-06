/**
 * Analiz sayfası için 4 farklı layout mockup'ı.
 * Sadece görsel kıyaslama için — gerçek veri yok, gerçek hesap yok.
 * Kullanıcı birini seçince, components/ges/analiz-dashboard.tsx'e uygulanacak.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Zap,
  TrendingUp,
  BarChart3,
  Calendar,
  Settings,
  ChevronRight,
} from "lucide-react";

// Örnek veri — sadece görsel için
const SAMPLE = {
  salePrice: 4_250_000,
  salePriceTry: 168_300_000,
  perKw: 0.785,
  dcGuc: 5.4,
  acGuc: 4.86,
  netKar: 380_000,
  netKarPct: 8.9,
  totalCost: 3_870_000,
  totalInterest: 145_000,
  contingency: 42_500,
  ohc: 348_300,
  groups: [
    { code: "A.1", name: "Panel", val: 925_000, pct: 23.9 },
    { code: "A.2", name: "İnverter", val: 487_000, pct: 12.6 },
    { code: "A.3", name: "Konstrüksiyon", val: 660_000, pct: 17.0 },
    { code: "A.4", name: "Kablo", val: 215_000, pct: 5.6 },
    { code: "A.5", name: "Bağlantı Elem.", val: 145_000, pct: 3.7 },
    { code: "A.6", name: "Boru-Kum", val: 88_000, pct: 2.3 },
    { code: "A.7", name: "OG Hücre-Trafo", val: 392_000, pct: 10.1 },
    { code: "A.12", name: "İnşaat İşleri", val: 285_000, pct: 7.4 },
    { code: "A.13", name: "İşçilik", val: 320_000, pct: 8.3 },
    { code: "B.1", name: "Genel Gider", val: 96_000, pct: 2.5 },
    { code: "B.2", name: "O&M Garanti", val: 72_000, pct: 1.9 },
    { code: "B.5", name: "Sigorta", val: 42_000, pct: 1.1 },
  ],
};

function fmt(n: number) {
  return n.toLocaleString("tr-TR");
}

export default function AnalizMockupPage() {
  return (
    <div className="space-y-12">
      <div className="rounded-xl border bg-info-soft px-5 py-4">
        <p className="text-sm font-semibold text-info-soft-foreground">
          Analiz Sayfası — 4 Layout Alternatifi
        </p>
        <p className="mt-1 text-xs text-info-soft-foreground/80">
          Aşağıdaki 4 mockup&apos;u inceleyin. Birini beğenince &quot;layout A
          olsun&quot; / &quot;B uygula&quot; gibi söyleyin, ANALİZ sayfasına onu
          uygulayayım. Bu sayfa sadece görsel kıyaslama için — gerçek veri yok.
        </p>
      </div>

      <LayoutA />
      <LayoutB />
      <LayoutC />
      <LayoutD />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * LAYOUT A — Hero + Çalışma Alanı
 * Üstte tek BÜYÜK satış fiyatı kartı (yarı ekran) + 4 destek KPI
 * Altta sol %60 detay tablo, sağ %40 grafik+marjlar
 * En altta kritik malzeme + hassasiyet
 * ────────────────────────────────────────────────────────────────────── */
function LayoutA() {
  return (
    <section>
      <SectionTitle label="A — Hero + Çalışma Alanı" />

      {/* Hero */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="bg-primary text-primary-foreground shadow-md">
          <CardContent className="flex h-full flex-col justify-between p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
                EPC Satış Fiyatı
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight">
                ${fmt(SAMPLE.salePrice)}
              </p>
              <p className="mt-1 text-sm opacity-80">
                ₺{fmt(SAMPLE.salePriceTry)} · {SAMPLE.perKw.toFixed(3)} $/kWp
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                Net Kar %{SAMPLE.netKarPct}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                {SAMPLE.dcGuc} MW DC
              </span>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <MiniKpi tone="info" label="Toplam Maliyet" value={`$${fmt(SAMPLE.totalCost)}`} />
          <MiniKpi tone="success" label="Net Kar" value={`$${fmt(SAMPLE.netKar)}`} />
          <MiniKpi tone="warning" label="Toplam Faiz" value={`$${fmt(SAMPLE.totalInterest)}`} />
          <MiniKpi tone="muted" label="Contingency" value={`$${fmt(SAMPLE.contingency)}`} />
        </div>
      </div>

      {/* Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Tüm Kalemler Özet</p>
              <p className="text-xs text-muted-foreground">
                Tıklayarak grup düzenleyin
              </p>
            </div>
            <SampleTable />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Maliyet Dağılımı
              </p>
              <SampleBarList compact />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Marjlar
              </p>
              <SampleMargins />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drill-down */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <PlaceholderCard icon={Zap} label="Kritik Malzeme Seçimi" />
        <PlaceholderCard icon={TrendingUp} label="Döviz Hassasiyeti" />
        <PlaceholderCard icon={BarChart3} label="Karlılık Analizi" />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * LAYOUT B — Sticky Sol Panel + Detay Sağ
 * ────────────────────────────────────────────────────────────────────── */
function LayoutB() {
  return (
    <section>
      <SectionTitle label="B — Sticky Sol Panel (Director Cockpit)" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sticky left rail */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="bg-primary text-primary-foreground shadow-md">
            <CardContent className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                EPC Satış Fiyatı
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                ${fmt(SAMPLE.salePrice)}
              </p>
              <p className="mt-1 text-xs opacity-75">
                ₺{fmt(SAMPLE.salePriceTry)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 border-t border-white/20 pt-3">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                  ★ Net Kar %{SAMPLE.netKarPct}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Özgül Maliyet</span>
                <span className="font-semibold">{SAMPLE.perKw.toFixed(3)} $/kWp</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DC / AC</span>
                <span className="font-semibold">
                  {SAMPLE.dcGuc} / {SAMPLE.acGuc} MW
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Toplam Maliyet</span>
                <span className="font-semibold">${fmt(SAMPLE.totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam Faiz</span>
                <span className="font-semibold text-warning-soft-foreground">
                  ${fmt(SAMPLE.totalInterest)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contingency</span>
                <span className="font-medium">${fmt(SAMPLE.contingency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead</span>
                <span className="font-medium">${fmt(SAMPLE.ohc)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Net Kar</span>
                <span className="font-bold text-success-soft-foreground">
                  ${fmt(SAMPLE.netKar)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right content */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">Tüm Kalemler Özet</p>
              </div>
              <SampleTable />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Maliyet Dağılımı
              </p>
              <SampleBarList />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Marjlar
              </p>
              <SampleMargins />
            </CardContent>
          </Card>
          <PlaceholderCard icon={Zap} label="Kritik Malzeme Seçimi" />
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * LAYOUT C — Sıkı Tek Sütun (Karardestek Tarzı)
 * ────────────────────────────────────────────────────────────────────── */
function LayoutC() {
  return (
    <section>
      <SectionTitle label="C — Sıkı Tek Sütun (Karardestek Tarzı)" />

      {/* 5 mini KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniKpi tone="primary" label="EPC Satış" value={`$${fmt(SAMPLE.salePrice)}`} small />
        <MiniKpi tone="info" label="$/kWp" value={SAMPLE.perKw.toFixed(3)} small />
        <MiniKpi tone="success" label="Net Kar" value={`%${SAMPLE.netKarPct}`} small />
        <MiniKpi tone="warning" label="Faiz" value={`$${fmt(SAMPLE.totalInterest)}`} small />
        <MiniKpi tone="muted" label="DC / AC" value={`${SAMPLE.dcGuc} MW`} small />
      </div>

      {/* Full-width primary table */}
      <Card className="mb-4">
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Tüm Kalemler Özet</p>
          </div>
          <SampleTable />
        </CardContent>
      </Card>

      {/* Two columns: Bar dağılımı + Cash flow */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Maliyet Dağılımı
            </p>
            <SampleBarList />
          </CardContent>
        </Card>
        <PlaceholderCard icon={Calendar} label="Cash Flow Grafiği" tall />
      </div>

      {/* Two columns: marjlar + alt */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Marjlar
            </p>
            <SampleMargins />
          </CardContent>
        </Card>
        <PlaceholderCard icon={Zap} label="Kritik Malzeme Seçimi" tall />
      </div>

      {/* Full-width sensitivity */}
      <PlaceholderCard icon={TrendingUp} label="Hassasiyet + Karlılık Analizi" />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * LAYOUT D — Hero band + Side-by-side
 * Üstte yatay bant: Sale Price + 5 KPI (tek satır)
 * Altta tam ekran 50/50: Tüm Kalemler / Maliyet Dağılımı
 * Sonra cash flow tam genişlik, sonra alternatifler
 * ────────────────────────────────────────────────────────────────────── */
function LayoutD() {
  return (
    <section>
      <SectionTitle label="D — Yatay Bant + Side-by-Side" />

      {/* Hero band */}
      <Card className="mb-4 overflow-hidden bg-foreground text-background">
        <CardContent className="grid grid-cols-2 gap-0 p-0 lg:grid-cols-6">
          <div className="col-span-2 border-r border-white/10 p-6 lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
              EPC Satış Fiyatı
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight">
              ${fmt(SAMPLE.salePrice)}
            </p>
            <p className="mt-1 text-xs opacity-60">₺{fmt(SAMPLE.salePriceTry)}</p>
          </div>
          <BandKpi label="Özgül" value={SAMPLE.perKw.toFixed(3)} sub="$/kWp" />
          <BandKpi label="Net Kar" value={`%${SAMPLE.netKarPct}`} sub={`$${fmt(SAMPLE.netKar)}`} />
          <BandKpi label="Toplam Faiz" value={`$${fmt(SAMPLE.totalInterest)}`} sub="kredi" />
          <BandKpi label="DC / AC" value={`${SAMPLE.dcGuc}`} sub="MW DC" />
        </CardContent>
      </Card>

      {/* Side by side: Tüm Kalemler + Maliyet Dağılımı */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Tüm Kalemler Özet</p>
            </div>
            <SampleTable />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Maliyet Dağılımı
            </p>
            <SampleBarList />
          </CardContent>
        </Card>
      </div>

      {/* Cash flow full width */}
      <PlaceholderCard icon={Calendar} label="Aylık Cash Flow Grafiği" />

      {/* Marjlar + alternatifler */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Marjlar
            </p>
            <SampleMargins />
          </CardContent>
        </Card>
        <PlaceholderCard icon={Zap} label="Kritik Malzeme Seçimi" />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{label}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function MiniKpi({
  tone,
  label,
  value,
  small,
}: {
  tone: "primary" | "info" | "success" | "warning" | "muted";
  label: string;
  value: string;
  small?: boolean;
}) {
  const styles = {
    primary: "bg-primary-soft text-primary-soft-foreground border-primary/20",
    info: "bg-info-soft text-info-soft-foreground border-info/20",
    success: "bg-success-soft text-success-soft-foreground border-success/20",
    warning: "bg-warning-soft text-warning-soft-foreground border-warning/20",
    muted: "bg-muted text-foreground border-border",
  };
  return (
    <Card className={cn("border", styles[tone])}>
      <CardContent className={cn("p-4", small && "p-3")}>
        <p
          className={cn(
            "font-semibold uppercase tracking-widest opacity-70",
            small ? "text-[9px]" : "text-[10px]",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-1 font-bold tabular-nums tracking-tight",
            small ? "text-base" : "text-xl",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function BandKpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-r border-white/10 p-6 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs opacity-60">{sub}</p>
    </div>
  );
}

function SampleTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              Kod
            </th>
            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              Grup
            </th>
            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              USD
            </th>
            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              Pay %
            </th>
            <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
              Bar
            </th>
            <th className="w-8 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {SAMPLE.groups.map((g) => (
            <tr key={g.code} className="hover:bg-muted/40">
              <td className="px-3 py-2 font-mono text-muted-foreground">{g.code}</td>
              <td className="px-3 py-2 font-medium">{g.name}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                ${fmt(g.val)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {g.pct.toFixed(1)}%
              </td>
              <td className="px-3 py-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      g.code.startsWith("A") ? "bg-primary" : "bg-info",
                    )}
                    style={{ width: `${Math.min(g.pct * 3, 100)}%` }}
                  />
                </div>
              </td>
              <td className="px-3 py-2">
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleBarList({ compact = false }: { compact?: boolean }) {
  const items = compact ? SAMPLE.groups.slice(0, 6) : SAMPLE.groups;
  const max = Math.max(...items.map((g) => g.pct));
  return (
    <div className="space-y-1">
      {items.map((g) => (
        <div key={g.code} className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px]",
              g.code.startsWith("A")
                ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                : "border-info/30 bg-info-soft text-info-soft-foreground",
            )}
          >
            {g.code}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{g.name}</span>
          <div className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className={cn(
                "h-full rounded-full",
                g.code.startsWith("A") ? "bg-primary" : "bg-info",
              )}
              style={{ width: `${(g.pct / max) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
            {g.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function SampleMargins() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Contingency", v: 1 },
        { label: "OHC", v: 9 },
        { label: "Net Kar", v: 3 },
        { label: "Kredi Faizi", v: 4.2 },
      ].map((m) => (
        <div key={m.label} className="space-y-1">
          <Label className="text-xs">{m.label}</Label>
          <Input value={m.v} readOnly className="h-8 text-sm" />
        </div>
      ))}
    </div>
  );
}

function PlaceholderCard({
  icon: Icon,
  label,
  tall,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tall?: boolean;
}) {
  return (
    <Card>
      <CardContent
        className={cn(
          "flex items-center justify-center text-muted-foreground",
          tall ? "h-48" : "h-28",
        )}
      >
        <div className="flex flex-col items-center gap-2 text-xs">
          <Icon className="size-5" />
          <span className="font-medium">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
