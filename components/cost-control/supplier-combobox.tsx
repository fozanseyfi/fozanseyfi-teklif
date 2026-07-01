"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ChevronDown, Truck, X, CheckCircle2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createVendor } from "@/app/actions/cost-control";

export interface ComboVendor {
  id: string;
  name: string;
  defaultInvoiced: boolean;
  payIban: string;
  payAccountName: string;
}

/**
 * Tedarikçi combobox'ı — müşteri seçici mantığıyla aynı. En az 3 harf yazınca
 * kayıtlı tedarikçiler süzülür; seçilebilir. Kayıtlı değilse "Kaydet" ile açılan
 * pencerede bilgiler sorulur, DB'ye kaydedilir ve seçilir. (Ödeme hesabı burada
 * DEĞİL, kalem seviyesinde "Ödeme Sahibi" olarak sorulur.)
 */
export function SupplierCombobox({
  vendors,
  value,
  onSelect,
  onCreated,
}: {
  vendors: ComboVendor[];
  value: string; // vendorId
  onSelect: (v: ComboVendor | null) => void;
  onCreated: (v: ComboVendor) => void;
}) {
  const selected = vendors.find((v) => v.id === value) || null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const canSearch = q.length >= 3;
  const filtered = canSearch ? vendors.filter((v) => v.name.toLowerCase().includes(q)) : [];

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tedarikçi ara (en az 3 harf)…"
          className="pl-9 pr-9"
        />
        {selected ? (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2 flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label="Temizle"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-60 overflow-y-auto overflow-hidden rounded-md border bg-popover shadow-lg">
          {!canSearch ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Aramak için en az 3 harf yazın…</div>
          ) : filtered.length > 0 ? (
            filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(v);
                  setQuery(v.name);
                  setOpen(false);
                }}
                className="block w-full border-b px-4 py-2.5 text-left text-sm font-medium transition-colors last:border-0 hover:bg-muted"
              >
                {v.name}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">Eşleşen tedarikçi yok</div>
          )}
          {canSearch && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                setAddOpen(true);
              }}
              className="flex w-full items-center gap-2 border-t bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70"
            >
              <Plus className="size-4" /> &quot;{query.trim()}&quot; adıyla yeni tedarikçi kaydet
            </button>
          )}
        </div>
      )}

      {addOpen && (
        <VendorCreateModal
          initialName={query.trim()}
          onClose={() => setAddOpen(false)}
          onCreated={(v) => {
            onCreated(v);
            onSelect(v);
            setQuery(v.name);
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function VendorCreateModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (v: ComboVendor) => void;
}) {
  const [busy, start] = useTransition();
  const [f, setF] = useState({
    name: initialName,
    phone: "",
    email: "",
    taxNo: "",
    defaultInvoiced: true,
    payIban: "",
    payAccountName: "",
    notes: "",
  });

  function save() {
    if (!f.name.trim()) {
      toast.error("Tedarikçi adı zorunludur");
      return;
    }
    start(async () => {
      const r = await createVendor(f);
      if (r.error || !r.id) {
        toast.error(r.error || "Kaydedilemedi");
        return;
      }
      toast.success("Tedarikçi kaydedildi");
      onCreated({
        id: r.id,
        name: f.name.trim(),
        defaultInvoiced: f.defaultInvoiced,
        payIban: f.payIban.trim(),
        payAccountName: f.payAccountName.trim(),
      });
    });
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto overflow-hidden rounded-xl border bg-popover shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="size-4" />
            </div>
            <h2 className="font-semibold">Yeni Tedarikçi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md border bg-card hover:bg-muted"
            aria-label="Kapat"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <div className="space-y-1.5">
            <Label>Ad / Unvan *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Firma veya kişi adı" />
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
          <div className="space-y-1.5">
            <Label>IBAN (ödeme için)</Label>
            <Input value={f.payIban} onChange={(e) => setF({ ...f, payIban: e.target.value })} placeholder="TR.." />
          </div>
          <div className="space-y-1.5">
            <Label>Ödeme Hesap Adı (boşsa tedarikçi adı)</Label>
            <Input value={f.payAccountName} onChange={(e) => setF({ ...f, payAccountName: e.target.value })} placeholder={f.name || "Hesap sahibi"} />
          </div>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Ödeme varsayılan olarak bu tedarikçiye/IBAN'a yapılır. Kalemde farklıysa &quot;tedarikçi ile aynı değil&quot; ile değiştirebilirsin.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Kaydet ve Seç
          </Button>
        </div>
      </div>
    </div>
  );
}
