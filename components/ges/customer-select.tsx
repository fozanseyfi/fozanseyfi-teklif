"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, UserPlus, X, CheckCircle2 } from "lucide-react";
import { useReadOnly } from "@/lib/readonly-context";

export interface Customer {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

/**
 * Müşteri combobox'ı — kayıtlı müşterilerden seçim + "yeni müşteri ekle".
 * Hem proje hem malzeme/hizmet teklifi formlarında kullanılır. Yeni müşteri
 * eklenince ilgili projenin customerName'i set edileceği için /müşteriler
 * listesine otomatik düşer (ayrı Customer tablosu yoktur).
 */
export function CustomerSelect({
  customers,
  value,
  onChange,
  onContactFill,
}: {
  customers: Customer[];
  value: string;
  onChange: (v: string) => void;
  onContactFill: (c: Customer) => void;
}) {
  const isReadOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [addOpen, setAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", phone: "", address: "" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  function selectCustomer(c: Customer) {
    onChange(c.name);
    setQuery(c.name);
    onContactFill(c);
    setOpen(false);
  }

  function applyNew() {
    if (!newCust.name.trim()) return;
    onChange(newCust.name.trim());
    setQuery(newCust.name.trim());
    onContactFill({
      name: newCust.name.trim(),
      email: newCust.email || null,
      phone: newCust.phone || null,
      address: newCust.address || null,
    });
    setAddOpen(false);
    setNewCust({ name: "", email: "", phone: "", address: "" });
  }

  if (isReadOnly) {
    return (
      <div className="relative">
        <Input value={query} readOnly className="pl-1 pr-1" />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Müşteri adı ara veya yaz…"
          className="pl-9 pr-10"
        />
        <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto overflow-hidden rounded-md border bg-popover shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <button
                key={c.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCustomer(c)}
                className="block w-full border-b px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-muted"
              >
                <p className="text-sm font-medium">{c.name}</p>
                {(c.email || c.phone) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">Eşleşen müşteri yok</div>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="flex w-full items-center gap-2 border-t bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70"
          >
            <UserPlus className="size-4" /> Yeni Müşteri Ekle
          </button>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <UserPlus className="size-4" />
                </div>
                <h2 className="font-semibold">Yeni Müşteri</h2>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="flex size-8 items-center justify-center rounded-md border bg-card hover:bg-muted"
                aria-label="Kapat"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Müşteri / Firma Adı *
                </Label>
                <Input value={newCust.name} onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))} placeholder="Firma veya kişi adı" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">E-posta</Label>
                <Input type="email" value={newCust.email} onChange={(e) => setNewCust((p) => ({ ...p, email: e.target.value }))} placeholder="ornek@firma.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Telefon</Label>
                <Input value={newCust.phone} onChange={(e) => setNewCust((p) => ({ ...p, phone: e.target.value }))} placeholder="0532 000 00 00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adres</Label>
                <Input value={newCust.address} onChange={(e) => setNewCust((p) => ({ ...p, address: e.target.value }))} placeholder="Firma veya saha adresi" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Vazgeç
              </Button>
              <Button type="button" onClick={applyNew} disabled={!newCust.name.trim()}>
                <CheckCircle2 className="size-4" /> Ekle ve Seç
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
