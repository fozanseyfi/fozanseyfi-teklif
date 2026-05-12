"use client";

import { useState, useMemo } from "react";
import type { Project } from "@prisma/client";
import { saveGesSettings } from "@/app/actions/ges";
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
  AlertTriangle,
  Eye,
  EyeOff,
  RotateCcw,
  FileSpreadsheet,
} from "lucide-react";
import { downloadExcel } from "@/lib/excel-export";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";
import {
  resolveBrand,
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandContext,
  type BrandSettings,
} from "@/lib/pdf-brand";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  // Public paylasimda kullanilir:
  //   - undefined = dashboard editor modu (her sey gozukur)
  //   - "detailed" = public share detayli — editor banner ve fazla butonlar
  //                  gizli, sadece "Detay PDF" butonu gozukur
  //   - "summary"  = public share ozet — basit grup-toplam tablosu render
  //                  edilir, sadece "Ozet PDF" butonu gozukur
  mode?: "summary" | "detailed";
}

interface PrintMeta {
  projectName: string;
  customerName?: string | null;
  location?: string;
  dcLabel?: string;
  acLabel?: string;
  installationLabel?: string;
}

/**
 * Item bazli birim fiyat dagitimi.
 *
 * - hidden  : kalem PDF'te gozukmez VE toplama dahil edilmez. Onun sahip
 *             olacagi pay diger gorunur (karli) kalemlere dagitilir.
 * - excluded (karsiz): gorunur ama uzerine kar yansitilmaz; sadece
 *             maliyet kadar toplanir, kar diger karli kalemlere dagitilir.
 * - margin override (overrides[code]): kalem `cost × (1 + kar%/100)`
 *             ile sabitlenir; kalan butce diger override edilmemis karli
 *             kalemlere maliyetleri orantisinda dagitilir.
 * - default : gorunur, karli — kalan butceyi emer (uniform kar%).
 */
function buildSalePrices(
  allGroups: KesifGroup[],
  settings: GesSettings,
  excludedCodes: Set<string>,
  hiddenCodes: Set<string>,
  overrides: Record<string, number>,
): { map: Map<string, number>; defaultMarginPct: number } {
  const result = calc(
    allGroups.filter((g) => g.code.startsWith("A")),
    allGroups.filter((g) => g.code.startsWith("B")),
    settings,
  );
  const salePrice = result.salePriceUsd;

  let totalExcludedCost = 0;
  let totalOverrideSale = 0;
  let totalActiveCost = 0; // override edilmemis karli kalemler
  const costMap = new Map<string, number>();

  for (const g of allGroups) {
    for (const it of g.items) {
      if (hiddenCodes.has(it.code)) continue;
      const cost = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings);
      costMap.set(it.code, cost);
      if (excludedCodes.has(it.code)) {
        totalExcludedCost += cost;
      } else if (overrides[it.code] !== undefined) {
        totalOverrideSale += cost * (1 + overrides[it.code] / 100);
      } else {
        totalActiveCost += cost;
      }
    }
  }

  const remaining = salePrice - totalExcludedCost - totalOverrideSale;
  const scaleFactor = totalActiveCost > 0 ? remaining / totalActiveCost : 1;
  const defaultMarginPct = (scaleFactor - 1) * 100;

  const map = new Map<string, number>();
  for (const g of allGroups) {
    for (const it of g.items) {
      if (hiddenCodes.has(it.code)) {
        map.set(it.code, 0);
        continue;
      }
      const cost = costMap.get(it.code) ?? 0;
      if (excludedCodes.has(it.code)) {
        map.set(it.code, cost);
      } else if (overrides[it.code] !== undefined) {
        map.set(it.code, cost * (1 + overrides[it.code] / 100));
      } else {
        map.set(it.code, cost * scaleFactor);
      }
    }
  }
  return { map, defaultMarginPct };
}

