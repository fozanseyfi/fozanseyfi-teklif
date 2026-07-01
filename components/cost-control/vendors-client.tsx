"use client";

import { useState, useMemo, useTransition } from "react";
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
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Users2,
  Search,
  Loader2,
  Landmark,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { createVendor, updateVendor, deleteVendor, type VendorInput } from "@/app/actions/cost-control";

function fmt(n: number, d = 0) {
  return formatNumber(n, d);
}

interface VendorRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  taxNo: string;
  defaultInvoiced: boolean;
  payAccountName: string;
  payIban: string;
  bank: string;
  notes: string;
  lineCount: number;
  projectCount: number;
  totalNetTL: number;
  totalPaidTL: number;
}

export function VendorsClient({ vendors, canEdit }: { vendors: VendorRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; vendor: VendorRow | null }>({ open: false, vendor: null });
  const [busy, start] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.payAccountName.toLowerCase().includes(s) ||
        v.payIban.toLowerCase().includes(s) ||
        v.email.toLowerCase().includes(s),
    );
  }, [q, vendors]);

  function del(v: VendorRow) {
    if (!confirm(`"${v.name}" silinsin mi? Kalemlerdeki satıcı bağlantısı boşalır (kalemler silinmez).`)) return;
    start(async () => {
      const r = await deleteVendor(v.id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Satıcı silindi");
      router.refresh();
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Kopyalandı");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cost-control" aria-label="Geri">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Users2 className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Satıcılar</h1>
            <p className="text-sm text-muted-foreground">Ödeme hesapları ve geçmiş — {vendors.length} satıcı</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setDialog({ open: true, vendor: null })}>
            <Plus className="size-4" /> Yeni Satıcı
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, hesap adı, IBAN ara…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {vendors.length === 0 ? "Henüz satıcı yok." : "Eşleşen satıcı yok."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((v) => (
            <Card key={v.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[v.phone, v.email].filter(Boolean).join(" · ") || "İletişim yok"}
                    </p>
                  </div>
                  <Badge variant="outline" className={v.defaultInvoiced ? "border-sky-300 bg-sky-50 text-sky-700" : "border-amber-300 bg-amber-50 text-amber-700"}>
                    {v.defaultInvoiced ? "Faturalı" : "Faturasız"}
                  </Badge>
                </div>

                {(v.payAccountName || v.payIban) && (
                  <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
                    <p className="flex items-center gap-1.5 font-medium text-slate-700">
                      <Landmark className="size-3.5" /> Ödeme Hesabı
                    </p>
                    {v.payAccountName && <p className="mt-1 text-slate-600">{v.payAccountName}</p>}
                    {v.payIban && (
                      <button onClick={() => copy(v.payIban)} className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-emerald-700">
                        {v.payIban} <Copy className="size-3" />
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Proje</p>
                    <p className="font-semibold">{v.projectCount}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Toplam (net)</p>
                    <p className="font-semibold tabular-nums">₺{fmt(v.totalNetTL)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Ödenen</p>
                    <p className="font-semibold tabular-nums text-emerald-700">₺{fmt(v.totalPaidTL)}</p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex justify-end gap-1 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, vendor: v })}>
                      <Pencil className="size-3.5" /> Düzenle
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => del(v)} className="text-destructive hover:bg-destructive-soft" disabled={busy}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog.open && (
        <VendorDialog
          vendor={dialog.vendor}
          onClose={() => setDialog({ open: false, vendor: null })}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function VendorDialog({ vendor, onClose, onSaved }: { vendor: VendorRow | null; onClose: () => void; onSaved: () => void }) {
  const [busy, start] = useTransition();
  const [f, setF] = useState<VendorInput>({
    name: vendor?.name ?? "",
    email: vendor?.email ?? "",
    phone: vendor?.phone ?? "",
    taxNo: vendor?.taxNo ?? "",
    defaultInvoiced: vendor?.defaultInvoiced ?? true,
    payAccountName: vendor?.payAccountName ?? "",
    payIban: vendor?.payIban ?? "",
    bank: vendor?.bank ?? "",
    notes: vendor?.notes ?? "",
  });

  function save() {
    if (!f.name?.trim()) return toast.error("Satıcı adı zorunludur");
    start(async () => {
      const r = vendor ? await updateVendor(vendor.id, f) : await createVendor(f);
      if (r.error) { toast.error(r.error); return; }
      toast.success(vendor ? "Güncellendi" : "Satıcı eklendi");
      onClose();
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vendor ? "Satıcıyı Düzenle" : "Yeni Satıcı"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ad / Unvan *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-posta</Label>
              <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vergi No</Label>
              <Input value={f.taxNo} onChange={(e) => setF({ ...f, taxNo: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Checkbox checked={f.defaultInvoiced} onCheckedChange={(v) => setF({ ...f, defaultInvoiced: !!v })} />
              Varsayılan faturalı
            </label>
          </div>
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Landmark className="size-3.5" /> Ödeme Hesabı (satıcıdan farklı olabilir)
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Hesap Adı</Label>
                <Input value={f.payAccountName} onChange={(e) => setF({ ...f, payAccountName: e.target.value })} placeholder="Örn. Burak Kıran" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>IBAN</Label>
                  <Input value={f.payIban} onChange={(e) => setF({ ...f, payIban: e.target.value })} placeholder="TR.." />
                </div>
                <div className="space-y-1.5">
                  <Label>Banka</Label>
                  <Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Not</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="min-h-[60px]" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
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
