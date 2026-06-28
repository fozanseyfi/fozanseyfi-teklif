"use client";

import { useState, useMemo } from "react";
import type { Project } from "@prisma/client";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { calc, toUSD } from "@/lib/ges-engine";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search,
  FileDown,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import { downloadExcel } from "@/lib/excel-export";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";
import { resolveBrand, type BrandSettings } from "@/lib/pdf-brand";
import { buildBoqPrintHtml } from "@/lib/share-print/boq";
import { useReadOnly } from "@/lib/readonly-context";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  projectId: string;
  projectName: string;
  project: Project;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  firmName: string;
  brand: BrandSettings;
  userEmail: string;
  // Public paylasimda kullanilir: fiyatli/fiyatsiz BoQ ayrimi icin ilk
  // gorunumu admin secer; toggle butonu readonly'de gizlenir (data-edit-only).
  defaultShowPrices?: boolean;
}

export function BoQView({
  projectId,
  projectName,
  project,
  kesifA,
  kesifB,
  settings,
  firmName,
  brand,
  userEmail,
  defaultShowPrices = false,
}: Props) {
  const isReadonly = useReadOnly();
  const [search, setSearch] = useState("");
  const [showPrices, setShowPrices] = useState(defaultShowPrices);

  const allGroups = useMemo(() => [...kesifA, ...kesifB], [kesifA, kesifB]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allGroups.map((g) => [g.code, false])),
  );

  const result = useMemo(() => calc(kesifA, kesifB, settings), [kesifA, kesifB, settings]);

  // Boş kalemler (miktar = 0) BoQ'da hep gizlenir — yatırımcıyla paylaşılan
  // kapsam listesinde kullanılmamış kalem olmamalı. Hem GRUP kodları (A.7 boş
  // olduğu için silindi → A.8 yeni A.7 olur) hem de KALEM kodları görünür
  // sırayla yeniden numaralanır.
  const visibleGroups = useMemo(() => {
    const filtered = allGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => it.miktar > 0) }))
      .filter((g) => g.items.length > 0);
    // Grup kodlarını harf-bazında (A vs B) ardışık numaralandır
    let aIdx = 0;
    let bIdx = 0;
    return filtered.map((g) => {
      const isA = g.code.startsWith("A");
      const newGroupCode = isA ? `A.${++aIdx}` : `B.${++bIdx}`;
      return { ...g, displayGroupCode: newGroupCode };
    });
  }, [allGroups]);

  const filteredGroups = useMemo(() => {
    if (!search) return visibleGroups;
    const q = search.toLowerCase();
    return visibleGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.tanim.toLowerCase().includes(q) ||
            (it.tip || "").toLowerCase().includes(q) ||
            (it.marka || "").toLowerCase().includes(q) ||
            g.name.toLowerCase().includes(q) ||
            it.code.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [visibleGroups, search]);

  const totalItems = visibleGroups.reduce((s, g) => s + g.items.length, 0);
  const emptyCount =
    allGroups.reduce((s, g) => s + g.items.length, 0) -
    allGroups.reduce((s, g) => s + g.items.filter((it) => it.miktar > 0).length, 0);

  // A+B+Genel toplamlar (sadece visible items üzerinden)
  const totals = useMemo(() => {
    let kaTotal = 0;
    let kbTotal = 0;
    for (const g of visibleGroups) {
      const grpSum = g.items.reduce((s, it) => s + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings), 0);
      if (g.code.startsWith("A")) kaTotal += grpSum;
      else if (g.code.startsWith("B")) kbTotal += grpSum;
    }
    return { kaTotal, kbTotal, grandTotal: kaTotal + kbTotal };
  }, [visibleGroups, settings]);

  // Tek tuşlu toggle: hepsi açık mı?
  const allOpen = visibleGroups.every((g) => !collapsed[g.code]);
  function toggleAll() {
    setCollapsed(Object.fromEntries(visibleGroups.map((g) => [g.code, allOpen])));
  }

  function handlePrint() {
    const html = buildBoqPrintHtml({
      project,
      projectName,
      kesifA,
      kesifB,
      settings,
      brand: resolveBrand(brand),
      firmName,
      userEmail,
      showPrices,
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  function handleExcel() {
    const groupRows = visibleGroups
      .map((g) => {
        const grpTotal = g.items.reduce((s, it) => s + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings), 0);
        const itemRows = g.items
          .map((it, idx) => {
            const unitUsd = toUSD(it.rawFiyat, it.fiyatCur, settings);
            const cost = it.miktar * unitUsd;
            const displayCode = `${g.displayGroupCode}.${idx + 1}`;
            return `<tr class="item-row${idx % 2 ? " alt" : ""}">
              <td>${displayCode}</td>
              <td>${escapeHtml(it.tanim)}</td>
              <td class="dim">${escapeHtml(it.tip || "")}</td>
              <td class="dim">${escapeHtml(it.marka || "")}</td>
              <td class="center">${escapeHtml(it.birim)}</td>
              <td class="num">${it.miktar}</td>
              ${showPrices ? `<td class="num">${unitUsd.toFixed(it.code.startsWith("A.1") ? 3 : 2)}</td><td class="num">${cost.toFixed(2)}</td>` : ""}
            </tr>`;
          })
          .join("");
        return `<tr class="group-row"><td colspan="6">${g.displayGroupCode} — ${escapeHtml(g.name)}</td>${showPrices ? `<td></td><td class="num">${grpTotal.toFixed(2)}</td>` : ""}</tr>${itemRows}`;
      })
      .join("");
    const html = `<table>
      <thead>
        <tr>
          <th>Kod</th>
          <th>Tanım</th>
          <th>Tip/Model</th>
          <th>Marka</th>
          <th>Birim</th>
          <th>Miktar</th>
          ${showPrices ? `<th>Birim Fiyat (USD)</th><th>Tutar (USD)</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${groupRows}
        ${
          showPrices
            ? `<tr class="total-row"><td colspan="7">KEŞİF-A ARA TOPLAM</td><td class="num">${totals.kaTotal.toFixed(2)}</td></tr>
        <tr class="total-row"><td colspan="7">KEŞİF-B ARA TOPLAM</td><td class="num">${totals.kbTotal.toFixed(2)}</td></tr>
        <tr class="grand-total"><td colspan="7">GENEL TOPLAM (USD)</td><td class="num">${totals.grandTotal.toFixed(2)}</td></tr>`
            : ""
        }
      </tbody>
    </table>`;
    downloadExcel(`BoQ-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}`, html);
  }

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker="Bill of Quantities"
        title={projectName}
        backHref={prevHref(projectId, "/boq")}
        stats={
          <>
            <span className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 font-semibold text-foreground ring-1 ring-border">
              <Layers className="size-3" />
              {totalItems} kalem · {visibleGroups.length} grup
            </span>
            {emptyCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                · {emptyCount} boş kalem otomatik gizlendi
              </span>
            )}
            {showPrices && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 font-bold text-primary-soft-foreground">
                Toplam ${fmt(totals.grandTotal)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <FileDown className="size-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExcel}>
              <FileSpreadsheet className="size-3.5" /> Excel
            </Button>
          </>
        }
        secondary={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="h-8 w-44 pl-8 text-sm"
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrices((s) => !s)}
              title={showPrices ? "Fiyatları gizle (yalnız kapsam)" : "Fiyatları göster"}
              data-edit-only
            >
              {showPrices ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPrices ? "Fiyatlar açık" : "Fiyatlar kapalı"}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {allOpen ? (
                <>
                  <ChevronRight className="size-3.5" />
                  Tümünü Kapat
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  Tümünü Aç
                </>
              )}
            </Button>
          </>
        }
        notice={
          // Editor bilgilendirmesi — public share ve view mode'da gizli; yalnizca
          // BoQ'yu duzenleyen ekip uyelerine gosterilir, musteri sayfasinda
          // gereksiz teknik detay.
          isReadonly ? undefined : (
            <span>
              <strong>Bilgi:</strong> BoQ yatırımcıyla paylaşılan kapsam listesidir; boş (miktar = 0)
              kalemler <strong>otomatik silinir</strong> ve görünür kalemler{" "}
              <strong>yeniden sıralanır</strong>. Bu nedenle grup içi kod numaraları
              (örn. A.1.1, A.1.2…) keşif sayfalarındaki orijinal kodlarla birebir
              uyuşmayabilir.
            </span>
          )
        }
      />

      <div className="space-y-2">
        {filteredGroups.map((group) => {
          const isA = group.code.startsWith("A");
          const isCollapsed = collapsed[group.code];
          const grpTotal = group.items.reduce(
            (s, it) => s + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings),
            0,
          );

          return (
            <Card key={group.code} className="overflow-hidden shadow-sm">
              <CardHeader
                className="cursor-pointer select-none py-2.5 transition-colors hover:bg-muted/60"
                onClick={() =>
                  setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-mono text-xs",
                        isA
                          ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                          : "border-info/30 bg-info-soft text-info-soft-foreground",
                      )}
                    >
                      {group.displayGroupCode}
                    </Badge>
                    <CardTitle className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {group.name}
                    </CardTitle>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ({group.items.length} kalem)
                    </span>
                  </div>
                  {showPrices && (
                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary-soft-foreground">
                      ${fmt(grpTotal)}
                    </span>
                  )}
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    {/* Mobile (sm altı): Tip/Marka/Birim sütunları gizli, readonly modda
                        bilgi yoğunluğu azaltılır ve Kod-Tanım-Miktar-Fiyat tek satıra sığar.
                        sm ve üzeri ekranlarda tam tablo. */}
                    <table className="w-full text-[12px] sm:text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="w-14 px-2 py-2 text-left font-medium text-muted-foreground sm:w-20 sm:px-3">Kod</th>
                          <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-3">Tanım</th>
                          <th className={cn("w-32 px-3 py-2 text-left font-medium text-muted-foreground", isReadonly && "hidden md:table-cell")}>Tip/Model</th>
                          <th className={cn("w-28 px-3 py-2 text-left font-medium text-muted-foreground", isReadonly && "hidden md:table-cell")}>Marka</th>
                          <th className={cn("w-16 px-3 py-2 text-center font-medium text-muted-foreground", isReadonly && "hidden sm:table-cell")}>Birim</th>
                          <th className="w-20 px-2 py-2 text-right font-medium text-muted-foreground sm:w-24 sm:px-3">Miktar</th>
                          {showPrices && (
                            <>
                              <th className={cn("w-28 px-3 py-2 text-right font-medium text-muted-foreground", isReadonly && "hidden sm:table-cell")}>
                                Birim Fiyat
                              </th>
                              <th className="w-20 px-2 py-2 text-right font-medium text-muted-foreground sm:w-28 sm:px-3">
                                Tutar (USD)
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.items.map((item, idx) => {
                          const unitUsd = toUSD(item.rawFiyat, item.fiyatCur, settings);
                          const cost = item.miktar * unitUsd;
                          const displayCode = `${group.displayGroupCode}.${idx + 1}`;
                          return (
                            <tr key={item.code} className="transition-colors hover:bg-muted/60">
                              <td className="whitespace-nowrap px-2 py-2 align-top font-mono text-[11px] text-muted-foreground sm:px-3 sm:py-1.5 sm:text-xs">{displayCode}</td>
                              <td className="px-2 py-2 align-top text-foreground sm:px-3 sm:py-1.5">
                                {item.tanim}
                                {/* Mobile'da Tip/Marka sığmadığı için, kalem adının altına
                                    küçük puntolu olarak ekleyelim — bilgi kaybolmasın. */}
                                {isReadonly && (item.tip || item.marka) && (
                                  <span className="mt-0.5 block text-[10.5px] text-muted-foreground md:hidden">
                                    {[item.tip, item.marka].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </td>
                              <td className={cn("px-3 py-1.5 align-top text-muted-foreground", isReadonly && "hidden md:table-cell")}>{item.tip}</td>
                              <td className={cn("px-3 py-1.5 align-top text-muted-foreground", isReadonly && "hidden md:table-cell")}>{item.marka}</td>
                              <td className={cn("whitespace-nowrap px-3 py-1.5 align-top text-center text-muted-foreground", isReadonly && "hidden sm:table-cell")}>{item.birim}</td>
                              <td className="whitespace-nowrap px-2 py-2 text-right align-top tabular-nums text-foreground sm:px-3 sm:py-1.5">
                                {fmt(item.miktar, item.miktar < 100 ? 2 : 0)}
                                {/* Birim mobile'da gizli; miktar yanına ekle */}
                                {isReadonly && (
                                  <span className="ml-1 text-[10.5px] font-normal text-muted-foreground sm:hidden">
                                    {item.birim}
                                  </span>
                                )}
                              </td>
                              {showPrices && (
                                <>
                                  <td className={cn("whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums text-muted-foreground", isReadonly && "hidden sm:table-cell")}>
                                    ${fmt(unitUsd, item.code.startsWith("A.1") ? 3 : 2)}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 text-right align-top tabular-nums font-semibold text-foreground sm:px-3 sm:py-1.5">
                                    ${fmt(cost)}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* A+B+Genel toplam — sadece fiyatlar açıkken */}
        {showPrices && (
          <Card className="overflow-hidden border-primary/30 shadow-sm">
            <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3">
              <div className="rounded-lg bg-primary-soft/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-soft-foreground/70">
                  Keşif-A Ara Toplam
                </p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-primary-soft-foreground">
                  ${fmt(totals.kaTotal)}
                </p>
              </div>
              <div className="rounded-lg bg-info-soft/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-info-soft-foreground/70">
                  Keşif-B Ara Toplam
                </p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-info-soft-foreground">
                  ${fmt(totals.kbTotal)}
                </p>
              </div>
              <div className="rounded-lg bg-success-soft/60 px-3 py-2 ring-1 ring-success/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-success-soft-foreground/70">
                  Genel Toplam
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-success-soft-foreground">
                  ${fmt(totals.grandTotal)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
