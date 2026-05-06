"use client";

import { useState, useMemo } from "react";
import { saveGesSettings } from "@/app/actions/ges";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { calc, getGrpTot, toUSD } from "@/lib/ges-engine";
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
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  projectId: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
}

/**
 * Item bazli birim fiyat dagitimi.
 *
 * - hidden  : kalem PDF'te gozukmez VE toplama dahil edilmez. Onun sahip
 *             olacagi pay diger gorunur (karli) kalemlere dagitilir.
 * - excluded (karsiz): gorunur ama uzerine kar yansitilmaz; sadece
 *             maliyet kadar toplanir, kar diger karli kalemlere dagitilir.
 * - default : gorunur, karli — fazla kari emer.
 */
function buildSalePrices(
  allGroups: KesifGroup[],
  settings: GesSettings,
  excludedCodes: Set<string>,
  hiddenCodes: Set<string>,
): Map<string, number> {
  const result = calc(
    allGroups.filter((g) => g.code.startsWith("A")),
    allGroups.filter((g) => g.code.startsWith("B")),
    settings,
  );
  const salePrice = result.salePriceUsd;

  let totalIncludedCost = 0;
  let totalExcludedCost = 0;
  for (const g of allGroups) {
    for (const it of g.items) {
      if (hiddenCodes.has(it.code)) continue;
      const cost = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings);
      if (excludedCodes.has(it.code)) totalExcludedCost += cost;
      else totalIncludedCost += cost;
    }
  }

  // Visible total = salePrice — hidden kalemler tamamen elendi, sale price
  // visible kalemlere dagitiliyor.
  const scaleFactor =
    totalIncludedCost > 0 ? (salePrice - totalExcludedCost) / totalIncludedCost : 1;

  const map = new Map<string, number>();
  for (const g of allGroups) {
    for (const it of g.items) {
      if (hiddenCodes.has(it.code)) {
        map.set(it.code, 0);
        continue;
      }
      const cost = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings);
      if (excludedCodes.has(it.code)) {
        map.set(it.code, cost);
      } else {
        map.set(it.code, cost * scaleFactor);
      }
    }
  }
  return map;
}

