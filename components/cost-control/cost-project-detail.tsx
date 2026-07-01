"use client";

import { useState, useTransition, useMemo, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  Users2,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Receipt,
  Settings2,
  HandCoins,
  ExternalLink,
  Landmark,
  CalendarClock,
  Copy,
  Share2,
  MessageCircle,
  Mail,
  Link2,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SupplierCombobox, type ComboVendor } from "@/components/cost-control/supplier-combobox";
import {
  computeCostProjectMetrics,
  lineNetTL,
  lineVatTL,
  lineGrossTL,
  linePaidTL,
  lineBalanceTL,
  linePayStatus,
  csym,
  PAYMENT_METHOD_LABELS,
  CORPORATE_TAX_RATE,
  type Rates,
} from "@/lib/cost-control";
import { reminderText } from "@/lib/cost-control-statement";
import { buildStatementPrintHtml, buildPaymentOwnersPrintHtml, buildCostLinesPrintHtml } from "@/lib/cost-statement-print";
import type { BrandContext } from "@/lib/pdf-brand";
import {
  updateCostProject,
  deleteCostProject,
  createCostLine,
  updateCostLine,
  deleteCostLine,
  allocateOwnerPayment,
  deleteCostPayment,
  addCostCollection,
  deleteCostCollection,
  saveCostPartners,
  createStatementToken,
  type CostLineInput,
} from "@/app/actions/cost-control";

function fmt(n: number, d = 0) {
  return formatNumber(n, d);
}

// IBAN'ı tek tip göster: boşlukları temizle, 4'lü gruplarla yeniden ayır.
function fmtIban(s: string): string {
  const raw = (s || "").replace(/\s+/g, "");
  return raw ? raw.replace(/(.{4})/g, "$1 ").trim() : "";
}

// ————————————————————————————————————————— tipler
interface Payment {
  id: string;
  amount: number;
  paidDate: string;
  method: string;
  note: string;
}
interface Line {
  id: string;
  categoryId: string | null;
  categoryLabel: string;
  code: string;
  description: string;
  model: string;
  brand: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  exchangeRate: number;
  vatRate: number;
  isInvoiced: boolean;
  vendorId: string | null;
  vendorName: string;
  vendorPayIban: string;
  payAccountNameOverride: string;
  payIbanOverride: string;
  link: string;
  plannedAmount: number | null;
  payments: Payment[];
}
interface Collection {
  id: string;
  amount: number;
  collectedDate: string;
  isPlanned: boolean;
  note: string;
}
interface Partner {
  id: string;
  name: string;
  sharePercent: number;
}
interface ProjectData {
  id: string;
  name: string;
  customer: string;
  salesPrice: number;
  salesCurrency: string;
  salesVatRate: number;
  salesInvoicedAmount: number;
  plannedCostTotal: number;
  status: "ACTIVE" | "DONE";
  startDate: string;
  endDate: string;
  notes: string;
  sourceProjectId: string | null;
  statementToken: string | null;
  lines: Line[];
  collections: Collection[];
  partners: Partner[];
}
interface Vendor {
  id: string;
  name: string;
  payAccountName: string;
  payIban: string;
  defaultInvoiced: boolean;
}
interface Category {
  id: string;
  code: string;
  name: string;
}

const CURRENCIES = ["TRY", "USD", "EUR"];

