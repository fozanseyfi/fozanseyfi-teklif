"use client";

import { useState, useMemo } from "react";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { calc, getGrpTot, toUSD } from "@/lib/ges-engine";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileDown, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  projectId: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
}

function buildSalePrices(
  allGroups: KesifGroup[],
  settings: GesSettings,
  excludedCodes: Set<string>
): Map<string, number> {
  const result = calc(
    allGroups.filter((g) => g.code.startsWith("A")),
    allGroups.filter((g) => g.code.startsWith("B")),
    settings
  );
  const salePrice = result.salePriceUsd;

  // Sum costs of items included in margin distribution
  let totalIncludedCost = 0;
  let totalExcludedCost = 0;
  for (const g of allGroups) {
    for (const it of g.items) {
      const cost = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings);
      if (excludedCodes.has(it.code)) totalExcludedCost += cost;
      else totalIncludedCost += cost;
    }
  }

  const scaleFactor = totalIncludedCost > 0
    ? (salePrice - totalExcludedCost) / totalIncludedCost
    : 1;

  const map = new Map<string, number>();
  for (const g of allGroups) {
    for (const it of g.items) {
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

export function PricedBoQ({ kesifA, kesifB, settings }: Props) {
  const [search, setSearch] = useState("");
  const [excludedCodes, setExcludedCodes] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const all = [...kesifA, ...kesifB];
    return Object.fromEntries(all.map((g) => [g.code, false]));
  });

  const allGroups = useMemo(() => [...kesifA, ...kesifB], [kesifA, kesifB]);

  const result = useMemo(() => calc(kesifA, kesifB, settings), [kesifA, kesifB, settings]);
  const salePrice = result.salePriceUsd;

  const salePriceMap = useMemo(
    () => buildSalePrices(allGroups, settings, excludedCodes),
    [allGroups, settings, excludedCodes]
  );

  // Group-level sale price sums
  const groupSaleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of allGroups) {
      const total = g.items.reduce((s, it) => s + (salePriceMap.get(it.code) ?? 0), 0);
      map.set(g.code, total);
    }
    return map;
  }, [allGroups, salePriceMap]);

  function toggleExclude(code: string) {
    setExcludedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  const filteredGroups = useMemo(() => {
    if (!search) return allGroups;
    const q = search.toLowerCase();
    return allGroups.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.tanim.toLowerCase().includes(q) ||
          (it.tip || "").toLowerCase().includes(q) ||
          (it.marka || "").toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [allGroups, search]);

  function handlePrintSummary() {
    const rows = allGroups.map((g) => {
      const total = groupSaleTotals.get(g.code) ?? 0;
      const isA = g.code.startsWith("A");
      return `<tr>
        <td><span class="${isA ? "badge-a" : "badge-b"}">${g.code}</span></td>
        <td>${g.name}</td>
        <td style="text-align:center">${g.items.length}</td>
        <td style="text-align:right;font-weight:700">$${fmt(total)}</td>
        <td style="text-align:right;color:#64748b">₺${fmt(total * settings.usd)}</td>
      </tr>`;
    }).join("");

    const html = buildPrintHtml(
      "Priced BoQ — Özet (Grup Bazlı)",
      `<table>
        <thead><tr>
          <th style="width:56px">Kod</th><th>Grup</th><th style="text-align:center;width:56px">Kalem</th>
          <th style="text-align:right;width:110px">Satış USD</th><th style="text-align:right;width:110px">Satış TRY</th>
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
      settings.usd
    );
    openPrint(html);
  }

  function handlePrintDetail() {
    const groupRows = allGroups.map((g) => {
      const grpTotal = groupSaleTotals.get(g.code) ?? 0;
      const isA = g.code.startsWith("A");
      const itemRows = g.items.map((it) => {
        const sp = salePriceMap.get(it.code) ?? 0;
        const excluded = excludedCodes.has(it.code);
        return `<tr class="item-row">
          <td class="code-cell">${it.code}</td>
          <td style="padding-left:18px">${it.tanim}</td>
          <td class="dim">${it.tip || ""}</td>
          <td class="dim">${it.marka || ""}</td>
          <td style="text-align:center" class="dim">${it.birim}</td>
          <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
          <td style="text-align:right;font-weight:700${excluded ? ";color:#64748b" : ""}">$${fmt(sp)}</td>
          <td style="text-align:right;color:#64748b">₺${fmt(sp * settings.usd)}</td>
        </tr>`;
      }).join("");
      return `<tr class="group-row">
        <td colspan="2"><span class="${isA ? "badge-a" : "badge-b"}">${g.code}</span> <strong>${g.name}</strong></td>
        <td colspan="4"></td>
        <td style="text-align:right;font-weight:800;color:${isA ? "#d97706" : "#7c3aed"}">$${fmt(grpTotal)}</td>
        <td style="text-align:right;color:#64748b">₺${fmt(grpTotal * settings.usd)}</td>
      </tr>${itemRows}`;
    }).join("");

    const html = buildPrintHtml(
      "Priced BoQ — Detaylı (Kalem Bazlı)",
      `<table>
        <thead><tr>
          <th style="width:52px">Kod</th><th>Tanım</th>
          <th style="width:110px">Tip</th><th style="width:90px">Marka</th>
          <th style="text-align:center;width:44px">Birim</th><th style="text-align:right;width:60px">Miktar</th>
          <th style="text-align:right;width:100px">Satış USD</th><th style="text-align:right;width:100px">Satış TRY</th>
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
      settings.usd
    );
    openPrint(html);
  }

  function handleExcel() {
    const rows: string[] = [];
    rows.push(["Kod", "Grup", "Tanım", "Tip", "Marka", "Birim", "Miktar", "Satış USD", "Satış TRY"].join("\t"));
    for (const g of allGroups) {
      for (const it of g.items) {
        const sp = salePriceMap.get(it.code) ?? 0;
        rows.push([
          it.code, g.name, it.tanim, it.tip || "", it.marka || "",
          it.birim,
          String(it.miktar),
          sp.toFixed(2),
          (sp * settings.usd).toFixed(2),
        ].join("\t"));
      }
    }
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "priced-boq.xls";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Satış Fiyatı Dağılımı — Maliyet Değildir</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Bu sekmedeki fiyatlar, toplam EPC satış fiyatının kalemlere orantısal olarak dağıtılmış halidir.
            Gerçek maliyet rakamları değildir; müşteriye gönderilmek üzere tasarlanmıştır.
            Kar dağıtılmasını istemediğiniz kalemleri <strong>⊘ Karsız</strong> olarak işaretleyin.
          </p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Priced BoQ</h2>
          <p className="text-sm text-slate-500">
            Satış Fiyatı:{" "}
            <span className="font-bold text-amber-700">${fmt(salePrice)}</span>
            {" / "}₺{fmt(salePrice * settings.usd)}
            {excludedCodes.size > 0 && (
              <span className="ml-2 text-slate-400">· {excludedCodes.size} kalem karsız</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input className="pl-8 h-8 text-sm w-44" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setCollapsed(Object.fromEntries(allGroups.map((g) => [g.code, true])))}>
            Tümünü Kapat
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCollapsed(Object.fromEntries(allGroups.map((g) => [g.code, false])))}>
            Tümünü Aç
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintSummary}>
            <FileDown className="w-4 h-4" /> Özet PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintDetail}>
            <FileDown className="w-4 h-4" /> Detay PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcel}>
            <FileDown className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-2">
        {filteredGroups.map((group) => {
          const isA = group.code.startsWith("A");
          const isCollapsed = collapsed[group.code];
          const grpTotal = groupSaleTotals.get(group.code) ?? 0;

          return (
            <Card key={group.code} className="overflow-hidden border-0 shadow-sm shadow-slate-200/60">
              <CardHeader
                className="py-2.5 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                onClick={() => setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                    <Badge variant="outline" className={`text-xs font-mono ${isA ? "border-amber-300 text-amber-700 bg-amber-50" : "border-purple-300 text-purple-700 bg-purple-50"}`}>
                      {group.code}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-slate-700">{group.name}</CardTitle>
                    <span className="text-xs text-slate-400">({group.items.length} kalem)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-600">${fmt(grpTotal)}</span>
                    <span className="text-xs text-slate-400">₺{fmt(grpTotal * settings.usd)}</span>
                    {salePrice > 0 && <span className="text-xs text-blue-400 hidden sm:inline">{(grpTotal / salePrice * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 text-left text-slate-500 font-medium w-20">Kod</th>
                          <th className="px-3 py-2 text-left text-slate-500 font-medium">Tanım</th>
                          <th className="px-3 py-2 text-left text-slate-500 font-medium w-32">Tip/Model</th>
                          <th className="px-3 py-2 text-left text-slate-500 font-medium w-28">Marka</th>
                          <th className="px-3 py-2 text-center text-slate-500 font-medium w-16">Birim</th>
                          <th className="px-3 py-2 text-right text-slate-500 font-medium w-24">Miktar</th>
                          <th className="px-3 py-2 text-right text-slate-500 font-medium w-28">Satış USD</th>
                          <th className="px-3 py-2 text-right text-slate-500 font-medium w-28">Satış TRY</th>
                          <th className="px-3 py-2 text-center text-slate-500 font-medium w-20">Kar Dağıt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((item) => {
                          const sp = salePriceMap.get(item.code) ?? 0;
                          const excluded = excludedCodes.has(item.code);
                          return (
                            <tr key={item.code} className={`transition-colors ${excluded ? "bg-slate-50/60" : "hover:bg-amber-50/30"}`}>
                              <td className={`px-3 py-1.5 font-mono ${excluded ? "text-slate-300" : "text-slate-400"}`}>{item.code}</td>
                              <td className={`px-3 py-1.5 ${excluded ? "text-slate-400" : "text-slate-800"}`}>{item.tanim}</td>
                              <td className="px-3 py-1.5 text-slate-500">{item.tip}</td>
                              <td className="px-3 py-1.5 text-slate-500">{item.marka}</td>
                              <td className="px-3 py-1.5 text-center text-slate-500 whitespace-nowrap">{item.birim}</td>
                              <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">{fmt(item.miktar, item.miktar < 100 ? 2 : 0)}</td>
                              <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${excluded ? "text-slate-400" : "text-slate-800"}`}>
                                ${fmt(sp)}
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">₺{fmt(sp * settings.usd)}</td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExclude(item.code)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                    excluded
                                      ? "border-slate-300 text-slate-400 bg-slate-100"
                                      : "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                  }`}
                                >
                                  {excluded ? "⊘ Karsız" : "✓ Karlı"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-amber-50 border-t-2 border-amber-200">
                          <td colSpan={6} className="px-3 py-2 text-right font-bold text-amber-800">{group.code} Toplam:</td>
                          <td className="px-3 py-2 text-right font-bold text-amber-700">${fmt(grpTotal)}</td>
                          <td className="px-3 py-2 text-right font-bold text-amber-600">₺{fmt(grpTotal * settings.usd)}</td>
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
        <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "2px solid #fbbf24" }}>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="font-extrabold text-amber-800 text-sm">EPC SATIŞ FİYATI TOPLAM</span>
            <div className="text-right">
              <span className="font-extrabold text-amber-700 text-base">${fmt(salePrice)}</span>
              <span className="text-amber-600 text-sm ml-3">₺{fmt(salePrice * settings.usd)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPrintHtml(title: string, tableHtml: string, salePrice: number, usd: number): string {
  function fmt2(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;font-size:9.5px;color:#111;padding:0}
    .header{background:linear-gradient(135deg,#071120 0%,#0c1e3c 50%,#122448 100%);color:#fff;padding:16px 20px 14px;display:flex;justify-content:space-between;align-items:flex-end}
    .header h1{font-size:17px;font-weight:800;color:#fff}
    .header .sub{font-size:9px;color:rgba(255,255,255,0.5);margin-top:3px}
    .header .total-badge .label{font-size:8px;color:rgba(251,191,36,0.6);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px}
    .header .total-badge .amount{font-size:22px;font-weight:900;color:#fbbf24}
    .warning{background:#fffbeb;border-bottom:2px solid #fbbf24;padding:8px 20px;font-size:9px;color:#92400e;font-weight:600}
    .accent-bar{height:3px;background:linear-gradient(90deg,#d97706,#fbbf24,transparent)}
    .content{padding:14px 20px 20px}
    table{width:100%;border-collapse:collapse}
    th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:8.5px;font-weight:700}
    td{padding:3.5px 7px;border-bottom:1px solid #f1f5f9}
    .group-row td{background:#f8fafc;border-top:2px solid #e2e8f0;border-bottom:1px solid #cbd5e1;font-size:10px;color:#1e293b;padding:5px 7px}
    .item-row:nth-child(even) td{background:#fcfcfd}
    .code-cell{color:#94a3b8;font-family:monospace;font-size:8px;width:52px}
    .dim{color:#64748b}
    .num{font-variant-numeric:tabular-nums}
    .total-row td{background:#fef3c7;font-weight:800;font-size:10px;border-top:3px double #fbbf24}
    .badge-a{display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;background:#fef3c7;color:#d97706;border:1px solid #fbbf24}
    .badge-b{display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;background:#ede9fe;color:#7c3aed;border:1px solid #a78bfa}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="header h1">${title}</div>
      <div class="sub">${new Date().toLocaleDateString("tr-TR")} · ⚠ Bu fiyatlar satış fiyatıdır, maliyet değildir</div>
    </div>
    <div class="total-badge">
      <div class="label">Satış Fiyatı</div>
      <div class="amount">$${fmt2(salePrice)}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="warning">⚠ DİKKAT: Bu belgede yer alan fiyatlar, EPC satış fiyatının kalemlere dağıtılmış halidir. Gerçek maliyet rakamları değildir.</div>
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
