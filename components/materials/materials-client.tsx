"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { Package, Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  type CatalogItemDTO,
} from "@/app/actions/materials";

type Draft = { code: string; name: string; unit: string; kind: "MALZEME" | "HIZMET" };

const EMPTY: Draft = { code: "", name: "", unit: "adet", kind: "MALZEME" };

export function MaterialsClient({ initialItems }: { initialItems: CatalogItemDTO[] }) {
  const [items, setItems] = useState<CatalogItemDTO[]>(initialItems);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogItemDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CatalogItemDTO | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [items, search]);

  function openAdd() {
    setDraft(EMPTY);
    setAdding(true);
  }
  function openEdit(it: CatalogItemDTO) {
    setDraft({ code: it.code, name: it.name, unit: it.unit, kind: it.kind });
    setEditing(it);
  }

  async function handleAdd() {
    setSaving(true);
    try {
      const res = await createCatalogItem(draft);
      if (res.error || !res.item) {
        toast.error(res.error ?? "Eklenemedi");
        return;
      }
      setItems((p) => [res.item!, ...p]);
      toast.success("Kalem eklendi");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await updateCatalogItem(editing.id, draft);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setItems((p) => p.map((i) => (i.id === editing.id ? { ...i, ...draft } : i)));
      toast.success("Güncellendi");
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    const res = await deleteCatalogItem(id);
    if (res.error) toast.error(res.error);
    else {
      setItems((p) => p.filter((i) => i.id !== id));
      toast.success("Silindi");
    }
    setPendingDelete(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Package className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Malzemeler & Hizmetler</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Firma kataloğu — fiyatsız tanımlar. Teklif kalemleri buradan seçilir.
            </p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" /> Yeni Kalem
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Kod veya ad ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Package className="size-8 opacity-40" />
              {items.length === 0 ? "Henüz katalog kalemi yok. \"Yeni Kalem\" ile ekleyin." : "Eşleşen kalem yok."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Kod</th>
                  <th className="px-4 py-2.5 text-left">Ad</th>
                  <th className="px-4 py-2.5 text-left">Tür</th>
                  <th className="px-4 py-2.5 text-left">Birim</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((it) => (
                  <tr key={it.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{it.code}</td>
                    <td className="px-4 py-2.5 font-medium">{it.name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          it.kind === "HIZMET" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700",
                        )}
                      >
                        {it.kind === "HIZMET" ? "Hizmet" : "Malzeme"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{it.unit}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(it)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Ekle / Düzenle dialog */}
      <Dialog
        open={adding || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Kalemi Düzenle" : "Yeni Malzeme / Hizmet"}</DialogTitle>
            <DialogDescription>Fiyatsız tanım — fiyat tekliflerde girilir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kod *</Label>
              <Input value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} placeholder="örn. PNL-550" />
            </div>
            <div className="space-y-1.5">
              <Label>Tür</Label>
              <select
                className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                value={draft.kind}
                onChange={(e) => setDraft((p) => ({ ...p, kind: e.target.value as "MALZEME" | "HIZMET" }))}
              >
                <option value="MALZEME">Malzeme</option>
                <option value="HIZMET">Hizmet</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ad *</Label>
              <Input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="örn. 550W Monokristal Panel" />
            </div>
            <div className="space-y-1.5">
              <Label>Birim</Label>
              <Input value={draft.unit} onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))} placeholder="adet" />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button
              onClick={editing ? handleEdit : handleAdd}
              disabled={saving || !draft.code.trim() || !draft.name.trim()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editing ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme onayı */}
      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kalemi sil?</DialogTitle>
            <DialogDescription>
              <strong className="text-slate-700">{pendingDelete?.name}</strong> kataloğdan silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-3.5" /> Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