export function CostProjectDetail({
  data,
  vendors,
  categories,
  rates,
  firmName,
  userEmail,
  brand,
  canEdit,
}: {
  data: ProjectData;
  vendors: Vendor[];
  categories: Category[];
  rates: Rates;
  firmName: string;
  userEmail: string;
  brand: BrandContext;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editProject, setEditProject] = useState(false);
  const [lineDialog, setLineDialog] = useState<{ open: boolean; line: Line | null }>({ open: false, line: null });
  // Tedarikçi listesi yerel state — combobox'tan yeni tedarikçi eklenince anında
  // görünsün; sunucu yenilenince prop'tan senkronlanır.
  const toCombo = (v: Vendor): ComboVendor => ({
    id: v.id,
    name: v.name,
    defaultInvoiced: v.defaultInvoiced,
    payIban: v.payIban,
    payAccountName: v.payAccountName,
  });
  const [vendorList, setVendorList] = useState<ComboVendor[]>(vendors.map(toCombo));
  useEffect(() => {
    setVendorList(vendors.map(toCombo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors]);

  const m = useMemo(
    () =>
      computeCostProjectMetrics({
        salesPrice: data.salesPrice,
        salesCurrency: data.salesCurrency,
        salesVatRate: data.salesVatRate,
        salesInvoicedAmount: data.salesInvoicedAmount,
        plannedCostTotal: data.plannedCostTotal,
        lines: data.lines,
        collections: data.collections,
        partners: data.partners,
        rates,
      }),
    [data, rates],
  );

  // Satış KDV'si yalnız faturalı kısımdan; faturasız kısımda KDV yok.
  const salesVat = (data.salesInvoicedAmount || 0) * ((data.salesVatRate || 0) / 100);
  const salesGross = data.salesPrice + salesVat;
  // Öngörülen (teklif) maliyet/kâra göre gerçekleşme yüzdeleri.
  const costVsPlannedPct = m.plannedTotalTL > 0 ? (m.actualNetTL / m.plannedTotalTL - 1) * 100 : null;
  const profitVsPlannedPct =
    m.hasPlanned && m.plannedProfitTL !== 0 ? (m.profitTL / m.plannedProfitTL - 1) * 100 : null;

  function refresh() {
    router.refresh();
  }

  function downloadLinesPdf() {
    const rows = data.lines.map((l) => {
      const net = lineNetTL(l);
      const gross = lineGrossTL(l);
      const paid = linePaidTL(l);
      const st = linePayStatus(l);
      return {
        code: l.code,
        description: l.description,
        vendorName: l.vendorName,
        qty: l.quantity,
        unit: l.unit,
        net,
        vat: gross - net,
        gross,
        paidStatus: st === "paid" ? "Ödendi" : st === "partial" ? `Kısmi %${fmt((paid / (gross || 1)) * 100)}` : "Ödenmedi",
      };
    });
    const html = buildCostLinesPrintHtml({
      brand,
      firmName,
      userEmail,
      projectName: data.name,
      todayISO: new Date().toISOString().slice(0, 10),
      rows,
    });
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Açılır pencere engellendi — izin verin");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  function removeProject() {
    if (!confirm("Bu maliyet projesi ve tüm kalemleri silinecek. Emin misiniz? Bu işlem geri alınamaz.")) return;
    start(async () => {
      const r = await deleteCostProject(data.id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Proje silindi");
      router.push("/cost-control");
    });
  }

  function removeLine(id: string) {
    if (!confirm("Kalem silinsin mi? Kaleme ait ödemeler de silinir.")) return;
    start(async () => {
      const r = await deleteCostLine(id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Kalem silindi");
      refresh();
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/cost-control" aria-label="Geri">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Wallet className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{data.name}</h1>
              <Badge
                variant="outline"
                className={
                  data.status === "DONE"
                    ? "shrink-0 border-slate-300 bg-slate-100 text-slate-600"
                    : "shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700"
                }
              >
                {data.status === "DONE" ? "Tamamlandı" : "Devam ediyor"}
              </Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {data.customer || "Müşteri belirtilmemiş"}
              {data.sourceProjectId && <span className="ml-2 text-[11px] text-emerald-600">· tekliften alındı</span>}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditProject(true)}>
              <Settings2 className="size-4" /> Proje Ayarları
            </Button>
            <Button variant="outline" size="sm" onClick={removeProject} className="text-destructive hover:bg-destructive-soft">
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Özet metrikler */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Satış (KDV hariç)"
          value={`${m.salesSym}${fmt(m.salesPrice)}`}
          sub={`+KDV ${m.salesSym}${fmt(salesVat)} · Dahil ${m.salesSym}${fmt(salesGross)}`}
          tone="sky"
        />
        <Kpi
          label="Gerçekleşen Maliyet"
          value={`₺${fmt(m.actualNetTL)}`}
          sub={
            m.hasPlanned && costVsPlannedPct != null
              ? `Öngörülen ₺${fmt(m.plannedTotalTL)} · Öngörülene göre ${costVsPlannedPct >= 0 ? "+" : ""}%${fmt(costVsPlannedPct, 1)}`
              : `KDV dahil ₺${fmt(m.actualGrossTL)}`
          }
          tone="slate"
        />
        <Kpi
          label="Vergi Öncesi Kâr (VÖK)"
          value={`₺${fmt(m.profitTL)}`}
          sub={
            m.hasPlanned
              ? `Anlık (nakit) ₺${fmt(m.currentProfitTL)} · Öngörülen ₺${fmt(m.plannedProfitTL)}${profitVsPlannedPct != null ? ` (${profitVsPlannedPct >= 0 ? "+" : ""}%${fmt(profitVsPlannedPct, 1)})` : ""}`
              : `Anlık (Tahsilat − Ödeme): ₺${fmt(m.currentProfitTL)}`
          }
          tone={m.profitTL >= 0 ? "emerald" : "rose"}
          icon={m.profitTL >= 0 ? "up" : "down"}
        />
        <Kpi
          label="Kalan Alacak"
          value={`${m.salesSym}${fmt(m.remainingReceivable)}`}
          sub={`Tahsil: ${m.salesSym}${fmt(m.collectedTotal)}`}
          tone="amber"
        />
        <Kpi label="Tedarikçilere Ödenen" value={`₺${fmt(m.paidTL)}`} tone="slate" />
        <Kpi
          label="Tedarikçilere Kalan"
          value={`₺${fmt(m.payableBalanceTL)}`}
          tone={m.payableBalanceTL > 0.5 ? "amber" : "emerald"}
        />

        {/* Net Kâr özeti — VÖK − vergiler. Tek kart, alt alta. */}
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardContent className="p-4">
            <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
              Net Kâr (vergiler sonrası)
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vergi Öncesi Kâr (VÖK)</span>
                <span className="font-semibold tabular-nums">₺{fmt(m.profitTL)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>− Ödenecek KDV</span>
                <span className="tabular-nums">₺{fmt(m.vatPayableTL)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>− Kurumlar Vergisi (%{CORPORATE_TAX_RATE})</span>
                <span className="tabular-nums">₺{fmt(m.corporateTaxTL)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-base font-bold">
                <span>= Net Kâr</span>
                <span
                  className={cn(
                    "tabular-nums",
                    m.profitTL - m.vatPayableTL - m.corporateTaxTL >= 0 ? "text-emerald-700" : "text-rose-600",
                  )}
                >
                  ₺{fmt(m.profitTL - m.vatPayableTL - m.corporateTaxTL)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kalemler */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4 text-primary" /> Harcama Kalemleri
              <span className="text-xs font-normal text-muted-foreground">({data.lines.length})</span>
            </p>
            <div className="flex items-center gap-2">
              {data.lines.length > 0 && (
                <Button size="sm" variant="outline" onClick={downloadLinesPdf}>
                  <FileDown className="size-4" /> PDF Çıktı
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => setLineDialog({ open: true, line: null })}>
                  <Plus className="size-4" /> Kalem Ekle
                </Button>
              )}
            </div>
          </div>
          {data.lines.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Henüz kalem yok. <strong>Kalem Ekle</strong> ile başlayın.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 text-left">Kod</th>
                    <th className="min-w-[200px] px-2 py-2 text-left">Tanım</th>
                    <th className="px-2 py-2 text-right">Miktar</th>
                    <th className="px-2 py-2 text-right">Birim Fiyat</th>
                    <th className="px-2 py-2 text-center">Kur</th>
                    <th className="px-2 py-2 text-right">KDV hariç</th>
                    <th className="px-2 py-2 text-right">KDV</th>
                    <th className="px-2 py-2 text-right">KDV dahil</th>
                    <th className="px-2 py-2 text-left">Tedarikçi</th>
                    <th className="px-2 py-2 text-center">Ödeme</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.lines.map((l) => {
                    const net = lineNetTL(l);
                    const gross = lineGrossTL(l);
                    const status = linePayStatus(l);
                    const paid = linePaidTL(l);
                    return (
                      <tr key={l.id} className="hover:bg-muted/30">
                        <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">{l.code || "—"}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">{l.description}</span>
                            {l.link && (
                              <a
                                href={l.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-sky-600 hover:text-sky-800"
                                title="Fatura / dekont linkini aç"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                            {!l.isInvoiced && (
                              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                                Faturasız
                              </span>
                            )}
                          </div>
                          {(l.model || l.brand || l.categoryLabel) && (
                            <p className="text-[10.5px] text-muted-foreground">
                              {[l.categoryLabel, l.brand, l.model].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {fmt(l.quantity, l.quantity % 1 === 0 ? 0 : 2)} {l.unit}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {csym(l.currency)}
                          {fmt(l.unitPrice, 2)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums text-muted-foreground">
                          {l.currency === "TRY" ? "—" : fmt(l.exchangeRate, 4)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">₺{fmt(net)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground">₺{fmt(gross - net)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">₺{fmt(gross)}</td>
                        <td className="px-2 py-2 text-left text-muted-foreground">{l.vendorName || "—"}</td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              status === "paid"
                                ? "bg-emerald-100 text-emerald-700"
                                : status === "partial"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600",
                            )}
                            title="Ödeme kaydı en alttaki 'Ödeme Yapılacak Kişiler' bölümünden yapılır"
                          >
                            {status === "paid" ? "Ödendi" : status === "partial" ? `Kısmi %${fmt((paid / (gross || 1)) * 100)}` : "Ödenmedi"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setLineDialog({ open: true, line: l })}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Düzenle"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLine(l.id)}
                                className="rounded p-1 text-destructive/70 hover:bg-destructive-soft"
                                title="Sil"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td colSpan={5} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                      Toplam
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">₺{fmt(m.actualNetTL)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">₺{fmt(m.actualVatTL)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">₺{fmt(m.actualGrossTL)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KDV / İş Özeti + Tahsilat + Ortak */}
      <div className="grid gap-4 lg:grid-cols-2">
        <VatSummary m={m} />
        <CollectionsCard
          data={data}
          m={m}
          firmName={firmName}
          userEmail={userEmail}
          brand={brand}
          canEdit={canEdit}
          pending={pending}
          onChange={refresh}
        />
      </div>

      <PaymentOwnersCard
        lines={data.lines}
        firmName={firmName}
        userEmail={userEmail}
        brand={brand}
        projectName={data.name}
        canEdit={canEdit}
        onChange={refresh}
      />

      <TaxSummaryCard m={m} />

      <PartnersCard data={data} m={m} canEdit={canEdit} onChange={refresh} />

      <CostBreakdownCard lines={data.lines} />

      {/* Dialoglar */}
      {editProject && (
        <ProjectSettingsDialog data={data} onClose={() => setEditProject(false)} onSaved={refresh} />
      )}
      {lineDialog.open && (
        <LineDialog
          projectId={data.id}
          line={lineDialog.line}
          vendors={vendorList}
          onVendorCreated={(v) => setVendorList((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, v]))}
          categories={categories}
          rates={rates}
          onClose={() => setLineDialog({ open: false, line: null })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

// ————————————————————————————————————————— KPI
function Kpi({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "sky" | "slate" | "emerald" | "rose" | "amber";
  icon?: "up" | "down";
}) {
  const cls = {
    sky: "text-sky-700",
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    rose: "text-rose-600",
    amber: "text-amber-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-1 flex items-center gap-1 text-xl font-bold tabular-nums", cls)}>
          {icon === "up" && <TrendingUp className="size-4" />}
          {icon === "down" && <TrendingDown className="size-4" />}
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ————————————————————————————————————————— KDV özeti
function VatSummary({ m }: { m: ReturnType<typeof computeCostProjectMetrics> }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Receipt className="size-4 text-primary" /> KDV / İş Özeti (TL)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-1.5 text-left font-semibold"> </th>
                <th className="py-1.5 text-right font-semibold">Matrah</th>
                <th className="py-1.5 text-right font-semibold">KDV</th>
                <th className="py-1.5 text-right font-semibold">Brüt</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <VatRow label="Faturalı" net={m.invoicedNetTL} vat={m.invoicedVatTL} gross={m.invoicedGrossTL} />
              <VatRow label="Faturasız" net={m.uninvoicedNetTL} vat={m.uninvoicedVatTL} gross={m.uninvoicedGrossTL} />
              <VatRow label="Toplam" net={m.actualNetTL} vat={m.actualVatTL} gross={m.actualGrossTL} strong />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
function VatRow({ label, net, vat, gross, strong }: { label: string; net: number; vat: number; gross: number; strong?: boolean }) {
  return (
    <tr className={cn(strong && "font-bold text-foreground")}>
      <td className="py-2 text-left">{label}</td>
      <td className="py-2 text-right tabular-nums">₺{fmt(net)}</td>
      <td className="py-2 text-right tabular-nums">₺{fmt(vat)}</td>
      <td className="py-2 text-right tabular-nums">₺{fmt(gross)}</td>
    </tr>
  );
}

// ————————————————————————————————————————— Maliyet kırılımı (kategori)
function CostBreakdownCard({ lines }: { lines: Line[] }) {
  const { rows, total } = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) {
      const key = l.categoryLabel || "Kategorisiz";
      map.set(key, (map.get(key) || 0) + lineGrossTL(l));
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    const rows = Array.from(map.entries())
      .map(([name, val]) => ({ name, val, pct: total > 0 ? (val / total) * 100 : 0 }))
      .sort((a, b) => b.val - a.val);
    return { rows, total };
  }, [lines]);

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="size-4 text-primary" /> Maliyet Kırılımı (kategori · KDV dahil)
          </p>
          <span className="text-xs text-muted-foreground">
            Toplam: <strong className="text-foreground">₺{fmt(total)}</strong>
          </span>
        </div>
        <div className="divide-y">
          {rows.map((r, i) => (
            <div key={i} className="px-4 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-800">{r.name}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">₺{fmt(r.val)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">%{fmt(r.pct, 1)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.pct)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ————————————————————————————————————————— Vergi & şirkete net
function TaxSummaryCard({ m }: { m: ReturnType<typeof computeCostProjectMetrics> }) {
  const hasInvoiced = m.salesInvoicedNetTL > 0;
  return (
    <Card className="border-dashed">
      <CardContent className="p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Receipt className="size-4 text-primary" /> Vergi & Şirkete Net (yalnız faturalı kısım vergilendirilir)
        </p>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Faturalı satış: ₺{fmt(m.salesInvoicedNetTL)} · Faturasız satış: ₺{fmt(m.salesUninvoicedNetTL)}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* KDV */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">KDV</p>
            <TaxRow label="Müşteriden alınan KDV" value={m.outputVatTL} />
            <TaxRow label="Maliyet KDV'si (indirilecek)" value={-m.inputVatTL} />
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-bold">
              <span>Devlete Ödenecek KDV</span>
              <span className={cn("tabular-nums", m.vatPayableTL >= 0 ? "text-rose-600" : "text-emerald-600")}>
                ₺{fmt(m.vatPayableTL)}
              </span>
            </div>
            {m.vatPayableTL < 0 && (
              <p className="mt-1 text-[10.5px] text-emerald-600">Negatif = devraan KDV (alacak).</p>
            )}
          </div>

          {/* Kâr & vergi */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kâr & Vergi</p>
            <TaxRow label="Faturalı kâr (KDV hariç)" value={m.invoicedProfitNetTL} />
            <TaxRow label={`Kurumlar vergisi (%${CORPORATE_TAX_RATE})`} value={-m.corporateTaxTL} />
            <TaxRow label="Faturasız kâr (vergisiz)" value={m.uninvoicedProfitNetTL} muted />
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-bold">
              <span>Şirkete Net Kalan</span>
              <span className={cn("tabular-nums", m.companyNetTL >= 0 ? "text-emerald-700" : "text-rose-600")}>
                ₺{fmt(m.companyNetTL)}
              </span>
            </div>
          </div>
        </div>

        {!hasInvoiced && (
          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Faturalı satış tutarı girilmemiş — vergi hesabı için proje ayarlarından &quot;Faturalı Satış Tutarı&quot;nı belirtin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function TaxRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1 text-sm", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">₺{fmt(value)}</span>
    </div>
  );
}

// ————————————————————————————————————————— Tahsilat
function CollectionsCard({
  data,
  m,
  firmName,
  userEmail,
  brand,
  canEdit,
  pending,
  onChange,
}: {
  data: ProjectData;
  m: ReturnType<typeof computeCostProjectMetrics>;
  firmName: string;
  userEmail: string;
  brand: BrandContext;
  canEdit: boolean;
  pending: boolean;
  onChange: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [planned, setPlanned] = useState(false);
  const [busy, start] = useTransition();
  const sym = m.salesSym;

  const actualColls = data.collections
    .filter((c) => !c.isPlanned)
    .slice()
    .sort((a, b) => b.collectedDate.localeCompare(a.collectedDate));
  // Planlananlar: girilme sırasına göre değil, tarihe göre (yakın önce).
  const plannedColls = data.collections
    .filter((c) => c.isPlanned)
    .slice()
    .sort((a, b) => a.collectedDate.localeCompare(b.collectedDate));

  function add() {
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Geçerli tutar girin");
    start(async () => {
      const r = await addCostCollection(data.id, { amount: a, collectedDate: date || undefined, note, isPlanned: planned });
      if (r.error) { toast.error(r.error); return; }
      setAmount("");
      setNote("");
      setDate("");
      toast.success(planned ? "Planlanan tahsilat eklendi" : "Tahsilat eklendi");
      onChange();
    });
  }
  function del(id: string) {
    start(async () => {
      const r = await deleteCostCollection(id);
      if (r.error) { toast.error(r.error); return; }
      onChange();
    });
  }

  // ——— Ödeme ekstresi / hatırlatma paylaşımı ———
  const [token, setToken] = useState(data.statementToken || "");
  const [linking, startLink] = useTransition();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = token ? `${origin}/pay/${token}` : "";
  const todayISO = new Date().toISOString().slice(0, 10);

  function buildMsg(withLink: string) {
    return reminderText({
      customer: data.customer,
      firmName,
      projectName: data.name,
      sym,
      total: m.salesGrossPrice,
      collections: data.collections,
      todayISO,
      link: withLink || undefined,
    });
  }
  function ensureLink(cb: (l: string) => void) {
    if (link) return cb(link);
    startLink(async () => {
      const r = await createStatementToken(data.id);
      if (r.error || !r.token) {
        toast.error(r.error || "Link oluşturulamadı");
        return;
      }
      setToken(r.token);
      cb(`${origin}/pay/${r.token}`);
    });
  }
  function copyLink() {
    ensureLink((l) => {
      navigator.clipboard.writeText(l);
      toast.success("Ekstre linki kopyalandı");
    });
  }
  function sendWhatsApp() {
    ensureLink((l) => window.open(`https://wa.me/?text=${encodeURIComponent(buildMsg(l))}`, "_blank"));
  }
  function sendMail() {
    ensureLink((l) => {
      const subj = `${data.name} — Ödeme Bilgilendirmesi`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(buildMsg(l))}`;
    });
  }
  function downloadPdf() {
    const html = buildStatementPrintHtml({
      brand,
      firmName,
      userEmail,
      customer: data.customer,
      projectName: data.name,
      sym,
      total: m.salesGrossPrice,
      collections: data.collections,
      todayISO,
      linkUrl: link || undefined,
    });
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Açılır pencere engellendi — izin verin");
      return;
    }
    w.document.write(html);
    w.document.close();
    // HTML içindeki window.onload → otomatik yazdır (PDF olarak kaydet).
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <HandCoins className="size-4 text-primary" /> Müşteriden Tahsilat
        </p>
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center text-sm">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Satış (KDV dahil)</p>
            <p className="font-semibold tabular-nums">{sym}{fmt(m.salesGrossPrice)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Tahsil</p>
            <p className="font-semibold tabular-nums text-emerald-700">{sym}{fmt(m.collectedTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Kalan</p>
            <p className="font-semibold tabular-nums text-amber-600">{sym}{fmt(m.remainingReceivable)}</p>
          </div>
        </div>

        {/* Ödeme ekstresi / hatırlatma paylaşımı */}
        {canEdit && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Share2 className="size-3.5" /> Müşteriye Ödeme Ekstresi Gönder
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="h-8" onClick={downloadPdf}>
                <FileDown className="size-3.5" /> PDF Çıktı
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={sendWhatsApp} disabled={linking}>
                <MessageCircle className="size-3.5 text-emerald-600" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={sendMail} disabled={linking}>
                <Mail className="size-3.5 text-sky-600" /> E-posta
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={copyLink} disabled={linking}>
                {linking ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Linki Kopyala
              </Button>
            </div>
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              <strong>PDF Çıktı</strong> ile ekstreyi PDF olarak kaydedip paylaşabilirsin. WhatsApp/E-posta metin bildirimi
              gönderir; toplam borç, ödenenler ve planlanan ödemeler tarih/gün durumuyla (bugün · X gün sonra · gecikmiş) yer alır.
            </p>
          </div>
        )}

        {actualColls.length > 0 && (
          <div className="mb-3 divide-y">
            {actualColls.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium tabular-nums">{sym}{fmt(c.amount)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.collectedDate}</span>
                  {c.note && <span className="ml-1 text-xs text-muted-foreground">· {c.note}</span>}
                </div>
                {canEdit && (
                  <button onClick={() => del(c.id)} className="rounded p-1 text-destructive/70 hover:bg-destructive-soft" disabled={busy || pending}>
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {plannedColls.length > 0 && (
          <div className="mb-3 rounded-lg border border-dashed border-sky-200 bg-sky-50/40 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-700">
              <CalendarClock className="size-3.5" /> Planlanan Tahsilatlar (henüz alınmadı)
            </p>
            <div className="divide-y divide-sky-100">
              {plannedColls.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium tabular-nums text-sky-800">{sym}{fmt(c.amount)}</span>
                    <span className="ml-2 text-xs text-sky-600">{c.collectedDate} tarihinde</span>
                    {c.note && <span className="ml-1 text-xs text-muted-foreground">· {c.note}</span>}
                  </div>
                  {canEdit && (
                    <button onClick={() => del(c.id)} className="rounded p-1 text-destructive/70 hover:bg-destructive-soft" disabled={busy || pending}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[11px]">Tutar ({sym})</Label>
                <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">{planned ? "Planlanan Tarih" : "Tarih"}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-36" />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[11px]">Açıklama</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Avans / hakediş…" className="h-9" />
              </div>
              <Button size="sm" className="h-9" onClick={add} disabled={busy}>
                <Plus className="size-4" /> Ekle
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={planned} onCheckedChange={(v) => setPlanned(!!v)} />
              Planlanan (henüz tahsil edilmedi — sadece hangi tarihte ne kadar alacağımı not al)
            </label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ————————————————————————————————————————— Ortak payları
function PartnersCard({
  data,
  m,
  canEdit,
  onChange,
}: {
  data: ProjectData;
  m: ReturnType<typeof computeCostProjectMetrics>;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [rows, setRows] = useState<{ name: string; sharePercent: number }[]>(
    data.partners.length ? data.partners.map((p) => ({ name: p.name, sharePercent: p.sharePercent })) : [],
  );
  const [busy, start] = useTransition();
  const pctTotal = rows.reduce((s, r) => s + (Number(r.sharePercent) || 0), 0);

  function save() {
    if (rows.some((r) => r.name.trim()) && Math.abs(pctTotal - 100) > 0.01) {
      if (!confirm(`Pay yüzdeleri toplamı %${fmt(pctTotal, 1)} (100 değil). Yine de kaydedilsin mi?`)) return;
    }
    start(async () => {
      const r = await saveCostPartners(data.id, rows);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Ortak payları kaydedildi");
      onChange();
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users2 className="size-4 text-primary" /> Kâr Dağıtımı (Ortaklar)
          </p>
          <span className="text-xs text-muted-foreground">
            Dağıtılacak (mevcut) kâr: <strong className="text-foreground">₺{fmt(m.currentProfitTL)}</strong>
          </span>
        </div>

        {rows.length === 0 && (
          <p className="mb-3 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Ortak eklemek opsiyoneldir. Örn. %50 / %50.
          </p>
        )}

        <div className="space-y-2">
          {rows.map((r, i) => {
            const amount = m.currentProfitTL * ((Number(r.sharePercent) || 0) / 100);
            return (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={r.name}
                  onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Ortak adı"
                  className="h-9 flex-1"
                  disabled={!canEdit}
                />
                <div className="relative w-24">
                  <Input
                    type="number"
                    step="any"
                    value={r.sharePercent}
                    onChange={(e) =>
                      setRows(rows.map((x, idx) => (idx === i ? { ...x, sharePercent: parseFloat(e.target.value) || 0 } : x)))
                    }
                    className="h-9 pr-6 text-right"
                    disabled={!canEdit}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-700">₺{fmt(amount)}</span>
                {canEdit && (
                  <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="rounded p-1 text-destructive/70 hover:bg-destructive-soft">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div className="mt-3 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { name: "", sharePercent: 0 }])}>
              <Plus className="size-4" /> Ortak Ekle
            </Button>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-medium", Math.abs(pctTotal - 100) > 0.01 && rows.length ? "text-rose-600" : "text-muted-foreground")}>
                Toplam: %{fmt(pctTotal, 1)}
              </span>
              <Button size="sm" onClick={save} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Kaydet
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ————————————————————————————————————————— Proje ayarları dialog
function ProjectSettingsDialog({ data, onClose, onSaved }: { data: ProjectData; onClose: () => void; onSaved: () => void }) {
  const [busy, start] = useTransition();
  const [form, setForm] = useState({
    name: data.name,
    customer: data.customer,
    salesPrice: String(data.salesPrice),
    salesCurrency: data.salesCurrency,
    salesVatRate: String(data.salesVatRate),
    salesInvoicedAmount: String(data.salesInvoicedAmount),
    plannedCostTotal: String(data.plannedCostTotal),
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status,
    notes: data.notes,
  });

  function save() {
    if (!form.name.trim()) return toast.error("Proje adı zorunludur");
    start(async () => {
      const r = await updateCostProject(data.id, {
        name: form.name,
        customer: form.customer,
        salesPrice: parseFloat(form.salesPrice) || 0,
        salesCurrency: form.salesCurrency,
        salesVatRate: parseFloat(form.salesVatRate) || 0,
        salesInvoicedAmount: parseFloat(form.salesInvoicedAmount) || 0,
        plannedCostTotal: parseFloat(form.plannedCostTotal) || 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
        notes: form.notes,
      });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Kaydedildi");
      onClose();
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Proje Ayarları</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Proje Adı *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Müşteri</Label>
            <Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1.5">
              <Label>Satış</Label>
              <Input type="number" step="any" value={form.salesPrice} onChange={(e) => setForm({ ...form, salesPrice: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Para</Label>
              <Select value={form.salesCurrency} onValueChange={(v) => setForm({ ...form, salesCurrency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {csym(c)} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Satış KDV %</Label>
              <Input type="number" step="any" value={form.salesVatRate} onChange={(e) => setForm({ ...form, salesVatRate: e.target.value })} />
            </div>
          </div>
          <div className="rounded-lg border border-dashed p-3">
            <Label>Faturalı Satış Tutarı (KDV hariç)</Label>
            <Input
              type="number"
              step="any"
              value={form.salesInvoicedAmount}
              onChange={(e) => setForm({ ...form, salesInvoicedAmount: e.target.value })}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Satışın faturalı kısmı. Kalanı ({csym(form.salesCurrency)}
              {fmt(Math.max(0, (parseFloat(form.salesPrice) || 0) - (parseFloat(form.salesInvoicedAmount) || 0)))}) faturasız kabul edilir.
              KDV ve kurumlar vergisi yalnız faturalı kısımdan hesaplanır. Tümü faturalıysa satış tutarını yaz; tümü faturasızsa 0 bırak.
            </p>
          </div>
          <div className="rounded-lg border border-dashed p-3">
            <Label>Öngörülen Toplam Maliyet (KDV hariç)</Label>
            <Input
              type="number"
              step="any"
              value={form.plannedCostTotal}
              onChange={(e) => setForm({ ...form, plannedCostTotal: e.target.value })}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Teklifteki toplam maliyet (proje geneli sabit). Öngörülen kâr = satış − bu tutar.
              Kalem ekleyip silmek bu değeri <strong>değiştirmez</strong>; öngörü/gerçekleşen karşılaştırması hep toplam üzerinden yapılır.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Başlangıç</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "ACTIVE" | "DONE" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Devam ediyor</SelectItem>
                  <SelectItem value="DONE">Tamamlandı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notlar</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[70px]" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ————————————————————————————————————————— Ödeme yapılacak kişiler (dağıtım)
interface OwnerGroup {
  owner: string;
  iban: string; // tek IBAN varsa gösterilir; birden çoksa "" (kırılımda listelenir)
  total: number;
  paid: number;
  remaining: number;
  vendors: { name: string; iban: string; total: number; remaining: number }[];
  lineIds: string[];
  payments: { id: string; amount: number; paidDate: string; method: string; lineDesc: string; note: string }[];
}

function PaymentOwnersCard({
  lines,
  firmName,
  userEmail,
  brand,
  projectName,
  canEdit,
  onChange,
}: {
  lines: Line[];
  firmName: string;
  userEmail: string;
  brand: BrandContext;
  projectName: string;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [payGroup, setPayGroup] = useState<OwnerGroup | null>(null);
  const groups: OwnerGroup[] = useMemo(() => {
    const map = new Map<
      string,
      {
        owner: string;
        ibans: Set<string>;
        total: number;
        paid: number;
        remaining: number;
        vendors: Map<string, { total: number; remaining: number; ibans: Set<string> }>;
        lineIds: string[];
        payments: OwnerGroup["payments"];
      }
    >();
    for (const l of lines) {
      const total = lineGrossTL(l); // tedarikçiye ödenecek KDV dahil tutar
      if (total <= 0) continue;
      // Ödeme sahibi override yoksa tedarikçi varsayılır. Aynı İSİM tek satır
      // (IBAN farklı olsa da) — IBAN kırılımda gösterilir.
      const owner = (l.payAccountNameOverride || l.vendorName || "—").trim() || "—";
      // Ödeme sahibi tedarikçiden farklıysa (override), tedarikçinin IBAN'ı DEĞİL
      // ödeme sahibinin IBAN'ı kullanılır.
      const hasOverride = !!(l.payAccountNameOverride || l.payIbanOverride);
      const iban = hasOverride ? l.payIbanOverride || "" : l.vendorPayIban || "";
      const cur =
        map.get(owner) ||
        {
          owner,
          ibans: new Set<string>(),
          total: 0,
          paid: 0,
          remaining: 0,
          vendors: new Map<string, { total: number; remaining: number; ibans: Set<string> }>(),
          lineIds: [] as string[],
          payments: [] as OwnerGroup["payments"],
        };
      cur.total += total;
      cur.paid += linePaidTL(l);
      cur.remaining += Math.max(0, lineBalanceTL(l));
      cur.lineIds.push(l.id);
      if (iban) cur.ibans.add(iban);
      for (const p of l.payments) {
        cur.payments.push({ id: p.id, amount: p.amount, paidDate: p.paidDate, method: p.method, lineDesc: l.description, note: p.note });
      }
      // Alt kırılım: bu ödeme sahibi hangi tedarikçi(ler)/IBAN(lar) için ödüyor.
      const vName = (l.vendorName || "Tedarikçi belirtilmemiş").trim() || "Tedarikçi belirtilmemiş";
      const v = cur.vendors.get(vName) || { total: 0, remaining: 0, ibans: new Set<string>() };
      v.total += total;
      v.remaining += Math.max(0, lineBalanceTL(l));
      // Alt kırılımda TEDARİKÇİNİN kendi IBAN'ı gösterilir (üst satır ödeme
      // sahibinin IBAN'ı). Ödeme başkasına gitse de tedarikçinin IBAN'ı görünür.
      if (l.vendorPayIban) v.ibans.add(l.vendorPayIban);
      cur.vendors.set(vName, v);
      map.set(owner, cur);
    }
    return Array.from(map.values())
      .map((g) => ({
        owner: g.owner,
        iban: g.ibans.size === 1 ? [...g.ibans][0] : "",
        total: g.total,
        paid: g.paid,
        remaining: g.remaining,
        vendors: Array.from(g.vendors.entries()).map(([name, v]) => ({
          name,
          total: v.total,
          remaining: v.remaining,
          iban: v.ibans.size === 1 ? [...v.ibans][0] : "",
        })),
        lineIds: g.lineIds,
        payments: g.payments.sort((a, b) => b.paidDate.localeCompare(a.paidDate)),
      }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [lines]);

  const totalRemaining = groups.reduce((s, g) => s + g.remaining, 0);

  function copy(t: string) {
    navigator.clipboard.writeText((t || "").replace(/\s+/g, ""));
    toast.success("IBAN kopyalandı");
  }
  function downloadPdf() {
    const html = buildPaymentOwnersPrintHtml({
      brand,
      firmName,
      userEmail,
      projectName,
      todayISO: new Date().toISOString().slice(0, 10),
      groups,
    });
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Açılır pencere engellendi — izin verin");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  if (groups.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4 text-primary" /> Ödeme Yapılacak Kişiler
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Toplam kalan: <strong className="text-amber-600">₺{fmt(totalRemaining)}</strong>
            </span>
            <Button size="sm" variant="outline" className="h-8" onClick={downloadPdf}>
              <FileDown className="size-3.5" /> PDF Çıktı
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-1.5 text-left">Ödeme Sahibi</th>
                <th className="px-3 py-1.5 text-left">IBAN</th>
                <th className="px-3 py-1.5 text-right">Kalan / Toplam</th>
                {canEdit && <th className="px-3 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => {
                // Kırılımı yalnız anlamlıysa göster: birden çok tedarikçi veya
                // ödeme sahibi tek tedarikçiden farklı. (Aynı tedarikçi + IBAN
                // yok durumunda alt kırılım gösterme.)
                const showBreakdown =
                  g.vendors.length > 1 || (g.vendors[0] && g.vendors[0].name !== g.owner);
                return (
                  <Fragment key={i}>
                    <tr className="border-t-2 border-border bg-white hover:bg-muted/30">
                      <td className="px-3 py-2 text-[13px] font-semibold text-slate-900">{g.owner}</td>
                      <td className="px-3 py-2">
                        {g.iban ? (
                          <button
                            type="button"
                            onClick={() => copy(g.iban)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 hover:text-emerald-700"
                            title="IBAN kopyala"
                          >
                            {fmtIban(g.iban)} <Copy className="size-2.5" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        <span className="text-[11px] text-muted-foreground">kalan </span>
                        <span className="text-sm font-bold text-amber-600">₺{fmt(g.remaining)}</span>{" "}
                        <span className="text-[11px] text-muted-foreground">/ ₺{fmt(g.total)}</span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" className="h-7 px-3 text-[11px]" onClick={() => setPayGroup(g)}>
                            Öde
                          </Button>
                        </td>
                      )}
                    </tr>
                    {showBreakdown &&
                      g.vendors.map((v, vi) => (
                        <tr key={`${i}-${vi}`} className="bg-slate-50/70 text-[10.5px] text-muted-foreground">
                          <td className="px-3 py-0.5 pl-6 truncate">↳ {v.name}</td>
                          <td className="px-3 py-0.5">
                            {v.iban ? (
                              <button
                                type="button"
                                onClick={() => copy(v.iban)}
                                className="inline-flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground hover:text-emerald-700"
                                title="IBAN kopyala"
                              >
                                {fmtIban(v.iban)} <Copy className="size-2.5" />
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-0.5 text-right tabular-nums">
                            kalan <span className="font-semibold text-amber-600">₺{fmt(v.remaining)}</span>{" "}
                            <span>/ ₺{fmt(v.total)}</span>
                          </td>
                          {canEdit && <td />}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {payGroup && (
        <OwnerPayDialog group={payGroup} onClose={() => setPayGroup(null)} onSaved={onChange} />
      )}
    </Card>
  );
}

// ————————————————————————————————————————— Kalem dialog
function LineDialog({
  projectId,
  line,
  vendors,
  onVendorCreated,
  categories,
  rates,
  onClose,
  onSaved,
}: {
  projectId: string;
  line: Line | null;
  vendors: ComboVendor[];
  onVendorCreated: (v: ComboVendor) => void;
  categories: Category[];
  rates: Rates;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, start] = useTransition();
  const [fxBusy, setFxBusy] = useState(false);
  const [payDiffers, setPayDiffers] = useState(!!(line?.payAccountNameOverride || line?.payIbanOverride));
  // Ödeme sahibi de tedarikçiler arasından seçilir (elle yazılmaz). Mevcut
  // override adına eşleşen tedarikçi varsa onun id'siyle başlar.
  const [payOwnerVendorId, setPayOwnerVendorId] = useState(
    line?.payAccountNameOverride
      ? vendors.find((v) => v.name === line.payAccountNameOverride)?.id ?? ""
      : "",
  );
  const [f, setF] = useState({
    categoryId: line?.categoryId ?? "",
    description: line?.description ?? "",
    model: line?.model ?? "",
    brand: line?.brand ?? "",
    unit: line?.unit ?? "adet",
    quantity: line ? String(line.quantity) : "1",
    unitPrice: line ? String(line.unitPrice) : "",
    currency: line?.currency ?? "TRY",
    exchangeRate: line ? String(line.exchangeRate) : "1",
    vatRate: line ? String(line.vatRate) : "20",
    isInvoiced: line?.isInvoiced ?? true,
    vendorId: line?.vendorId ?? "",
    payAccountName: line?.payAccountNameOverride ?? "",
    payIban: line?.payIbanOverride ?? "",
    link: line?.link ?? "",
    plannedAmount: line?.plannedAmount == null ? "" : String(line.plannedAmount),
    paidAmount: "", // yalnız yeni kalemde: şimdiye kadar ödenen
    paidDate: "",
  });

  const qty = parseFloat(f.quantity) || 0;
  const price = parseFloat(f.unitPrice) || 0;
  const rate = f.currency === "TRY" ? 1 : parseFloat(f.exchangeRate) || 0;
  const netTL = qty * price * rate; // girilen birim fiyat KDV hariç
  // Faturasız kalemde KDV yoktur.
  const vatRatePreview = f.isInvoiced ? parseFloat(f.vatRate) || 0 : 0;
  const vatTL = netTL * (vatRatePreview / 100);
  const grossTL = netTL + vatTL;

  function setCurrency(c: string) {
    let er = f.exchangeRate;
    if (c === "TRY") er = "1";
    else if (c === "USD") er = String(rates.usd || 0);
    else if (c === "EUR") er = String(rates.eur || 0);
    setF({ ...f, currency: c, exchangeRate: er });
  }

  async function pullFx() {
    setFxBusy(true);
    try {
      const res = await fetch("/api/fx/latest", { cache: "no-store" });
      const d = await res.json();
      const er = f.currency === "USD" ? d.usd : f.currency === "EUR" ? d.eur : 1;
      setF((p) => ({ ...p, exchangeRate: String(er) }));
      toast.success(`Kur güncellendi (${d.source})`);
    } catch {
      toast.error("Kur alınamadı");
    } finally {
      setFxBusy(false);
    }
  }

  function onVendorSelect(v: ComboVendor | null) {
    // Ödeme sahibi varsayılan olarak tedarikçidir; override yalnız "farklı"
    // işaretliyken sorulur.
    setF((p) => ({ ...p, vendorId: v?.id ?? "", isInvoiced: v ? v.defaultInvoiced : p.isInvoiced }));
  }

  function save() {
    if (!f.description.trim()) return toast.error("Tanım zorunludur");
    const input: CostLineInput = {
      categoryId: f.categoryId || null,
      description: f.description,
      model: f.model,
      brand: f.brand,
      unit: f.unit,
      quantity: qty,
      unitPrice: price,
      currency: f.currency,
      exchangeRate: rate,
      vatRate: parseFloat(f.vatRate) || 0,
      isInvoiced: f.isInvoiced,
      vendorId: f.vendorId || null,
      // Ödeme sahibi tedarikçiyle aynıysa override boş bırakılır (varsayılan = tedarikçi).
      payAccountNameOverride: payDiffers ? f.payAccountName : "",
      payIbanOverride: payDiffers ? f.payIban : "",
      link: f.link,
      plannedAmount: f.plannedAmount === "" ? null : parseFloat(f.plannedAmount) || 0,
      paidAmount: !line && f.paidAmount ? parseFloat(f.paidAmount) || 0 : undefined,
      paidDate: !line && f.paidAmount ? f.paidDate || undefined : undefined,
    };
    start(async () => {
      const r = line ? await updateCostLine(line.id, input) : await createCostLine(projectId, input);
      if (r.error) { toast.error(r.error); return; }
      toast.success(line ? "Kalem güncellendi" : "Kalem eklendi");
      onClose();
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{line ? "Kalemi Düzenle" : "Yeni Kalem"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tanım *</Label>
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Örn. Solar Panel" />
            <p className="text-[11px] text-muted-foreground">Kod, seçilen kategoriye göre otomatik verilir (örn. A.4.1).</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={f.categoryId || "none"} onValueChange={(v) => setF({ ...f, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Yok —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Marka</Label>
              <Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Nexans" />
            </div>
            <div className="space-y-1.5">
              <Label>Tip / Model</Label>
              <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="1x6 H1Z2Z2-K" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Miktar</Label>
              <Input type="number" step="any" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Birim</Label>
              <Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="adet" />
            </div>
            <div className="space-y-1.5">
              <Label>Birim Fiyat (KDV hariç)</Label>
              <Input type="number" step="any" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Para Birimi</Label>
              <Select value={f.currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {csym(c)} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {f.currency !== "TRY" && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Kur (1 {f.currency} = ? ₺)</Label>
                <Input type="number" step="any" value={f.exchangeRate} onChange={(e) => setF({ ...f, exchangeRate: e.target.value })} />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={pullFx} disabled={fxBusy}>
                <RefreshCw className={cn("size-3.5", fxBusy && "animate-spin")} /> Güncel kur
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>KDV %</Label>
              <Input type="number" step="any" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Checkbox checked={f.isInvoiced} onCheckedChange={(v) => setF({ ...f, isInvoiced: !!v })} />
              Faturalı
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>Tedarikçi</Label>
            <SupplierCombobox
              vendors={vendors}
              value={f.vendorId}
              onSelect={onVendorSelect}
              onCreated={onVendorCreated}
            />
          </div>

          {/* Ödeme sahibi varsayılan = tedarikçi. Yalnız "farklı" işaretliyse
              ayrı isim + IBAN sorulur (ödeme başka birine gidiyorsa). */}
          <div className="rounded-lg border border-dashed p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={payDiffers} onCheckedChange={(v) => setPayDiffers(!!v)} />
              <span className="flex items-center gap-1.5">
                <Landmark className="size-3.5 text-muted-foreground" /> Ödeme sahibi tedarikçiden farklı
              </span>
            </label>
            {!payDiffers ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Ödeme tedarikçiye (kayıtlı IBAN'ına) yapılacak kabul edilir.
              </p>
            ) : (
              <div className="mt-3 space-y-1.5">
                <Label>Ödeme Sahibi (tedarikçilerden seç)</Label>
                <SupplierCombobox
                  vendors={vendors}
                  value={payOwnerVendorId}
                  onSelect={(v) => {
                    setPayOwnerVendorId(v?.id ?? "");
                    setF((p) => ({
                      ...p,
                      payAccountName: v?.name ?? "",
                      payIban: v?.payIban ?? "",
                    }));
                  }}
                  onCreated={onVendorCreated}
                />
                {f.payAccountName ? (
                  <p className="text-[11px] text-muted-foreground">
                    Seçili: <strong>{f.payAccountName}</strong>
                    {f.payIban ? ` · ${f.payIban}` : " · IBAN yok (tedarikçiyi düzenleyip ekleyin)"}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Ödeme sahibini kayıtlı tedarikçilerden seçin; yoksa &quot;kaydet&quot; ile ekleyin.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Fatura / Dekont Linki (ops.)</Label>
            <Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://…" />
          </div>

          {!line && (
            <div className="rounded-lg border border-dashed p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ödenen Tutar (varsa)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={f.paidAmount}
                    onChange={(e) => setF({ ...f, paidAmount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ödeme Tarihi</Label>
                  <Input type="date" value={f.paidDate} onChange={(e) => setF({ ...f, paidDate: e.target.value })} />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Bu kaleme şimdiye kadar ödediğin tutar. Boş/az bırakırsan kalanı &quot;Ödeme Yapılacak Kişiler&quot;den
                işlersin. Kalan: <strong>₺{fmt(Math.max(0, grossTL - (parseFloat(f.paidAmount) || 0)))}</strong>
              </p>
            </div>
          )}

          <div className="space-y-1 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">TL Toplam (KDV hariç)</span>
              <span className="font-semibold tabular-nums">₺{fmt(netTL)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>KDV (%{fmt(vatRatePreview)})</span>
              <span className="tabular-nums">₺{fmt(vatTL)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1 font-bold">
              <span>KDV dahil (ödenecek)</span>
              <span className="text-base tabular-nums text-primary">₺{fmt(grossTL)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} {line ? "Güncelle" : "Ekle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ————————————————————————————————————————— Ödeme dialog (ödeme sahibi bazında)
function OwnerPayDialog({
  group,
  onClose,
  onSaved,
}: {
  group: OwnerGroup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  function add() {
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Geçerli tutar girin");
    start(async () => {
      const r = await allocateOwnerPayment({
        lineIds: group.lineIds,
        amount: a,
        paidDate: date || undefined,
        note,
      });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Ödeme kaydedildi");
      onSaved();
      onClose();
    });
  }
  function del(id: string) {
    start(async () => {
      const r = await deleteCostPayment(id);
      if (r.error) { toast.error(r.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ödeme — {group.owner}</DialogTitle>
          <DialogDescription>{group.iban || "IBAN kayıtlı değil"}</DialogDescription>
        </DialogHeader>

        <div className="mb-1 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center text-sm">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Ödenecek</p>
            <p className="font-semibold tabular-nums">₺{fmt(group.total)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Ödenen</p>
            <p className="font-semibold tabular-nums text-emerald-700">₺{fmt(group.paid)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Kalan</p>
            <p className="font-semibold tabular-nums text-amber-600">₺{fmt(group.remaining)}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Girilen tutar bu ödeme sahibinin kalemlerine (kalan bakiyeye göre) otomatik dağıtılır.
        </p>

        {group.payments.length > 0 && (
          <div className="max-h-40 divide-y overflow-y-auto rounded-lg border">
            {group.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium tabular-nums">₺{fmt(p.amount)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.paidDate} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{p.lineDesc}{p.note ? ` · ${p.note}` : ""}</span>
                </div>
                <button onClick={() => del(p.id)} className="rounded p-1 text-destructive/70 hover:bg-destructive-soft" disabled={busy}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Tutar (₺)</Label>
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tarih</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px]">Açıklama</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setAmount(String(Math.max(0, group.remaining)))}>
              Kalanı yaz
            </Button>
            <Button size="sm" onClick={add} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ödeme Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
