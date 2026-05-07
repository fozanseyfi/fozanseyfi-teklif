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
}

export function BoQView({ projectId, projectName, project, kesifA, kesifB, settings }: Props) {
  const [search, setSearch] = useState("");
  const [showPrices, setShowPrices] = useState(false);

  const allGroups = useMemo(() => [...kesifA, ...kesifB], [kesifA, kesifB]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allGroups.map((g) => [g.code, false])),
  );

  const result = useMemo(() => calc(kesifA, kesifB, settings), [kesifA, kesifB, settings]);

  // Boş kalemler (miktar = 0) BoQ'da hep gizlenir — müşteriye gönderilen
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
    const groupRows = visibleGroups
      .map((g) => {
        const itemRows = g.items
          .map((it, idx) => {
            const unitUsd = toUSD(it.rawFiyat, it.fiyatCur, settings);
            const cost = it.miktar * unitUsd;
            const displayCode = `${g.displayGroupCode}.${idx + 1}`;
            return `<tr class="item-row">
          <td class="code-cell">${displayCode}</td>
          <td style="padding-left:18px">${escapeHtml(it.tanim)}</td>
          <td class="dim">${escapeHtml(it.tip || "")}</td>
          <td class="dim">${escapeHtml(it.marka || "")}</td>
          <td style="text-align:center" class="dim">${escapeHtml(it.birim)}</td>
          <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
          ${showPrices ? `<td style="text-align:right" class="num">$${fmt(unitUsd, it.code.startsWith("A.1") ? 3 : 2)}</td><td style="text-align:right;font-weight:700">$${fmt(cost)}</td>` : ""}
        </tr>`;
          })
          .join("");
        const grpTotal = g.items.reduce((s, it) => s + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings), 0);
        return `<tr class="group-row">
        <td colspan="6"><strong>${g.displayGroupCode} — ${escapeHtml(g.name)}</strong></td>
        ${showPrices ? `<td></td><td style="text-align:right;font-weight:700">$${fmt(grpTotal)}</td>` : ""}
      </tr>${itemRows}`;
      })
      .join("");

    const dcLabel =
      settings.dcGuc >= 1
        ? `${settings.dcGuc.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWp`
        : settings.dcGuc > 0
          ? `${(settings.dcGuc * 1000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} kWp`
          : "—";
    const acLabel =
      settings.acGuc >= 1
        ? `${settings.acGuc.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWe`
        : settings.acGuc > 0
          ? `${(settings.acGuc * 1000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} kWe`
          : "";
    // settings.il / settings.ilce kullanıcının analiz/settings'te seçtiği yapısal
    // değer; project.projectLocation ise kayıt sırasında girilen serbest metin —
    // çoğu zaman aynı bilgi. Çift yazılmaması için: yapısal değer varsa onu
    // kullan, yoksa serbest metne düş.
    const structuredLoc = [settings.il, settings.ilce]
      .filter((x): x is string => !!x && !!x.trim())
      .join(" / ");
    const location =
      structuredLoc ||
      (project.projectLocation && project.projectLocation.trim()) ||
      "";

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BoQ — ${escapeHtml(projectName)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a;padding:0}
      @page{size:A4;margin:14mm}
      .cover{background:linear-gradient(135deg,#064e3b 0%,#047857 50%,#10b981 100%);color:#fff;padding:22px 24px 18px;border-radius:0 0 12px 12px;margin-bottom:6px}
      .cover .top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
      .cover .badge{display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
      .cover h1{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;line-height:1.15}
      .cover .date{font-size:10.5px;color:rgba(255,255,255,0.75);margin-top:5px;font-weight:500}
      .cover .badge-r{text-align:right;color:#fff;flex-shrink:0}
      .cover .badge-r .label{font-size:8.5px;color:rgba(167,243,208,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:4px}
      .cover .badge-r .count{font-size:24px;font-weight:900;color:#fff;line-height:1}
      .cover .badge-r .alt{font-size:10px;color:rgba(167,243,208,0.95);font-weight:600;margin-top:4px}
      .meta-grid{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      .meta-grid .item{background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px}
      .meta-grid .item .l{font-size:8px;color:rgba(167,243,208,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:3px}
      .meta-grid .item .v{font-size:11.5px;color:#fff;font-weight:700;letter-spacing:-0.01em;line-height:1.2;word-break:break-word}
      .accent-bar{height:3px;background:linear-gradient(90deg,#047857,#10b981,transparent)}
      .content{padding:14px 22px 6px}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:9.5px}
      th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:8.5px;font-weight:700;white-space:nowrap;text-transform:uppercase;letter-spacing:0.04em}
      td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      .group-row td{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border-top:2px solid #10b981;border-bottom:1px solid #a7f3d0;font-size:10.5px;color:#065f46;padding:6px 8px;font-weight:800}
      .item-row:nth-child(even) td{background:#fcfcfd}
      .code-cell{color:#94a3b8;font-family:"Courier New",monospace;font-size:8.5px;width:62px}
      .dim{color:#64748b}
      .num{color:#334155;font-variant-numeric:tabular-nums}
      .subtotal td{background:#ecfdf5;font-weight:800;color:#047857;border-top:2px solid #a7f3d0;padding:6px 8px}
      .total-row td{background:linear-gradient(135deg,#d1fae5,#a7f3d0);font-weight:900;color:#065f46;border-top:3px solid #047857;font-size:11.5px;padding:7px 8px}
      .footer{margin-top:14px;padding:10px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="cover">
      <div class="top">
        <div>
          <span class="badge">Bill of Quantities · Kapsam Listesi</span>
          <h1>${escapeHtml(projectName)}</h1>
          <div class="date">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}</div>
        </div>
        <div class="badge-r">
          <div class="label">${showPrices ? "Toplam Tutar" : "Toplam Kalem"}</div>
          <div class="count">${showPrices ? `$${fmt(totals.grandTotal)}` : totalItems}</div>
          ${showPrices ? `<div class="alt">${visibleGroups.length} grup · ${totalItems} kalem</div>` : `<div class="alt">${visibleGroups.length} grup</div>`}
        </div>
      </div>
      <div class="meta-grid">
        ${project.customerName ? `<div class="item"><div class="l">Yatırımcı</div><div class="v">${escapeHtml(project.customerName)}</div></div>` : ""}
        ${location ? `<div class="item"><div class="l">Lokasyon</div><div class="v">${escapeHtml(location)}</div></div>` : ""}
        <div class="item"><div class="l">DC Güç</div><div class="v">${dcLabel}${acLabel ? ` <span style="opacity:0.7;font-weight:600">/ ${acLabel}</span>` : ""}</div></div>
        <div class="item"><div class="l">Kurulum Tipi</div><div class="v">${project.installationType === "ROOFTOP" ? "Çatı GES" : "Arazi GES"}</div></div>
      </div>
    </div>
    <div class="accent-bar"></div>
    <div class="content">
      <table>
        <thead><tr>
          <th style="width:62px">Kod</th>
          <th>Tanım</th>
          <th style="width:120px">Tip/Model</th>
          <th style="width:100px">Marka</th>
          <th style="text-align:center;width:44px">Birim</th>
          <th style="text-align:right;width:70px">Miktar</th>
          ${showPrices ? `<th style="text-align:right;width:80px">Birim Fiyat</th><th style="text-align:right;width:90px">Tutar (USD)</th>` : ""}
        </tr></thead>
        <tbody>${groupRows}
          ${
            showPrices
              ? `
          <tr class="subtotal"><td colspan="7" style="text-align:right">KEŞİF-A ARA TOPLAM</td><td style="text-align:right">$${fmt(totals.kaTotal)}</td></tr>
          <tr class="subtotal"><td colspan="7" style="text-align:right">KEŞİF-B ARA TOPLAM</td><td style="text-align:right">$${fmt(totals.kbTotal)}</td></tr>
          <tr class="total-row"><td colspan="7" style="text-align:right">GENEL TOPLAM</td><td style="text-align:right">$${fmt(totals.grandTotal)}</td></tr>`
              : ""
          }
        </tbody>
      </table>
    </div>
    </body></html>`;

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
          <span>
            <strong>Bilgi:</strong> BoQ müşteriye gönderilen kapsam listesidir; boş (miktar = 0)
            kalemler <strong>otomatik silinir</strong> ve görünür kalemler{" "}
            <strong>yeniden sıralanır</strong>. Bu nedenle grup içi kod numaraları
            (örn. A.1.1, A.1.2…) keşif sayfalarındaki orijinal kodlarla birebir
            uyuşmayabilir.
          </span>
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
                      {group.displayGroupCode}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {group.name}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      ({group.items.length} kalem)
                    </span>
                  </div>
                  {showPrices && (
                    <span className="text-sm font-bold tabular-nums text-primary-soft-foreground">
                      ${fmt(grpTotal)}
                    </span>
                  )}
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="w-20 px-3 py-2 text-left font-medium text-muted-foreground">Kod</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tanım</th>
                          <th className="w-32 px-3 py-2 text-left font-medium text-muted-foreground">Tip/Model</th>
                          <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">Marka</th>
                          <th className="w-16 px-3 py-2 text-center font-medium text-muted-foreground">Birim</th>
                          <th className="w-24 px-3 py-2 text-right font-medium text-muted-foreground">Miktar</th>
                          {showPrices && (
                            <>
                              <th className="w-28 px-3 py-2 text-right font-medium text-muted-foreground">
                                Birim Fiyat
                              </th>
                              <th className="w-28 px-3 py-2 text-right font-medium text-muted-foreground">
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
                              <td className="px-3 py-1.5 font-mono text-muted-foreground">{displayCode}</td>
                              <td className="px-3 py-1.5 text-foreground">{item.tanim}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.tip}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.marka}</td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-center text-muted-foreground">{item.birim}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                {fmt(item.miktar, item.miktar < 100 ? 2 : 0)}
                              </td>
                              {showPrices && (
                                <>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                                    ${fmt(unitUsd, item.code.startsWith("A.1") ? 3 : 2)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-foreground">
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