export function PricedBoQ({ projectId, kesifA, kesifB, settings }: Props) {
  const [search, setSearch] = useState("");
  // Karsiz/gizli isaretler proje bazli persisted — settings.pboqExcluded
  // ve settings.pboqHidden alanlari Prisma'da JSON olarak duruyor.
  const [excludedCodes, setExcludedCodes] = useState<Set<string>>(
    () => new Set(settings.pboqExcluded ?? []),
  );
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(
    () => new Set(settings.pboqHidden ?? []),
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const all = [...kesifA, ...kesifB];
    return Object.fromEntries(all.map((g) => [g.code, false]));
  });
  const [showHidden, setShowHidden] = useState(true);

  // Set degisiminde server'a yaz — ayri bir useEffect yerine toggle anlik
  // olarak save eder; debounce'a gerek yok cunku islem tek tikla olur.
  function persistSets(newExcluded: Set<string>, newHidden: Set<string>) {
    saveGesSettings(projectId, {
      pboqExcluded: Array.from(newExcluded),
      pboqHidden: Array.from(newHidden),
    } as never).catch(() => {});
  }

  const allGroups = useMemo(() => [...kesifA, ...kesifB], [kesifA, kesifB]);

  const result = useMemo(() => calc(kesifA, kesifB, settings), [kesifA, kesifB, settings]);
  const salePrice = result.salePriceUsd;

  const salePriceMap = useMemo(
    () => buildSalePrices(allGroups, settings, excludedCodes, hiddenCodes),
    [allGroups, settings, excludedCodes, hiddenCodes],
  );

  // Group-level visible totals (gizli kalemler dahil edilmez)
  const groupSaleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of allGroups) {
      const total = g.items.reduce((s, it) => {
        if (hiddenCodes.has(it.code)) return s;
        return s + (salePriceMap.get(it.code) ?? 0);
      }, 0);
      map.set(g.code, total);
    }
    return map;
  }, [allGroups, salePriceMap, hiddenCodes]);

  function toggleExclude(code: string) {
    setExcludedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      persistSets(next, hiddenCodes);
      return next;
    });
  }

  function toggleHidden(code: string) {
    setHiddenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      persistSets(excludedCodes, next);
      return next;
    });
  }

  const filteredGroups = useMemo(() => {
    if (!search) return allGroups;
    const q = search.toLowerCase();
    return allGroups
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
  }, [allGroups, search]);

  function handlePrintSummary() {
    // PDF: gizli kalemler tamamen elenir, gizli olan kalemler hiç listelenmez
    const visibleGroups = allGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => !hiddenCodes.has(it.code)) }))
      .filter((g) => g.items.length > 0);

    const rows = visibleGroups
      .map((g) => {
        const total = groupSaleTotals.get(g.code) ?? 0;
        const isA = g.code.startsWith("A");
        return `<tr>
        <td><span class="${isA ? "badge-a" : "badge-b"}">${g.code}</span></td>
        <td>${g.name}</td>
        <td style="text-align:center">${g.items.length}</td>
        <td style="text-align:right;font-weight:700">$${fmt(total)}</td>
        <td style="text-align:right;color:#64748b">₺${fmt(total * settings.usd)}</td>
      </tr>`;
      })
      .join("");

    const html = buildPrintHtml(
      "Birim Fiyat Cetveli — Özet",
      `<table>
        <thead><tr>
          <th style="width:56px">Kod</th><th>Grup</th><th style="text-align:center;width:56px">Kalem</th>
          <th style="text-align:right;width:110px">USD</th><th style="text-align:right;width:110px">TRY</th>
        </tr></thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="3" style="text-align:right">GENEL TOPLAM</td>
            <td style="text-align:right">$${fmt(salePrice)}</td>
            <td style="text-align:right">₺${fmt(salePrice * settings.usd)}</td>
          </tr>
        </tbody>
      </table>`,
      salePrice,
      settings.usd,
    );
    openPrint(html);
  }

  function handlePrintDetail() {
    const visibleGroups = allGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => !hiddenCodes.has(it.code)) }))
      .filter((g) => g.items.length > 0);

    const groupRows = visibleGroups
      .map((g) => {
        const grpTotal = groupSaleTotals.get(g.code) ?? 0;
        const isA = g.code.startsWith("A");
        const itemRows = g.items
          .map((it) => {
            const sp = salePriceMap.get(it.code) ?? 0;
            return `<tr class="item-row">
          <td class="code-cell">${it.code}</td>
          <td style="padding-left:18px">${it.tanim}</td>
          <td class="dim">${it.tip || ""}</td>
          <td class="dim">${it.marka || ""}</td>
          <td style="text-align:center" class="dim">${it.birim}</td>
          <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
          <td style="text-align:right;font-weight:700">$${fmt(sp)}</td>
          <td style="text-align:right;color:#64748b">₺${fmt(sp * settings.usd)}</td>
        </tr>`;
          })
          .join("");
        return `<tr class="group-row">
        <td colspan="2"><span class="${isA ? "badge-a" : "badge-b"}">${g.code}</span> <strong>${g.name}</strong></td>
        <td colspan="4"></td>
        <td style="text-align:right;font-weight:800;color:${isA ? "#059669" : "#047857"}">$${fmt(grpTotal)}</td>
        <td style="text-align:right;color:#64748b">₺${fmt(grpTotal * settings.usd)}</td>
      </tr>${itemRows}`;
      })
      .join("");

    const html = buildPrintHtml(
      "Birim Fiyat Cetveli — Detaylı",
      `<table>
        <thead><tr>
          <th style="width:52px">Kod</th><th>Tanım</th>
          <th style="width:110px">Tip</th><th style="width:90px">Marka</th>
          <th style="text-align:center;width:44px">Birim</th><th style="text-align:right;width:60px">Miktar</th>
          <th style="text-align:right;width:100px">USD</th><th style="text-align:right;width:100px">TRY</th>
        </tr></thead>
        <tbody>${groupRows}
          <tr class="total-row">
            <td colspan="6" style="text-align:right">GENEL TOPLAM</td>
            <td style="text-align:right">$${fmt(salePrice)}</td>
            <td style="text-align:right">₺${fmt(salePrice * settings.usd)}</td>
          </tr>
        </tbody>
      </table>`,
      salePrice,
      settings.usd,
    );
    openPrint(html);
  }

  function handleExcel() {
    const rows: string[] = [];
    rows.push(
      ["Kod", "Grup", "Tanım", "Tip", "Marka", "Birim", "Miktar", "USD", "TRY"].join("\t"),
    );
    for (const g of allGroups) {
      for (const it of g.items) {
        if (hiddenCodes.has(it.code)) continue;
        const sp = salePriceMap.get(it.code) ?? 0;
        rows.push(
          [
            it.code,
            g.name,
            it.tanim,
            it.tip || "",
            it.marka || "",
            it.birim,
            String(it.miktar),
            sp.toFixed(2),
            (sp * settings.usd).toFixed(2),
          ].join("\t"),
        );
      }
    }
    const blob = new Blob(["﻿" + rows.join("\n")], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "birim-fiyat-cetveli.xls";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Editor uyari banner — sadece dahili kullanim icin, PDF'te yok */}
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-soft-foreground" />
        <div>
          <p className="text-sm font-semibold text-warning-soft-foreground">
            Birim Fiyat Cetveli — Müşteriye gönderilecek belge
          </p>
          <p className="mt-0.5 text-xs text-warning-soft-foreground/90">
            Bu sekmede toplam tutarın kalemlere orantısal dağıtımını
            düzenleyebilirsiniz. <strong>⊘ Karsız</strong> ile bir kalemin üzerine
            kar yansıtılmaz; <strong>🚫 Gizle</strong> ile kalem PDF'ten tamamen
            çıkarılır ve onun payı diğer kalemlere otomatik dağıtılır. Çıktı
            dahili "satış" terimi kullanmaz, doğrudan müşteriye iletilebilir.
          </p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Birim Fiyat Cetveli
          </h2>
          <p className="text-sm text-muted-foreground">
            Toplam:{" "}
            <span className="font-semibold text-primary">${fmt(salePrice)}</span>
            {" / "}₺{fmt(salePrice * settings.usd)}
            {excludedCodes.size > 0 && (
              <span className="ml-2 text-muted-foreground">
                · {excludedCodes.size} karsız
              </span>
            )}
            {hiddenCodes.size > 0 && (
              <span className="ml-2 text-muted-foreground">
                · {hiddenCodes.size} gizli
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-44 pl-8 text-sm"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHidden((v) => !v)}
            title={showHidden ? "Gizli kalemleri gizle" : "Gizli kalemleri göster"}
          >
            {showHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {showHidden ? "Gizliler görünür" : "Gizliler kapalı"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCollapsed(Object.fromEntries(allGroups.map((g) => [g.code, true])))
            }
          >
            Tümünü Kapat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCollapsed(Object.fromEntries(allGroups.map((g) => [g.code, false])))
            }
          >
            Tümünü Aç
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintSummary}>
            <FileDown className="size-4" /> Özet PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintDetail}>
            <FileDown className="size-4" /> Detay PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcel}>
            <FileDown className="size-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-2">
        {filteredGroups.map((group) => {
          const isA = group.code.startsWith("A");
          const isCollapsed = collapsed[group.code];
          const grpTotal = groupSaleTotals.get(group.code) ?? 0;

          // Editor'de gizli kalemler showHidden ile filtrelenir
          const renderedItems = showHidden
            ? group.items
            : group.items.filter((it) => !hiddenCodes.has(it.code));

          if (renderedItems.length === 0) return null;

          return (
            <Card key={group.code} className="overflow-hidden shadow-sm">
              <CardHeader
                className="cursor-pointer select-none py-2.5 transition-colors hover:bg-muted/40"
                onClick={() => setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-xs",
                        isA
                          ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                          : "border-info/30 bg-info-soft text-info-soft-foreground",
                      )}
                    >
                      {group.code}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {group.name}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      ({renderedItems.length} kalem)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">${fmt(grpTotal)}</span>
                    <span className="text-xs text-muted-foreground">
                      ₺{fmt(grpTotal * settings.usd)}
                    </span>
                    {salePrice > 0 && (
                      <span className="hidden text-xs text-info-soft-foreground sm:inline">
                        {((grpTotal / salePrice) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="w-20 px-3 py-2 text-left font-medium text-muted-foreground">
                            Kod
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            Tanım
                          </th>
                          <th className="w-32 px-3 py-2 text-left font-medium text-muted-foreground">
                            Tip/Model
                          </th>
                          <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">
                            Marka
                          </th>
                          <th className="w-16 px-3 py-2 text-center font-medium text-muted-foreground">
                            Birim
                          </th>
                          <th className="w-24 px-3 py-2 text-right font-medium text-muted-foreground">
                            Miktar
                          </th>
                          <th className="w-28 px-3 py-2 text-right font-medium text-muted-foreground">
                            USD
                          </th>
                          <th className="w-28 px-3 py-2 text-right font-medium text-muted-foreground">
                            TRY
                          </th>
                          <th className="w-44 px-3 py-2 text-center font-medium text-muted-foreground">
                            Durum
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {renderedItems.map((item) => {
                          const sp = salePriceMap.get(item.code) ?? 0;
                          const excluded = excludedCodes.has(item.code);
                          const hidden = hiddenCodes.has(item.code);
                          return (
                            <tr
                              key={item.code}
                              className={cn(
                                "transition-colors",
                                hidden
                                  ? "bg-destructive-soft/20 line-through opacity-60"
                                  : excluded
                                    ? "bg-muted/40"
                                    : "hover:bg-primary-soft/40",
                              )}
                            >
                              <td
                                className={cn(
                                  "px-3 py-1.5 font-mono",
                                  hidden || excluded
                                    ? "text-muted-foreground/60"
                                    : "text-muted-foreground",
                                )}
                              >
                                {item.code}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-1.5",
                                  hidden || excluded ? "text-muted-foreground" : "text-foreground",
                                )}
                              >
                                {item.tanim}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.tip}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.marka}</td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-center text-muted-foreground">
                                {item.birim}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                {fmt(item.miktar, item.miktar < 100 ? 2 : 0)}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-1.5 text-right font-semibold tabular-nums",
                                  hidden
                                    ? "text-muted-foreground line-through"
                                    : excluded
                                      ? "text-muted-foreground"
                                      : "text-foreground",
                                )}
                              >
                                ${fmt(sp)}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                                ₺{fmt(sp * settings.usd)}
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleExclude(item.code)}
                                    disabled={hidden}
                                    className={cn(
                                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-40",
                                      excluded
                                        ? "border-border bg-muted text-muted-foreground"
                                        : "border-success/30 bg-success-soft text-success-soft-foreground hover:bg-success-soft/80",
                                    )}
                                    title={
                                      excluded
                                        ? "Kar yansıtılmıyor (Karsız)"
                                        : "Kar yansıtılıyor (Karlı)"
                                    }
                                  >
                                    {excluded ? "⊘ Karsız" : "✓ Karlı"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleHidden(item.code)}
                                    className={cn(
                                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                                      hidden
                                        ? "border-destructive/30 bg-destructive-soft text-destructive-soft-foreground"
                                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                                    )}
                                    title={
                                      hidden
                                        ? "Gizli — PDF'te gözükmez"
                                        : "Görünür — PDF'te gözükür"
                                    }
                                  >
                                    {hidden ? "🚫 Gizli" : "👁 Görünür"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-primary/30 bg-primary-soft">
                          <td colSpan={6} className="px-3 py-2 text-right font-semibold text-primary-soft-foreground">
                            {group.code} Toplam:
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-primary-soft-foreground">
                            ${fmt(grpTotal)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-primary-soft-foreground">
                            ₺{fmt(grpTotal * settings.usd)}
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
        <div className="overflow-hidden rounded-xl border border-primary/40 bg-primary-soft">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm font-semibold text-primary-soft-foreground">
              GENEL TOPLAM
            </span>
            <div className="text-right">
              <span className="text-base font-bold text-primary-soft-foreground">
                ${fmt(salePrice)}
              </span>
              <span className="ml-3 text-sm text-primary-soft-foreground/80">
                ₺{fmt(salePrice * settings.usd)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPrintHtml(title: string, tableHtml: string, salePrice: number, usd: number): string {
  function fmt2(n: number) {
    return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  // PDF: tarafsiz dil, "satis" kelimesi yok, dahili "kar/maliyet" terimleri
  // de yer almaz. Musteri-yuzlu belge.
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a;padding:0}
    .header{background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:16px 20px 14px;display:flex;justify-content:space-between;align-items:flex-end}
    .header h1{font-size:17px;font-weight:700;color:#fff}
    .header .sub{font-size:9px;color:rgba(255,255,255,0.5);margin-top:3px}
    .header .total-badge .label{font-size:8px;color:rgba(110,231,183,0.7);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px}
    .header .total-badge .amount{font-size:22px;font-weight:800;color:#34d399}
    .accent-bar{height:3px;background:linear-gradient(90deg,#047857,#34d399,transparent)}
    .content{padding:14px 20px 20px}
    table{width:100%;border-collapse:collapse}
    th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:8.5px;font-weight:600}
    td{padding:3.5px 7px;border-bottom:1px solid #f1f5f9}
    .group-row td{background:#f8fafc;border-top:2px solid #e2e8f0;border-bottom:1px solid #cbd5e1;font-size:10px;color:#1e293b;padding:5px 7px}
    .item-row:nth-child(even) td{background:#fcfcfd}
    .code-cell{color:#94a3b8;font-family:monospace;font-size:8px;width:52px}
    .dim{color:#64748b}
    .num{font-variant-numeric:tabular-nums}
    .total-row td{background:#ecfdf5;font-weight:700;font-size:10px;border-top:3px double #34d399;color:#047857}
    .badge-a{display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;background:#ecfdf5;color:#047857;border:1px solid #34d399}
    .badge-b{display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="header h1">${title}</div>
      <div class="sub">${new Date().toLocaleDateString("tr-TR")}</div>
    </div>
    <div class="total-badge">
      <div class="label">Toplam Tutar</div>
      <div class="amount">$${fmt2(salePrice)}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="content">${tableHtml}</div>
  </body></html>`;
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
