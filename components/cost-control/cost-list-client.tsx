"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Plus,
  Download,
  Search,
  TrendingUp,
  TrendingDown,
  Users2,
  ArrowRight,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { plannedStatus, trDate } from "@/lib/cost-control-statement";
import {
  createCostProject,
  createCostProjectFromQuote,
  type CostProjectCard,
  type ImportableQuote,
  type UpcomingCollection,
} from "@/app/actions/cost-control";

function fmt(n: number, d = 0) {
  return formatNumber(n, d);
}

export function CostListClient({
  projects,
  importable,
  upcoming,
}: {
  projects: CostProjectCard[];
  importable: ImportableQuote[];
  upcoming: UpcomingCollection[];
}) {
  const router = useRouter();
  const todayISO = new Date().toISOString().slice(0, 10);
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(s) || p.customer.toLowerCase().includes(s),
    );
  }, [q, projects]);

  // Portföy özeti
  const totals = useMemo(() => {
    let sales = 0,
      cost = 0,
      profit = 0,
      recv = 0,
      pay = 0;
    for (const p of projects) {
      // Satış farklı para biriminde olabilir; kart özetinde TL yaklaşmak yerine
      // yalnız TL bazlı maliyet/kâr toplarız (satışları toplamıyoruz para karışmasın).
      cost += p.actualGrossTL;
      profit += p.currentProfitTL;
      pay += p.payableBalanceTL;
    }
    return { sales, cost, profit, recv, pay };
  }, [projects]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden border-emerald-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Wallet className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                  Maliyet Kontrol
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Proje Maliyet Takibi
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Satış, gerçekleşen maliyet, kâr, tahsilat ve tedarikçi ödemelerini tek yerde izle.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/suppliers">
                  <Users2 className="size-4" /> Tedarikçiler
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} disabled={importable.length === 0}>
                <Download className="size-4" /> Tekliften Oluştur
              </Button>
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="size-4" /> Yeni Maliyet Projesi
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portföy KPI */}
      {projects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniKpi label="Toplam Gerçekleşen Maliyet (KDV dahil)" value={`₺${fmt(totals.cost)}`} tone="slate" />
          <MiniKpi
            label="Toplam Vergi Öncesi Kâr (VÖK)"
            value={`₺${fmt(totals.profit)}`}
            tone={totals.profit >= 0 ? "emerald" : "rose"}
          />
          <MiniKpi label="Tedarikçilere Kalan Ödeme" value={`₺${fmt(totals.pay)}`} tone="amber" />
        </div>
      )}

      {/* Planlanan tahsilatlar */}
      {upcoming.length > 0 && (
        <Card className="overflow-hidden border-sky-200">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-sky-50/60 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                <CalendarClock className="size-4" /> Planlanan Tahsilatlar
                <span className="text-xs font-normal text-sky-600">({upcoming.length})</span>
              </p>
              <span className="text-xs text-sky-700">
                Toplam kalan planlanan:{" "}
                <strong>
                  {upcoming[0]?.salesSym ?? "₺"}
                  {fmt(upcoming.reduce((s, u) => s + u.amount, 0))}
                </strong>
              </span>
            </div>
            <div className="divide-y">
              {upcoming.map((u) => {
                const st = plannedStatus(u.date, todayISO);
                return (
                  <Link
                    key={u.id}
                    href={`/cost-control/${u.projectId}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{u.projectName}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.customer || "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={
                          st.tone === "overdue"
                            ? "text-xs font-semibold text-rose-600"
                            : st.tone === "today"
                              ? "text-xs font-semibold text-amber-600"
                              : "text-xs text-slate-500"
                        }
                      >
                        {trDate(u.date)} · {st.label}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {u.salesSym}
                        {fmt(u.amount)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Proje veya müşteri ara…"
          className="pl-9"
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wallet className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              {projects.length === 0
                ? "Henüz maliyet projesi yok. Yeni bir proje oluştur veya tekliften içeri al."
                : "Aramanla eşleşen proje yok."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => (
            <CostCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importable={importable}
        onDone={(id) => router.push(`/cost-control/${id}`)}
      />
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "rose" | "amber" }) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "amber"
          ? "text-amber-600"
          : "text-slate-900";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function CostCard({ p }: { p: CostProjectCard }) {
  const curProfitPos = p.currentProfitTL >= 0;
  return (
    <Link href={`/cost-control/${p.id}`} className="group block">
      <Card className="h-full transition-all hover:border-emerald-300 hover:shadow-md">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.customer || "Müşteri belirtilmemiş"}</p>
            </div>
            <Badge
              variant="outline"
              className={
                p.status === "DONE"
                  ? "shrink-0 border-slate-300 bg-slate-100 text-slate-600"
                  : "shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700"
              }
            >
              {p.status === "DONE" ? "Tamamlandı" : "Devam"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Metric label="Satış" value={`${p.salesSym}${fmt(p.salesPrice)}`} />
            <Metric label="Maliyet (KDV dahil)" value={`₺${fmt(p.actualGrossTL)}`} />
            <Metric
              label="VÖK (TL)"
              value={`₺${fmt(p.currentProfitTL)}`}
              accent={curProfitPos ? "emerald" : "rose"}
              icon={curProfitPos ? "up" : "down"}
            />
            <Metric label="Kalan Alacak" value={`${p.salesSym}${fmt(p.remainingReceivable)}`} accent="amber" />
          </div>

          <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="size-3" /> {p.lineCount} kalem
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100">
              Aç <ArrowRight className="size-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "rose" | "amber";
  icon?: "up" | "down";
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "rose"
        ? "text-rose-600"
        : accent === "amber"
          ? "text-amber-600"
          : "text-slate-900";
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`flex items-center gap-1 truncate font-semibold tabular-nums ${cls}`}>
        {icon === "up" && <TrendingUp className="size-3.5" />}
        {icon === "down" && <TrendingDown className="size-3.5" />}
        {value}
      </p>
    </div>
  );
}

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: "",
    customer: "",
    salesPrice: "",
    salesCurrency: "TRY",
    startDate: "",
    endDate: "",
  });

  function submit() {
    if (!form.name.trim()) {
      toast.error("Proje adı zorunludur");
      return;
    }
    start(async () => {
      const r = await createCostProject({
        name: form.name,
        customer: form.customer,
        salesPrice: parseFloat(form.salesPrice) || 0,
        salesCurrency: form.salesCurrency,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Maliyet projesi oluşturuldu");
      onOpenChange(false);
      if (r.id) router.push(`/cost-control/${r.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Maliyet Projesi</DialogTitle>
          <DialogDescription>Satış fiyatını gir; kalemleri sonra ekleyeceksin.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Proje Adı *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Örn. Çimsa GES Sahası" />
          </div>
          <div className="space-y-1.5">
            <Label>Müşteri</Label>
            <Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Müşteri adı" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Satış Fiyatı</Label>
              <Input type="number" step="any" value={form.salesPrice} onChange={(e) => setForm({ ...form, salesPrice: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Para Birimi</Label>
              <Select value={form.salesCurrency} onValueChange={(v) => setForm({ ...form, salesCurrency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">₺ TRY</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Başlangıç</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Oluştur
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  importable,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  importable: ImportableQuote[];
  onDone: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return importable;
    return importable.filter((p) => p.name.toLowerCase().includes(s) || p.customer.toLowerCase().includes(s));
  }, [q, importable]);

  function pick(id: string) {
    start(async () => {
      const r = await createCostProjectFromQuote(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Teklif maliyet kontrolüne alındı");
      onOpenChange(false);
      if (r.id) onDone(r.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tekliften Maliyet Projesi Oluştur</DialogTitle>
          <DialogDescription>
            Malzeme &amp; Hizmet tekliflerinde kalemler <strong>planlanan bütçe</strong> olarak içeri alınır;
            gerçekleşeni sonra düzenlersin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Teklif ara…" className="pl-9" />
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Teklif bulunamadı.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => pick(p.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.customer || "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {p.kind === "MATERIAL_SERVICE" ? `${p.itemCount} kalem` : "Anahtar Teslim"}
                    </Badge>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
