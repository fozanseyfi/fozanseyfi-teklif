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
import { Package, Plus, Search, Pencil, Trash2, Loader2, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  renumberCatalogCodes,
  getCatalogItemUsage,
  type CatalogItemDTO,
  type CatalogUsageRow,
} from "@/app/actions/materials";
import { currencySymbol, type QuoteCurrency } from "@/lib/quote";
import Link from "next/link";

type Draft = { code: string; name: string; unit: string; kind: "MALZEME" | "HIZMET" };

const EMPTY: Draft = { code: "", name: "", unit: "adet", kind: "MALZEME" };

export function MaterialsClient({ initialItems }: { initialItems: CatalogItemDTO[] }) {
  const [items, setItems] = useState<CatalogItemDTO[]>(initialItems);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogItemDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [renumbering, setRenumbering] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CatalogItemDTO | null>(null);
  const router = useRouter();

  // Kullanım (hangi tekliflerde) dialog'u
  const [usageItem, setUsageItem] = useState<CatalogItemDTO | null>(null);
  const [usageRows, setUsageRows] = useState<CatalogUsageRow[] | null>(null);

  async function openUsage(item: CatalogItemDTO) {
    setUsageItem(item);
    setUsageRows(null);
    const rows = await getCatalogItemUsage(item.code);
    setUsageRows(rows);
  }

  function fmt(n: number, d = 0) {
    return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  async function handleRenumber() {
    setRenumbering(true);
    try {
      const res = await renumberCatalogCodes();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Kodlar yeniden sıralandı (MLZ0001… / HZM0001…)");
        router.refresh();
      }
    } finally {
      setRenumbering(false);
    }
  }

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRenumber} disabled={renumbering} title="Kodları yeniden sırala — malzeme MLZ0001…, hizmet HZM0001…">
            {renumbering ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownUp className="size-4" />}
            Kodları Sırala
          </Button>
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Yeni Kalem
          </Button>
        </div>
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
        <CardContent className="overflow-x-auto p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Package className="size-8 opacity-40" />
              {items.length === 0 ? "Henüz katalog kalemi yok. \"Yeni Kalem\" ile ekleyin." : "Eşleşen kalem yok."}
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
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
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => openUsage(it)}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                        title="Hangi tekliflerde, hangi fiyatla kullanılmış?"
                      >
                        {it.name}
                      </button>
                    </td>
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
            {editing ? (
              <div className="space-y-1.5">
                <Label>Kod</Label>
                <Input value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} placeholder="ANK-0001" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Kod</Label>
                <div className="flex h-9 items-center rounded-md border border-dashed bg-muted px-2 text-sm text-muted-foreground">
                  Otomatik ({draft.kind === "HIZMET" ? "HZM" : "MLZ"}####)
                </div>
              </div>
            )}
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
              disabled={saving || !draft.name.trim() || (editing !== null && !draft.code.trim())}
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

      {/* Kullanım: hangi tekliflerde, hangi fiyatla */}
      <Dialog open={usageItem !== null} onOpenChange={(o) => !o && setUsageItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{usageItem?.name}</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{usageItem?.code}</span> — bu kalem hangi tekliflerde, hangi fiyatla verilmiş?
            </DialogDescription>
          </DialogHeader>
          {usageRows === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Yükleniyor…
            </div>
          ) : usageRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Bu kalem henüz hiçbir teklifte kullanılmamış.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Müşteri / Teklif</th>
                    <th className="px-3 py-2 text-right">Adet</th>
                    <th className="px-3 py-2 text-right">Birim Maliyet</th>
                    <th className="px-3 py-2 text-right">Kâr %</th>
                    <th className="px-3 py-2 text-right">Birim Satış</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usageRows.map((r, i) => {
                    const sym = currencySymbol(r.currency as QuoteCurrency);
                    const sale = r.unitCost * (1 + (r.marginPct || 0) / 100);
                    return (
                      <tr key={`${r.projectId}-${i}`} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.customerName || "—"}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {r.projectName}
                            {r.isOption && (
                              <span className="ml-1 rounded-full bg-violet-100 px-1 py-0.5 text-[9px] font-bold uppercase text-violet-700">
                                opsiyon
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(r.qty, r.qty % 1 === 0 ? 0 : 2)} {r.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{sym}{fmt(r.unitCost, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">%{fmt(r.marginPct, r.marginPct % 1 === 0 ? 0 : 1)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{sym}{fmt(sale, 2)}</td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/projects/${r.projectId}/detail/items`}
                            className="text-primary hover:underline"
                            title="Teklifi aç"
                          >
                            Aç
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
