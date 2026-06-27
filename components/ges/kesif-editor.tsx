"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveKesifA, saveKesifB } from "@/app/actions/ges";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import {
  resolveBrand,
  type BrandContext,
  type BrandSettings,
} from "@/lib/pdf-brand";
import { buildKesifPrintHtml } from "@/lib/share-print/kesif";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toUSD, getGrpTot } from "@/lib/ges-engine";
import type { KesifGroup, KesifItem, GesSettings } from "@/lib/ges-defaults";
import {
  Save,
  ChevronDown,
  ChevronRight,
  Search,
  FileDown,
  Plus,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";
import { useReadOnly } from "@/lib/readonly-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

interface Props {
  projectId: string;
  projectName: string;
  type: "A" | "B";
  data: KesifGroup[];
  settings: GesSettings;
  firmName: string;
  brand: BrandSettings;
  userEmail: string;
}

function newItem(groupCode: string, itemCount: number): KesifItem {
  return {
    code: `${groupCode}.${itemCount + 1}`,
    tanim: "Yeni Kalem",
    tip: "",
    marka: "",
    birim: "adet",
    miktar: 0,
    birimFiyat: 0,
    fiyatCur: "USD",
    rawFiyat: 0,
    notlar: "",
  };
}

function printKesif(
  title: string,
  groups: KesifGroup[],
  settings: GesSettings,
  grandTotal: number,
  brand: BrandContext,
  firmName: string,
  userEmail: string,
) {
  const html = buildKesifPrintHtml({
    title,
    groups,
    settings,
    grandTotal,
    brand,
    firmName,
    userEmail,
  });
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.print();
  }, 300);
}