export function PricedBoQ({ projectId, projectName, project, kesifA, kesifB, settings, firmName, brand, userEmail, mode }: Props) {
  // Brand context (PDF print icin) — printSummary/Detail handler'lari
  // buildPrintHtml'e brand'i de geciriyor.
  const brandCtx = useMemo(() => resolveBrand(brand), [brand]);
  // Müşteriye giden PDF kapağında kullanılan başlık meta-bilgileri
  const printMeta = useMemo<PrintMeta>(() => {
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
    // settings.il / settings.ilce yapısal değer; project.projectLocation
    // serbest metin — aynı bilgiyi tekrar yazmamak için yapısal varsa onu
    // kullan, yoksa serbest metne düş.
    const structuredLoc = [settings.il, settings.ilce]
      .filter((x): x is string => !!x && !!x.trim())
      .join(" / ");
    const location =
      structuredLoc ||
      (project.projectLocation && project.projectLocation.trim()) ||
      "";
    return {
      projectName,
      customerName: project.customerName,
      location,
      dcLabel,
      acLabel,
      installationLabel: project.installationType === "ROOFTOP" ? "Çatı GES" : "Arazi GES",
    };
  }, [projectName, project.customerName, project.projectLocation, project.installationType, settings.dcGuc, settings.acGuc, settings.il, settings.ilce]);

  const [search, setSearch] = useState("");
  // Karsiz/gizli isaretler proje bazli persisted — settings.pboqExcluded
  // ve settings.pboqHidden alanlari Prisma'da JSON olarak duruyor.
  const [excludedCodes, setExcludedCodes] = useState<Set<string>>(
    () => new Set(settings.pboqExcluded ?? []),
  );
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(
    () => new Set(settings.pboqHidden ?? []),
  );
  const [marginOverrides, setMarginOverrides] = useState<Record<string, number>>(
    () => settings.pboqMargins ?? {},
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const all = [...kesifA, ...kesifB];
    return Object.fromEntries(all.map((g) => [g.code, false]));
  });
  const [showHidden, setShowHidden] = useState(true);

  // Set degisiminde server'a yaz — ayri bir useEffect yerine toggle anlik
  // olarak save eder; debounce'a gerek yok cunku islem tek tikla olur.
  function persistSets(newExcluded: Set<string>, newHidden: Set<string>, newMargins: Record<string, number>) {
    saveGesSettings(projectId, {
      pboqExcluded: Array.from(newExcluded),
      pboqHidden: Array.from(newHidden),
      pboqMargins: newMargins,
    } as never).catch(() => {});
  }

  const allGroups = useMemo(() => [...kesifA, ...kesifB], [kesifA, kesifB]);

  const result = useMemo(() => calc(kesifA, kesifB, settings), [kesifA, kesifB, settings]);
  const salePrice = result.salePriceUsd;

  const { map: salePriceMap, defaultMarginPct } = useMemo(
    () => buildSalePrices(allGroups, settings, excludedCodes, hiddenCodes, marginOverrides),
    [allGroups, settings, excludedCodes, hiddenCodes, marginOverrides],
  );

  // Display group code map — gorunur (en az bir gorunur kalemi olan) gruplar
  // harf-bazinda yeniden numaralandirilir. Boylece gizli/silinmis kalemler
  // sebebiyle olusan A.6 -> A.8 atlamalari engellenir, musteri butun kodlari
  // ardisik gorur.
  const displayGroupCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    let aIdx = 0;
    let bIdx = 0;
    for (const g of allGroups) {
      const visibleCount = g.items.filter((it) => !hiddenCodes.has(it.code)).length;
      if (visibleCount === 0) continue;
      const isA = g.code.startsWith("A");
      map.set(g.code, isA ? `A.${++aIdx}` : `B.${++bIdx}`);
    }
    return map;
  }, [allGroups, hiddenCodes]);

  function getDisplayGroupCode(originalCode: string): string {
    return displayGroupCodeMap.get(originalCode) ?? originalCode;
  }

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
      // Karsiz isaretlenince override anlamsiz — temizle
      let nextMargins = marginOverrides;
      if (next.has(code) && marginOverrides[code] !== undefined) {
        nextMargins = { ...marginOverrides };
        delete nextMargins[code];
        setMarginOverrides(nextMargins);
      }
      persistSets(next, hiddenCodes, nextMargins);
      return next;
    });
  }

  function toggleHidden(code: string) {
    setHiddenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      let nextMargins = marginOverrides;
      if (next.has(code) && marginOverrides[code] !== undefined) {
        nextMargins = { ...marginOverrides };
        delete nextMargins[code];
        setMarginOverrides(nextMargins);
      }
      persistSets(excludedCodes, next, nextMargins);
      return next;
    });
  }

  function setMarginOverride(code: string, pct: number) {
    const next = { ...marginOverrides, [code]: pct };
    setMarginOverrides(next);
    persistSets(excludedCodes, hiddenCodes, next);
  }

  function clearMarginOverride(code: string) {
    if (marginOverrides[code] === undefined) return;
    const next = { ...marginOverrides };
    delete next[code];
    setMarginOverrides(next);
    persistSets(excludedCodes, hiddenCodes, next);
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
        const dispCode = getDisplayGroupCode(g.code);
        return `<tr>
        <td><span class="${isA ? "badge-a" : "badge-b"}">${dispCode}</span></td>
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
      printMeta,
      brandCtx,
      firmName,
      userEmail,
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
        const dispCode = getDisplayGroupCode(g.code);
        const itemRows = g.items
          .map((it, idx) => {
            const sp = salePriceMap.get(it.code) ?? 0;
            const unitPrice = it.miktar > 0 ? sp / it.miktar : 0;
            // Display: yeniden numaralandırılmış grup koduyla birlikte
            const displayCode = `${dispCode}.${idx + 1}`;
            return `<tr class="item-row">
          <td class="code-cell">${displayCode}</td>
          <td style="padding-left:18px">${it.tanim}</td>
          <td class="dim">${it.tip || ""}</td>
          <td class="dim">${it.marka || ""}</td>
          <td style="text-align:center" class="dim">${it.birim}</td>
          <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
          <td style="text-align:right">$${fmt(unitPrice, it.code.startsWith("A.1") ? 3 : 2)}</td>
          <td style="text-align:right;font-weight:700">$${fmt(sp)}</td>
        </tr>`;
          })
          .join("");
        return `<tr class="group-row">
        <td colspan="7" style="white-space:nowrap"><span class="${isA ? "badge-a" : "badge-b"}">${dispCode}</span> <strong>${g.name}</strong></td>
        <td style="text-align:right;font-weight:800;color:${isA ? "#059669" : "#047857"};white-space:nowrap">$${fmt(grpTotal)}</td>
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
          <th style="text-align:right;width:90px">Birim Fiyat</th><th style="text-align:right;width:100px">Tutar (USD)</th>
        </tr></thead>
        <tbody>${groupRows}
          <tr class="total-row">
            <td colspan="7" style="text-align:right">GENEL TOPLAM</td>
            <td style="text-align:right">$${fmt(salePrice)}</td>
          </tr>
        </tbody>
      </table>`,
      salePrice,
      settings.usd,
      printMeta,
      brandCtx,
      firmName,
      userEmail,
    );
    openPrint(html);
  }

  function handleExcel() {
    const groupRows = allGroups
      .map((g) => {
        const visibleItems = g.items.filter((it) => !hiddenCodes.has(it.code));
        if (visibleItems.length === 0) return "";
        const grpTotal = groupSaleTotals.get(g.code) ?? 0;
        const dispCode = getDisplayGroupCode(g.code);
        const itemRows = visibleItems
          .map((it, idx) => {
            const sp = salePriceMap.get(it.code) ?? 0;
            const unitPrice = it.miktar > 0 ? sp / it.miktar : 0;
            const displayCode = `${dispCode}.${idx + 1}`;
            return `<tr class="item-row${idx % 2 ? " alt" : ""}">
              <td>${displayCode}</td>
              <td>${escapeHtml(it.tanim)}</td>
              <td class="dim">${escapeHtml(it.tip || "")}</td>
              <td class="dim">${escapeHtml(it.marka || "")}</td>
              <td class="center">${escapeHtml(it.birim)}</td>
              <td class="num">${it.miktar}</td>
              <td class="num">${unitPrice.toFixed(it.code.startsWith("A.1") ? 3 : 2)}</td>
              <td class="num">${sp.toFixed(2)}</td>
            </tr>`;
          })
          .join("");
        return `<tr class="group-row">
          <td colspan="7">${dispCode} — ${escapeHtml(g.name)}</td>
          <td class="num">${grpTotal.toFixed(2)}</td>
        </tr>${itemRows}`;
      })
      .join("");

    const html = `<table>
      <thead>
        <tr>
          <th>Kod</th>
          <th>Tanım</th>
          <th>Tip / Model</th>
          <th>Marka</th>
          <th>Birim</th>
          <th>Miktar</th>
          <th>Birim Fiyat (USD)</th>
          <th>Tutar (USD)</th>
        </tr>
      </thead>
      <tbody>
        ${groupRows}
        <tr class="grand-total">
          <td colspan="7">GENEL TOPLAM (USD)</td>
          <td class="num">${salePrice.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>`;
    downloadExcel(`Birim-Fiyat-Cetveli-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}`, html);
  }

  return (
    <div className="space-y-4">
      {/* Editor uyari banner — sadece dahili kullanim icin, public share'de
          mode set oldugunda gizli (musteri editor talimatlarini gormesin). */}
      {!mode && (
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
              çıkarılır ve onun payı diğer kalemlere otomatik dağıtılır.{" "}
              <strong>Kar %</strong> sütunundan bir kaleme özel marj girince diğer
              kalemler kalan bütçeyi orantısal absorbe eder. Kar oranları sadece
              editör için — PDF/Excel'de gözükmez.
            </p>
          </div>
        </div>
      )}

      {(() => {
        const allOpen = filteredGroups.every((g) => !collapsed[g.code]);
        return (
          <DetailPageHeader
            kicker="Birim Fiyat Cetveli"
            title={projectName}
            backHref={prevHref(projectId, "/priced-boq")}
            stats={
              <>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 font-bold text-primary-soft-foreground">
                  Toplam ${fmt(salePrice)} / ₺{fmt(salePrice * settings.usd)}
                </span>
                {/* Kar % ve editor-ozel meta yazilari sadece dashboard
                    editorde gozukur. Public share (mode set) icin gizli. */}
                {!mode && (
                  <>
                    <span className="text-[11px] text-muted-foreground">
                      · varsayılan kar %{defaultMarginPct.toFixed(1)}
                    </span>
                    {excludedCodes.size > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        · {excludedCodes.size} karsız
                      </span>
                    )}
                    {hiddenCodes.size > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        · {hiddenCodes.size} gizli
                      </span>
                    )}
                    {Object.keys(marginOverrides).length > 0 && (
                      <span className="text-[11px] text-info-soft-foreground">
                        · {Object.keys(marginOverrides).length} kalemde özel kar
                      </span>
                    )}
                  </>
                )}
              </>
            }
            actions={
              <>
                {(!mode || mode === "summary") && (
                  <Button variant="outline" size="sm" onClick={handlePrintSummary}>
                    <FileDown className="size-3.5" /> Özet PDF
                  </Button>
                )}
                {(!mode || mode === "detailed") && (
                  <Button variant="outline" size="sm" onClick={handlePrintDetail}>
                    <FileDown className="size-3.5" /> Detay PDF
                  </Button>
                )}
                {!mode && (
                  <Button variant="outline" size="sm" onClick={handleExcel}>
                    <FileSpreadsheet className="size-3.5" /> Excel
                  </Button>
                )}
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
                {!mode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHidden((v) => !v)}
                    title={showHidden ? "Gizli kalemleri gizle" : "Gizli kalemleri göster"}
                  >
                    {showHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {showHidden ? "Gizliler görünür" : "Gizliler kapalı"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCollapsed(
                      Object.fromEntries(allGroups.map((g) => [g.code, allOpen])),
                    )
                  }
                >
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
              // Editor bilgilendirmesi — public share'de gizli (musteri zaten
              // pozisyon-bazli numaralari "dogal" siralama olarak alir).
              !mode && hiddenCodes.size > 0 ? (
                <span>
                  <strong>Bilgi:</strong> Gizlenen {hiddenCodes.size} kalem listede görünmüyor; kod
                  numaraları görünür kalemlere göre <strong>yeniden sıralandı</strong>. Orijinal
                  kodlar yerine pozisyon-bazlı numaralar gösterilir, böylece müşteri kod boşluğu
                  görmez.
                </span>
              ) : undefined
            }
          />
        );
      })()}

      {/* Public share summary view — basit grup-toplam tablosu, mevcut detayli
          gorunumun yerini alir. Yalnizca mode === "summary" oldugunda render
          edilir; dashboard editoru ve detayli paylasimda atlanir. */}
      {mode === "summary" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="w-16 px-3 py-2.5 text-left font-medium">Kod</th>
                <th className="px-3 py-2.5 text-left font-medium">Grup</th>
                <th className="w-20 px-3 py-2.5 text-center font-medium">Kalem</th>
                <th className="w-32 px-3 py-2.5 text-right font-medium">USD</th>
                <th className="w-32 px-3 py-2.5 text-right font-medium">TRY</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allGroups
                .map((g) => ({
                  ...g,
                  items: g.items.filter((it) => !hiddenCodes.has(it.code)),
                }))
                .filter((g) => g.items.length > 0)
                .map((g) => {
                  const grpTotal = groupSaleTotals.get(g.code) ?? 0;
                  const isA = g.code.startsWith("A");
                  const dispCode = getDisplayGroupCode(g.code);
                  return (
                    <tr key={g.code} className="hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono text-xs",
                            isA
                              ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                              : "border-info/30 bg-info-soft text-info-soft-foreground",
                          )}
                        >
                          {dispCode}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{g.name}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                        {g.items.length}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                        ${fmt(grpTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                        ₺{fmt(grpTotal * settings.usd)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-primary-soft">
                <td colSpan={3} className="px-3 py-3 text-right font-semibold text-primary-soft-foreground">
                  GENEL TOPLAM
                </td>
                <td className="px-3 py-3 text-right font-bold text-primary-soft-foreground tabular-nums">
                  ${fmt(salePrice)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-primary-soft-foreground/80 tabular-nums">
                  ₺{fmt(salePrice * settings.usd)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detailed groups view — public share detailed + dashboard editor.
          mode === "summary" oldugunda atlanir. */}
      {mode !== "summary" && (
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

          // Goruntu kodu: gizli kalemler atlanir, sadece visible'lar
          // ardisik numaralanir. Grup kodu da yeniden numaralandırılmış
          // displayGroupCode kullanır (örn. orijinal A.6 boş kaldıysa A.5).
          const dispGroupCode = getDisplayGroupCode(group.code);
          const displayCodeMap = new Map<string, string>();
          let visIdx = 0;
          for (const it of group.items) {
            if (hiddenCodes.has(it.code)) continue;
            visIdx += 1;
            displayCodeMap.set(it.code, `${dispGroupCode}.${visIdx}`);
          }

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
                      {dispGroupCode}
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
                    {/* Mobile (sm/md altı): public share modunda (mode set) Tip/Marka/Birim
                        sütunları gizli, müşteri sadece Kod-Tanım-Miktar-Fiyat görür. */}
                    <table className="w-full text-[12px] sm:text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="w-14 px-2 py-2 text-left font-medium text-muted-foreground sm:w-20 sm:px-3">
                            Kod
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-3">
                            Tanım
                          </th>
                          <th className={cn("w-32 px-3 py-2 text-left font-medium text-muted-foreground", mode && "hidden md:table-cell")}>
                            Tip/Model
                          </th>
                          <th className={cn("w-28 px-3 py-2 text-left font-medium text-muted-foreground", mode && "hidden md:table-cell")}>
                            Marka
                          </th>
                          <th className={cn("w-16 px-3 py-2 text-center font-medium text-muted-foreground", mode && "hidden sm:table-cell")}>
                            Birim
                          </th>
                          <th className="w-20 px-2 py-2 text-right font-medium text-muted-foreground sm:w-24 sm:px-3">
                            Miktar
                          </th>
                          <th className={cn("w-28 px-3 py-2 text-right font-medium text-muted-foreground", mode && "hidden sm:table-cell")}>
                            Birim Fiyat
                          </th>
                          <th className="w-20 px-2 py-2 text-right font-medium text-muted-foreground sm:w-28 sm:px-3">
                            Tutar (USD)
                          </th>
                          <th data-edit-only className="w-28 px-3 py-2 text-center font-medium text-muted-foreground">
                            Kar %
                          </th>
                          <th data-edit-only className="w-44 px-3 py-2 text-center font-medium text-muted-foreground">
                            Durum
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {renderedItems.map((item) => {
                          const sp = salePriceMap.get(item.code) ?? 0;
                          const cost = item.miktar * toUSD(item.rawFiyat, item.fiyatCur, settings);
                          const excluded = excludedCodes.has(item.code);
                          const hidden = hiddenCodes.has(item.code);
                          const overrideVal = marginOverrides[item.code];
                          const hasOverride = overrideVal !== undefined;
                          const currentKarPct = cost > 0 ? (sp / cost - 1) * 100 : 0;
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
                                  "whitespace-nowrap px-2 py-2 align-top font-mono text-[11px] sm:px-3 sm:py-1.5 sm:text-xs",
                                  hidden || excluded
                                    ? "text-muted-foreground/60"
                                    : "text-muted-foreground",
                                )}
                              >
                                {hidden ? item.code : (displayCodeMap.get(item.code) ?? item.code)}
                              </td>
                              <td
                                className={cn(
                                  "px-2 py-2 align-top sm:px-3 sm:py-1.5",
                                  hidden || excluded ? "text-muted-foreground" : "text-foreground",
                                )}
                              >
                                {item.tanim}
                                {/* Mobile fallback: Tip/Marka public share modunda Tanım altına */}
                                {mode && (item.tip || item.marka) && (
                                  <span className="mt-0.5 block text-[10.5px] text-muted-foreground md:hidden">
                                    {[item.tip, item.marka].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </td>
                              <td className={cn("px-3 py-1.5 align-top text-muted-foreground", mode && "hidden md:table-cell")}>{item.tip}</td>
                              <td className={cn("px-3 py-1.5 align-top text-muted-foreground", mode && "hidden md:table-cell")}>{item.marka}</td>
                              <td className={cn("whitespace-nowrap px-3 py-1.5 text-center align-top text-muted-foreground", mode && "hidden sm:table-cell")}>
                                {item.birim}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right align-top tabular-nums text-foreground sm:px-3 sm:py-1.5">
                                {fmt(item.miktar, item.miktar < 100 ? 2 : 0)}
                                {mode && (
                                  <span className="ml-1 text-[10.5px] font-normal text-muted-foreground sm:hidden">
                                    {item.birim}
                                  </span>
                                )}
                              </td>
                              <td
                                className={cn(
                                  "whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums",
                                  mode && "hidden sm:table-cell",
                                  hidden
                                    ? "text-muted-foreground line-through"
                                    : excluded
                                      ? "text-muted-foreground"
                                      : "text-foreground",
                                )}
                              >
                                ${fmt(item.miktar > 0 ? sp / item.miktar : 0, item.code.startsWith("A.1") ? 3 : 2)}
                              </td>
                              <td
                                className={cn(
                                  "whitespace-nowrap px-2 py-2 text-right align-top font-semibold tabular-nums sm:px-3 sm:py-1.5",
                                  hidden
                                    ? "text-muted-foreground line-through"
                                    : excluded
                                      ? "text-muted-foreground"
                                      : "text-foreground",
                                )}
                              >
                                ${fmt(sp)}
                              </td>
                              <td data-edit-only className="px-2 py-1.5">
                                {hidden || excluded ? (
                                  <span className="block text-center text-[11px] text-muted-foreground/60">—</span>
                                ) : (
                                  <KarPctEditor
                                    value={currentKarPct}
                                    isOverride={hasOverride}
                                    onCommit={(v) => setMarginOverride(item.code, v)}
                                    onClear={() => clearMarginOverride(item.code)}
                                  />
                                )}
                              </td>
                              <td data-edit-only className="px-3 py-1.5">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    data-edit-only
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
                                    data-edit-only
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
                          <td colSpan={7} className="px-3 py-2 text-right font-semibold text-primary-soft-foreground">
                            {dispGroupCode} Toplam:
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-primary-soft-foreground">
                            ${fmt(grpTotal)}
                          </td>
                          <td data-edit-only />
                          <td data-edit-only />
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
      )}
    </div>
  );
}

/**
 * Kalem-bazli kar% editoru. Override yokken otomatik dagitilan kar% gri
 * gosterilir; kullanici input'a yazip Enter/blur yapinca override olur,
 * kucuk reset butonu ile geri otomatik moda doner.
 */
function KarPctEditor({
  value,
  isOverride,
  onCommit,
  onClear,
}: {
  value: number;
  isOverride: boolean;
  onCommit: (v: number) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(value.toFixed(1));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const v = parseFloat(draft);
    if (!isNaN(v) && Math.abs(v - value) > 0.01) onCommit(parseFloat(v.toFixed(2)));
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {editing ? (
        <input
          type="number"
          step="0.1"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-6 w-16 rounded-md border bg-background px-1.5 text-center text-[11px] font-semibold tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <>
          <button
            data-edit-only
            type="button"
            onClick={startEdit}
            title={isOverride ? "Özel kar oranı — değiştirmek için tıkla" : "Otomatik dağıtım — özelleştirmek için tıkla"}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors",
              isOverride
                ? "border-info/30 bg-info-soft text-info-soft-foreground hover:bg-info-soft/70"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            %{value.toFixed(1)}
          </button>
          {/* Salt-okunurda butonun yerini alir — sadece deger gozukur */}
          <span
            className={cn(
              "readonly-only items-center text-[11px] font-semibold tabular-nums",
              isOverride ? "text-info-soft-foreground" : "text-muted-foreground",
            )}
          >
            %{value.toFixed(1)}
          </span>
        </>
      )}
      {isOverride && !editing && (
        <button
          data-edit-only
          type="button"
          onClick={onClear}
          title="Otomatik dağıtıma dön"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  );
}

function buildPrintHtml(
  title: string,
  tableHtml: string,
  salePrice: number,
  usd: number,
  meta: PrintMeta,
  brand: BrandContext,
  firmName: string,
  userEmail: string,
): string {
  function fmt2(n: number) {
    return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  const safe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const docId = generateDocId();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} — ${safe(meta.projectName)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a;padding:0}
    @page{size:A4;margin:14mm}
    .cover{background:${brand.coverGradient};color:#fff;padding:22px 24px 18px;border-radius:0 0 12px 12px;margin-bottom:6px;position:relative;z-index:2}
    .cover .top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
    .cover .badge{display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
    .cover h1{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;line-height:1.15}
    .cover .date{font-size:10.5px;color:rgba(255,255,255,0.75);margin-top:5px;font-weight:500}
    .cover .badge-r{text-align:right;color:#fff;flex-shrink:0;padding-left:18px}
    .cover .badge-r .label{font-size:8.5px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:4px}
    .cover .badge-r .amount{font-size:24px;font-weight:900;color:#fff;line-height:1}
    .cover .badge-r .alt{font-size:10px;color:rgba(255,255,255,0.95);font-weight:600;margin-top:5px}
    .meta-grid{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .meta-grid .item{background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px}
    .meta-grid .item .l{font-size:8px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:3px}
    .meta-grid .item .v{font-size:11.5px;color:#fff;font-weight:700;letter-spacing:-0.01em;line-height:1.2;word-break:break-word}
    .accent-bar{height:3px;background:${brand.accentGradient}}
    .content{padding:14px 22px 6px;position:relative;z-index:2}
    table{width:100%;border-collapse:collapse;font-size:9.5px}
    th{background:#1e293b;color:#fff;padding:7px 9px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
    td{padding:5px 9px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .group-row td{background:#f8fafc;border-top:2px solid ${brand.primary};border-bottom:1px solid #e2e8f0;font-size:10.5px;color:${brand.primaryDark};padding:6px 9px;font-weight:700}
    .item-row:nth-child(even) td{background:#fcfcfd}
    .code-cell{color:#94a3b8;font-family:"Courier New",monospace;font-size:8.5px;width:58px}
    .dim{color:#64748b}
    .num{font-variant-numeric:tabular-nums;text-align:right}
    .total-row td{background:#e2e8f0;font-weight:800;font-size:11px;color:${brand.primaryDark};border-top:3px double ${brand.primary};padding:7px 9px}
    .badge-a{display:inline-block;padding:2px 6px;border-radius:5px;font-size:8.5px;font-weight:800;background:#ecfdf5;color:#047857;border:1px solid #34d399}
    .badge-b{display:inline-block;padding:2px 6px;border-radius:5px;font-size:8.5px;font-weight:800;background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  ${watermarkHtml(brand, firmName)}
  <div class="cover">
    ${brandRowHtml(brand, firmName)}
    <div class="top">
      <div>
        <span class="badge">${safe(title)}</span>
        <h1>${safe(meta.projectName)}</h1>
        <div class="date">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}</div>
      </div>
      <div class="badge-r">
        <div class="label">Toplam Tutar</div>
        <div class="amount">$${fmt2(salePrice)}</div>
        <div class="alt">₺${fmt2(salePrice * usd)}</div>
      </div>
    </div>
    <div class="meta-grid">
      ${meta.customerName ? `<div class="item"><div class="l">Yatırımcı</div><div class="v">${safe(meta.customerName)}</div></div>` : ""}
      ${meta.location ? `<div class="item"><div class="l">Lokasyon</div><div class="v">${safe(meta.location)}</div></div>` : ""}
      <div class="item"><div class="l">DC Güç</div><div class="v">${meta.dcLabel ?? "—"}${meta.acLabel ? ` <span style="opacity:0.7;font-weight:600">/ ${meta.acLabel}</span>` : ""}</div></div>
      <div class="item"><div class="l">Kurulum Tipi</div><div class="v">${meta.installationLabel ?? "—"}</div></div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="content">${tableHtml}</div>
  ${brandFooterHtml(brand, firmName, userEmail, docId)}
  </body></html>`;
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
