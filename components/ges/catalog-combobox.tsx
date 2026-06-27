"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCatalogItem, type CatalogItemDTO } from "@/app/actions/materials";

interface Props {
  catalog: CatalogItemDTO[];
  onPick: (item: CatalogItemDTO) => void;
  /** Yeni katalog kalemi oluşturulduğunda local listeye eklemek için. */
  onCreated: (item: CatalogItemDTO) => void;
}

export function CatalogCombobox({ catalog, onPick, onCreated }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Yeni kalem dialog'u
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", unit: "adet", kind: "MALZEME" as "MALZEME" | "HIZMET" });

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const matches =
    q.length >= 2
      ? catalog
          .filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
          .slice(0, 12)
      : [];

  function pick(item: CatalogItemDTO) {
    onPick(item);
    setQuery("");
    setOpen(false);
  }

  function openCreate() {
    setForm({ code: "", name: query.trim(), unit: "adet", kind: "MALZEME" });
    setAddOpen(true);
    setOpen(false);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await createCatalogItem(form);
      if (res.error || !res.item) {
        toast.error(res.error ?? "Eklenemedi");
        return;
      }
      onCreated(res.item);
      onPick(res.item);
      toast.success("Katalog kalemi eklendi");
      setAddOpen(false);
      setQuery("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Kalem ekle — kod veya ad ara (en az 2 harf)…"
          className="pl-9"
        />
      </div>

      {open && (q.length >= 2 || matches.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-xl">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span
                className={
                  "rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold " +
                  (c.kind === "HIZMET" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700")
                }
              >
                {c.kind === "HIZMET" ? "Hizmet" : "Malzeme"}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Eşleşen kalem yok.</p>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
          >
            <Plus className="size-4" />
            {q ? `"${query.trim()}" için yeni malzeme/hizmet kaydet` : "Yeni malzeme/hizmet kaydet"}
          </button>
        </div>
      )}

      {/* Yeni katalog kalemi */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Malzeme / Hizmet</DialogTitle>
            <DialogDescription>
              Katalog kalemi (fiyatsız). Fiyatı teklifte gireceksiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kod *</Label>
              <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="örn. PNL-550" />
            </div>
            <div className="space-y-1.5">
              <Label>Tür</Label>
              <select
                className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                value={form.kind}
                onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as "MALZEME" | "HIZMET" }))}
              >
                <option value="MALZEME">Malzeme</option>
                <option value="HIZMET">Hizmet</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ad *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="örn. 550W Monokristal Panel" />
            </div>
            <div className="space-y-1.5">
              <Label>Birim</Label>
              <Input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder="adet" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Vazgeç</Button>
            <Button onClick={handleCreate} disabled={saving || !form.code.trim() || !form.name.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Kaydet & Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