export function KesifEditor({ projectId, projectName, type, data, settings, firmName, brand, userEmail }: Props) {
  const isReadonly = useReadOnly();
  const [groups, setGroups] = useState<KesifGroup[]>(data);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.map((g) => [g.code, true])),
  );
  const [search, setSearch] = useState("");
  // Silme onayı — popup'ta "emin misiniz, geri alınamaz" gösterilir.
  const [pendingDelete, setPendingDelete] = useState<
    { gi: number; ii: number; tanim: string } | null
  >(null);

  // Unsaved-changes: groups her degistiginde baseline ile farki kirli sayar.
  const baselineRef = useRef<string>(JSON.stringify(data));
  const isDirty = JSON.stringify(groups) !== baselineRef.current;
  useDirtyTracker(isDirty);

  // PDF brand context — Profilim'den gelen ayar set'ini dogru renge/logoya
  // cevirir. printKesif cagrilirken kullanilir.
  const brandCtx = useMemo(() => resolveBrand(brand), [brand]);

  const title =
    type === "A"
      ? "Keşif-A — Doğrudan Maliyetler"
      : "Keşif-B — Dolaylı Maliyetler";

  const updateItem = useCallback(
    (gi: number, ii: number, field: string, value: string | number) => {
      setGroups((prev) => {
        const next = prev.map((g, gIdx) => {
          if (gIdx !== gi) return g;
          return {
            ...g,
            items: g.items.map((it, iIdx) => {
              if (iIdx !== ii) return it;
              const updated = { ...it, [field]: value };
              if (field === "rawFiyat") {
                updated.birimFiyat = toUSD(Number(value), it.fiyatCur, settings);
              }
              if (field === "fiyatCur") {
                updated.birimFiyat = toUSD(it.rawFiyat, String(value), settings);
              }
              return updated;
            }),
          };
        });
        return next;
      });
    },
    [settings],
  );

  // Bir grubu ardisik sirala: items[i].code = `${group.code}.${i+1}`. Kullanici
  // bir kalem ekleyip/silince numaralar bosluksuz sirali kalsin.
  function renumber(g: KesifGroup): KesifGroup {
    return {
      ...g,
      items: g.items.map((it, idx) => ({
        ...it,
        code: `${g.code}.${idx + 1}`,
      })),
    };
  }

  function addItem(gi: number) {
    setGroups((prev) =>
      prev.map((grp, i) =>
        i !== gi
          ? grp
          : renumber({
              ...grp,
              items: [...grp.items, newItem(grp.code, grp.items.length)],
            }),
      ),
    );
  }

  function removeItem(gi: number, ii: number) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi ? g : renumber({ ...g, items: g.items.filter((_, idx) => idx !== ii) }),
      ),
    );
  }

  const router = useRouter();
  const nextHref =
    type === "A"
      ? `/projects/${projectId}/detail/kesif-b`
      : `/projects/${projectId}/detail/timeline`;
  const nextLabel = type === "A" ? "Keşif-B" : "CF Timeline";

  async function handleSave(advance = false) {
    setSaving(true);
    try {
      if (type === "A") await saveKesifA(projectId, groups as never, advance);
      else await saveKesifB(projectId, groups as never, advance);
      // Save sonrasi baseline esitlenir → dirty=false.
      baselineRef.current = JSON.stringify(groups);
      toast.success(advance ? `Kaydedildi — ${nextLabel} açıldı` : "Kaydedildi");
      if (advance) router.push(nextHref);
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  const grandTotal = groups.reduce((sum, g) => sum + getGrpTot(g, settings), 0);
  const dcWp = settings.dcGuc * 1_000_000;

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.tanim.toLowerCase().includes(q) ||
            (it.tip || "").toLowerCase().includes(q) ||
            (it.marka || "").toLowerCase().includes(q) ||
            g.name.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  const inputRowClass =
    "h-7 border-transparent bg-transparent px-1 text-xs hover:border-input focus-visible:border-ring";

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker={title}
        title={projectName}
        backHref={prevHref(projectId, type === "A" ? "/kesif-a" : "/kesif-b")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => printKesif(title, groups, settings, grandTotal, brandCtx, firmName, userEmail)}
            >
              <FileDown className="size-3.5" />
              PDF
            </Button>
            <Button
              data-edit-only
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              size="sm"
            >
              <Save className="size-3.5" />
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button data-edit-only onClick={() => handleSave(true)} disabled={saving} size="sm">
              Kaydet &amp; İlerle <ArrowRight className="size-3.5" />
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Toplam:{" "}
          <span className="font-semibold text-foreground">${fmt(grandTotal)}</span>{" "}
          / <span>₺{fmt(grandTotal * settings.usd)}</span>
          {dcWp > 0 && (
            <span className="ml-2 font-medium text-primary">
              ${(grandTotal / dcWp).toFixed(4)}/Wp
            </span>
          )}
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="h-8 w-44 pl-8 text-sm"
            placeholder="Ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredGroups.map((group) => {
        const realGi = groups.findIndex((g) => g.code === group.code);
        const grpTotal = getGrpTot(group, settings);
        const isCollapsed = collapsed[group.code];
        const isAutoGroup = type === "B" && group.code === "B.6";

        return (
          <Card
            key={group.code}
            className={cn(
              "overflow-hidden",
              isAutoGroup && "border-info/30",
            )}
          >
            <CardHeader
              className="cursor-pointer select-none py-3"
              onClick={() =>
                setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="font-mono text-xs">
                    {group.code}
                  </Badge>
                  <CardTitle className="text-sm font-semibold">
                    {group.name}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    ({group.items.length} kalem)
                  </span>
                  {isAutoGroup && (
                    <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-semibold text-info-soft-foreground">
                      Cash Flow Otomatik
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-semibold text-primary">
                      ${fmt(grpTotal)}
                    </span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ₺{fmt(grpTotal * settings.usd)}
                    </span>
                    {dcWp > 0 && (
                      <span className="ml-1.5 text-xs text-info-soft-foreground">
                        ${(grpTotal / dcWp).toFixed(4)}/Wp
                      </span>
                    )}
                  </div>
                  {!isAutoGroup && (
                    <button
                      data-edit-only
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addItem(realGi);
                      }}
                      className="rounded-md border border-primary/30 bg-primary-soft p-1.5 text-primary-soft-foreground transition-colors hover:bg-primary-soft/70"
                      title="Kalem ekle"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] sm:text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="w-14 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-16">
                          Kod
                        </th>
                        <th className="min-w-[120px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:min-w-[140px]">
                          Tanım
                        </th>
                        <th className={cn("min-w-[120px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isReadonly && "hidden md:table-cell")}>
                          Tip/Model
                        </th>
                        <th className={cn("min-w-[100px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isReadonly && "hidden md:table-cell")}>
                          Marka
                        </th>
                        <th className={cn("w-14 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isReadonly && "hidden sm:table-cell")}>
                          Birim
                        </th>
                        <th className="w-20 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-24">
                          Miktar
                        </th>
                        <th className={cn("w-16 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isReadonly && "hidden sm:table-cell")}>
                          Para
                        </th>
                        <th className={cn("w-24 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isReadonly && "hidden sm:table-cell")}>
                          Birim Fiyat
                        </th>
                        <th className="w-24 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-28">
                          Toplam USD
                        </th>
                        <th className={cn("w-24 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isReadonly && "hidden lg:table-cell")}>
                          $/Wp
                        </th>
                        <th className="w-8 px-2 py-2" data-edit-only />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.items.map((item, ii) => {
                        const realGrpItems = groups[realGi]?.items;
                        const realIi =
                          realGrpItems?.findIndex((it) => it.code === item.code) ?? ii;
                        const totalUsd =
                          item.miktar * toUSD(item.rawFiyat, item.fiyatCur, settings);
                        const perWp = dcWp > 0 ? totalUsd / dcWp : 0;
                        // Kritik malzeme kalemleri (A.1.1 panel, A.2.1 inverter,
                        // A.3.1 konstrüksiyon) ve B.6.1 finans maliyeti otomatik
                        // gelir; bu kalemler Analiz/Teknik'teki alt seçimleriyle
                        // yönetilir, burada düzenlenmez.
                        const isCriticalAlt =
                          type === "A" &&
                          (item.code === "A.1.1" ||
                            item.code === "A.2.1" ||
                            item.code === "A.3.1");
                        const isFinancing = type === "B" && group.code === "B.6";
                        const isReadOnly = isCriticalAlt || isFinancing;
                        return (
                          <tr
                            key={item.code}
                            className={cn(
                              "transition-colors",
                              isReadOnly ? "bg-info-soft/30" : "hover:bg-muted/40",
                            )}
                          >
                            <td className="whitespace-nowrap px-2 py-2 align-top font-mono text-[11px] text-muted-foreground sm:py-1.5 sm:text-xs">
                              {item.code}
                            </td>
                            <td className="px-2 py-2 align-top sm:py-1.5">
                              {/* Kritik malzemelerde (A.1.1/A.2.1/A.3.1) sadece
                                  Tanım düzenlenebilir; diğer alanlar Analiz'den
                                  otomatik gelir. Finans (B.6) satırı tümüyle
                                  kilitli. */}
                              {isFinancing ? (
                                <span className="px-1 text-xs">{item.tanim}</span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "min-w-[130px]")}
                                  value={item.tanim}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "tanim", e.target.value)
                                  }
                                />
                              )}
                              {/* Mobile fallback: Tip/Marka readonly modda Tanım altına ekle */}
                              {isReadonly && (item.tip || item.marka) && (
                                <span className="mt-0.5 block text-[10.5px] text-muted-foreground md:hidden">
                                  {[item.tip, item.marka].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </td>
                            <td className={cn("px-2 py-1.5 align-top", isReadonly && "hidden md:table-cell")}>
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.tip || "—"}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "min-w-[110px]")}
                                  value={item.tip || ""}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "tip", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className={cn("px-2 py-1.5 align-top", isReadonly && "hidden md:table-cell")}>
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.marka || "—"}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "min-w-[90px]")}
                                  value={item.marka || ""}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "marka", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className={cn("px-2 py-1.5 align-top", isReadonly && "hidden sm:table-cell")}>
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.birim}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "w-12")}
                                  value={item.birim}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "birim", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 align-top sm:py-1.5">
                              {isReadOnly ? (
                                <span className="block px-1 text-right text-xs text-muted-foreground">
                                  {fmt(item.miktar, item.code.startsWith("A.3") ? 3 : 0)}
                                  {/* Birim mobile'da gizli; miktar yanına ekle */}
                                  {isReadonly && (
                                    <span className="ml-1 text-[10.5px] font-normal sm:hidden">
                                      {item.birim}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "w-22 text-right")}
                                  type="number"
                                  step={item.code.startsWith("A.3") ? "0.001" : "any"}
                                  value={item.miktar}
                                  onChange={(e) =>
                                    updateItem(
                                      realGi,
                                      realIi,
                                      "miktar",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td className={cn("px-2 py-1.5 align-top", isReadonly && "hidden sm:table-cell")}>
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.fiyatCur}
                                </span>
                              ) : (
                                <select
                                  className="h-7 w-full rounded-md border bg-card px-1 text-xs"
                                  value={item.fiyatCur}
                                  onChange={(e) =>
                                    updateItem(
                                      realGi,
                                      realIi,
                                      "fiyatCur",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                  <option value="TRY">TRY</option>
                                </select>
                              )}
                            </td>
                            <td className={cn("px-2 py-1.5 align-top", isReadonly && "hidden sm:table-cell")}>
                              {isReadOnly ? (
                                <span className="block px-1 text-right text-xs font-semibold text-info-soft-foreground">
                                  {item.code.startsWith("A.1")
                                    ? `$${fmt(item.rawFiyat, 3)}`
                                    : `$${fmt(item.rawFiyat)}`}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "w-22 text-right")}
                                  type="number"
                                  step="0.001"
                                  value={item.rawFiyat}
                                  onChange={(e) =>
                                    updateItem(
                                      realGi,
                                      realIi,
                                      "rawFiyat",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right align-top font-semibold sm:py-1.5">
                              ${fmt(totalUsd)}
                            </td>
                            <td className={cn("whitespace-nowrap px-2 py-1.5 text-right align-top text-xs text-info-soft-foreground", isReadonly && "hidden lg:table-cell")}>
                              {perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-center align-top" data-edit-only>
                              {isReadOnly ? (
                                <span
                                  className="px-1 text-[9px] font-semibold text-info-soft-foreground"
                                  title={
                                    isCriticalAlt
                                      ? "Kritik malzeme — Analiz/Teknik'ten otomatik gelir"
                                      : "Cash Flow'dan otomatik hesaplanır"
                                  }
                                >
                                  {isCriticalAlt ? "Otomatik" : "CF Auto"}
                                </span>
                              ) : (
                                <button
                                  data-edit-only
                                  type="button"
                                  onClick={() =>
                                    setPendingDelete({
                                      gi: realGi,
                                      ii: realIi,
                                      tanim: item.tanim,
                                    })
                                  }
                                  className="rounded-md p-1 text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                                  aria-label="Kalemi sil"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-primary-soft/50">
                        <td
                          colSpan={8}
                          className="px-3 py-2 text-right text-xs font-semibold text-primary-soft-foreground"
                        >
                          {group.code} Toplam:
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-primary-soft-foreground">
                          ${fmt(grpTotal)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs font-medium text-info-soft-foreground">
                          {dcWp > 0 ? `$${(grpTotal / dcWp).toFixed(4)}/Wp` : ""}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Grand total */}
      <div className="overflow-hidden rounded-xl border-2 border-primary/30 bg-primary-soft">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-bold uppercase tracking-wider text-primary-soft-foreground">
            {type === "A" ? "Keşif-A" : "Keşif-B"} Genel Toplam
          </span>
          <div className="text-right">
            <span className="text-base font-bold text-primary-soft-foreground">
              ${fmt(grandTotal)}
            </span>
            <span className="ml-3 text-sm text-primary-soft-foreground/80">
              ₺{fmt(grandTotal * settings.usd)}
            </span>
            {dcWp > 0 && (
              <span className="ml-3 text-xs text-info-soft-foreground">
                ${(grandTotal / dcWp).toFixed(4)}/Wp
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Silme onayı — geri alınamaz uyarısı */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kalemi sil?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.tanim ? (
                <>
                  <strong className="text-slate-700">
                    {pendingDelete.tanim}
                  </strong>{" "}
                  kalemini silmek üzeresiniz. Bu işlem geri alınamaz.
                </>
              ) : (
                "Bu kalemi silmek üzeresiniz. Bu işlem geri alınamaz."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) removeItem(pendingDelete.gi, pendingDelete.ii);
                setPendingDelete(null);
              }}
            >
              <Trash2 className="size-3.5" />
              Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
