"use client";

import { useState, useTransition, useMemo } from "react";
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
  CreditCard,
  Users2,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Receipt,
  Settings2,
  HandCoins,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  computeCostProjectMetrics,
  lineNetTL,
  lineVatTL,
  lineGrossTL,
  linePaidTL,
  lineBalanceTL,
  linePayStatus,
  lineVariance,
  csym,
  PAYMENT_METHOD_LABELS,
  type Rates,
} from "@/lib/cost-control";
import {
  updateCostProject,
  deleteCostProject,
  createCostLine,
  updateCostLine,
  deleteCostLine,
  addCostPayment,
  deleteCostPayment,
  addCostCollection,
  deleteCostCollection,
  saveCostPartners,
  type CostLineInput,
} from "@/app/actions/cost-control";

function fmt(n: number, d = 0) {
  return formatNumber(n, d);
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
  payAccountNameOverride: string;
  payIbanOverride: string;
  plannedAmount: number | null;
  payments: Payment[];
}
interface Collection {
  id: string;
  amount: number;
  collectedDate: string;
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
  status: "ACTIVE" | "DONE";
  startDate: string;
  endDate: string;
  notes: string;
  sourceProjectId: string | null;
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
  canEdit,
}: {
  data: ProjectData;
  vendors: Vendor[];
  categories: Category[];
  rates: Rates;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editProject, setEditProject] = useState(false);
  const [lineDialog, setLineDialog] = useState<{ open: boolean; line: Line | null }>({ open: false, line: null });
  const [payDialog, setPayDialog] = useState<{ open: boolean; line: Line | null }>({ open: false, line: null });

  const m = useMemo(
    () =>
      computeCostProjectMetrics({
        salesPrice: data.salesPrice,
        salesCurrency: data.salesCurrency,
        lines: data.lines,
        collections: data.collections,
        partners: data.partners,
        rates,
      }),
    [data, rates],
  );

  function refresh() {
    router.refresh();
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
          label="Satış Fiyatı"
          value={`${m.salesSym}${fmt(m.salesPrice)}`}
          sub={data.salesCurrency !== "TRY" ? `≈ ₺${fmt(m.salesPriceTL)}` : undefined}
          tone="sky"
        />
        <Kpi
          label="Gerçekleşen Maliyet"
          value={`₺${fmt(m.actualNetTL)}`}
          sub={`KDV dahil ₺${fmt(m.actualGrossTL)}`}
          tone="slate"
        />
        <Kpi
          label="Kâr (TL, net)"
          value={`₺${fmt(m.profitTL)}`}
          sub={`Marj %${fmt(m.profitMarginPct, 1)}`}
          tone={m.profitTL >= 0 ? "emerald" : "rose"}
          icon={m.profitTL >= 0 ? "up" : "down"}
        />
        <Kpi
          label="Kalan Alacak"
          value={`${m.salesSym}${fmt(m.remainingReceivable)}`}
          sub={`Tahsil: ${m.salesSym}${fmt(m.collectedTotal)}`}
          tone="amber"
        />
        {m.hasPlanned && (
          <>
            <Kpi label="Planlanan Maliyet" value={`₺${fmt(m.plannedTotalTL)}`} tone="slate" />
            <Kpi
              label="Varyans (Gerçek − Plan)"
              value={`${m.varianceTL > 0 ? "+" : ""}₺${fmt(m.varianceTL)}`}
              tone={m.varianceTL > 0 ? "rose" : "emerald"}
              sub={m.varianceTL > 0 ? "Bütçe aşımı" : "Bütçe içinde"}
            />
          </>
        )}
        <Kpi label="Satıcılara Ödenen" value={`₺${fmt(m.paidTL)}`} tone="slate" />
        <Kpi
          label="Satıcılara Kalan"
          value={`₺${fmt(m.payableBalanceTL)}`}
          tone={m.payableBalanceTL > 0.5 ? "amber" : "emerald"}
        />
      </div>

      {/* Kalemler */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4 text-primary" /> Harcama Kalemleri
              <span className="text-xs font-normal text-muted-foreground">({data.lines.length})</span>
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => setLineDialog({ open: true, line: null })}>
                <Plus className="size-4" /> Kalem Ekle
              </Button>
            )}
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
                    <th className="px-2 py-2 text-right">TL Toplam</th>
                    <th className="px-2 py-2 text-center">KDV</th>
                    <th className="px-2 py-2 text-right">Planlanan</th>
                    <th className="px-2 py-2 text-right">Varyans</th>
                    <th className="px-2 py-2 text-left">Satıcı</th>
                    <th className="px-2 py-2 text-center">Ödeme</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.lines.map((l) => {
                    const net = lineNetTL(l);
                    const variance = lineVariance(l);
                    const status = linePayStatus(l);
                    const paid = linePaidTL(l);
                    return (
                      <tr key={l.id} className="hover:bg-muted/30">
                        <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">{l.code || "—"}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">{l.description}</span>
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
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">₺{fmt(net)}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">%{fmt(l.vatRate)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {l.plannedAmount == null ? "—" : `₺${fmt(l.plannedAmount)}`}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-2 py-2 text-right tabular-nums",
                            variance == null ? "text-muted-foreground" : variance > 0 ? "text-rose-600" : "text-emerald-600",
                          )}
                        >
                          {variance == null ? "—" : `${variance > 0 ? "+" : ""}₺${fmt(variance)}`}
                        </td>
                        <td className="px-2 py-2 text-left text-muted-foreground">{l.vendorName || "—"}</td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setPayDialog({ open: true, line: l })}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                              status === "paid"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : status === "partial"
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                            )}
                            title="Ödeme ekle / gör"
                          >
                            <CreditCard className="size-3" />
                            {status === "paid" ? "Ödendi" : status === "partial" ? `%${fmt((paid / (net || 1)) * 100)}` : "Ödenmedi"}
                          </button>
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
                      Toplam (net)
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">₺{fmt(m.actualNetTL)}</td>
                    <td className="px-2 py-2 text-center text-[11px] text-muted-foreground">KDV ₺{fmt(m.actualVatTL)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {m.hasPlanned ? `₺${fmt(m.plannedTotalTL)}` : "—"}
                    </td>
                    <td colSpan={4} />
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
          canEdit={canEdit}
          pending={pending}
          onChange={refresh}
        />
      </div>

      <PartnersCard data={data} m={m} canEdit={canEdit} onChange={refresh} />

      {/* Dialoglar */}
      {editProject && (
        <ProjectSettingsDialog data={data} onClose={() => setEditProject(false)} onSaved={refresh} />
      )}
      {lineDialog.open && (
        <LineDialog
          projectId={data.id}
          line={lineDialog.line}
          vendors={vendors}
          categories={categories}
          rates={rates}
          onClose={() => setLineDialog({ open: false, line: null })}
          onSaved={refresh}
        />
      )}
      {payDialog.open && payDialog.line && (
        <PaymentDialog
          line={payDialog.line}
          canEdit={canEdit}
          onClose={() => setPayDialog({ open: false, line: null })}
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

// ————————————————————————————————————————— Tahsilat
function CollectionsCard({
  data,
  m,
  canEdit,
  pending,
  onChange,
}: {
  data: ProjectData;
  m: ReturnType<typeof computeCostProjectMetrics>;
  canEdit: boolean;
  pending: boolean;
  onChange: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  const sym = m.salesSym;

  function add() {
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Geçerli tutar girin");
    start(async () => {
      const r = await addCostCollection(data.id, { amount: a, collectedDate: date || undefined, note });
      if (r.error) { toast.error(r.error); return; }
      setAmount("");
      setNote("");
      setDate("");
      toast.success("Tahsilat eklendi");
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

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <HandCoins className="size-4 text-primary" /> Müşteriden Tahsilat
        </p>
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center text-sm">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Satış</p>
            <p className="font-semibold tabular-nums">{sym}{fmt(m.salesPrice)}</p>
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

        {data.collections.length > 0 && (
          <div className="mb-3 divide-y">
            {data.collections.map((c) => (
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

        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[11px]">Tutar ({sym})</Label>
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tarih</Label>
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
            Dağıtılacak kâr: <strong className="text-foreground">₺{fmt(m.profitTL)}</strong>
          </span>
        </div>

        {rows.length === 0 && (
          <p className="mb-3 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Ortak eklemek opsiyoneldir. Örn. %50 / %50.
          </p>
        )}

        <div className="space-y-2">
          {rows.map((r, i) => {
            const amount = m.profitTL * ((Number(r.sharePercent) || 0) / 100);
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

// ————————————————————————————————————————— Kalem dialog
function LineDialog({
  projectId,
  line,
  vendors,
  categories,
  rates,
  onClose,
  onSaved,
}: {
  projectId: string;
  line: Line | null;
  vendors: Vendor[];
  categories: Category[];
  rates: Rates;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, start] = useTransition();
  const [fxBusy, setFxBusy] = useState(false);
  const [f, setF] = useState({
    categoryId: line?.categoryId ?? "",
    code: line?.code ?? "",
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
    plannedAmount: line?.plannedAmount == null ? "" : String(line.plannedAmount),
  });

  const qty = parseFloat(f.quantity) || 0;
  const price = parseFloat(f.unitPrice) || 0;
  const rate = f.currency === "TRY" ? 1 : parseFloat(f.exchangeRate) || 0;
  const netTL = qty * price * rate;

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

  function onVendor(id: string) {
    const v = vendors.find((x) => x.id === id);
    setF((p) => ({ ...p, vendorId: id, isInvoiced: v ? v.defaultInvoiced : p.isInvoiced }));
  }

  function save() {
    if (!f.description.trim()) return toast.error("Tanım zorunludur");
    const input: CostLineInput = {
      categoryId: f.categoryId || null,
      code: f.code,
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
      plannedAmount: f.plannedAmount === "" ? null : parseFloat(f.plannedAmount) || 0,
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tanım *</Label>
              <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Örn. Solar Panel" />
            </div>
            <div className="space-y-1.5">
              <Label>Kod</Label>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="A.1.1" />
            </div>
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
              <Label>Birim Fiyat</Label>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>KDV %</Label>
              <Input type="number" step="any" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Planlanan (₺, ops.)</Label>
              <Input type="number" step="any" value={f.plannedAmount} onChange={(e) => setF({ ...f, plannedAmount: e.target.value })} placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label>Satıcı</Label>
              <Select value={f.vendorId || "none"} onValueChange={(v) => onVendor(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Yok —</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.isInvoiced} onCheckedChange={(v) => setF({ ...f, isInvoiced: !!v })} />
            Faturalı
          </label>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">TL Toplam (net)</span>
            <span className="text-base font-bold tabular-nums">₺{fmt(netTL)}</span>
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

// ————————————————————————————————————————— Ödeme dialog (kalem bazında)
function PaymentDialog({
  line,
  canEdit,
  onClose,
  onSaved,
}: {
  line: Line;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("HAVALE");
  const [note, setNote] = useState("");

  const net = lineNetTL(line);
  const paid = linePaidTL(line);
  const balance = lineBalanceTL(line);

  function add() {
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Geçerli tutar girin");
    start(async () => {
      const r = await addCostPayment(line.id, { amount: a, paidDate: date || undefined, method, note });
      if (r.error) { toast.error(r.error); return; }
      setAmount("");
      setNote("");
      setDate("");
      toast.success("Ödeme eklendi");
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

  const payAcc = line.payAccountNameOverride || "";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ödeme — {line.description}</DialogTitle>
          <DialogDescription>
            {line.vendorName ? `Satıcı: ${line.vendorName}` : "Satıcı seçilmemiş"}
            {payAcc && ` · Hesap: ${payAcc}`}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-1 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center text-sm">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">TL Toplam</p>
            <p className="font-semibold tabular-nums">₺{fmt(net)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Ödenen</p>
            <p className="font-semibold tabular-nums text-emerald-700">₺{fmt(paid)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Kalan</p>
            <p className="font-semibold tabular-nums text-amber-600">₺{fmt(balance)}</p>
          </div>
        </div>

        {line.payments.length > 0 && (
          <div className="max-h-40 divide-y overflow-y-auto">
            {line.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium tabular-nums">₺{fmt(p.amount)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.paidDate} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </span>
                  {p.note && <span className="ml-1 text-xs text-muted-foreground">· {p.note}</span>}
                </div>
                {canEdit && (
                  <button onClick={() => del(p.id)} className="rounded p-1 text-destructive/70 hover:bg-destructive-soft" disabled={busy}>
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
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
              <div className="space-y-1">
                <Label className="text-[11px]">Yöntem</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Açıklama</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setAmount(String(Math.max(0, balance)))}>
                Kalanı yaz
              </Button>
              <Button size="sm" onClick={add} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ödeme Ekle
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
