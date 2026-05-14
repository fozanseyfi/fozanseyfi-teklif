import type { Project } from "@prisma/client";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { calc, toUSD } from "@/lib/ges-engine";
import {
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandContext,
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

interface PrintMeta {
  projectName: string;
  customerName?: string | null;
  location?: string;
  dcLabel?: string;
  acLabel?: string;
  installationLabel?: string;
}

// Item bazli birim fiyat dagitimi — priced-boq.tsx ile birebir aynı.
// hidden/excluded/margin override mantığı korunur.
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
  let totalActiveCost = 0;
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

function buildShellHtml(
  title: string,
  tableHtml: string,
  salePrice: number,
  usd: number,
  meta: PrintMeta,
  brand: BrandContext,
  firmName: string,
  userEmail: string,
): string {
  const docId = generateDocId();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} — ${escapeHtml(meta.projectName)}</title>
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
        <span class="badge">${escapeHtml(title)}</span>
        <h1>${escapeHtml(meta.projectName)}</h1>
        <div class="date">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}</div>
      </div>
      <div class="badge-r">
        <div class="label">Toplam Tutar</div>
        <div class="amount">$${fmt(salePrice)}</div>
        <div class="alt">₺${fmt(salePrice * usd)}</div>
      </div>
    </div>
    <div class="meta-grid">
      ${meta.customerName ? `<div class="item"><div class="l">Yatırımcı</div><div class="v">${escapeHtml(meta.customerName)}</div></div>` : ""}
      ${meta.location ? `<div class="item"><div class="l">Lokasyon</div><div class="v">${escapeHtml(meta.location)}</div></div>` : ""}
      <div class="item"><div class="l">DC Güç</div><div class="v">${meta.dcLabel ?? "—"}${meta.acLabel ? ` <span style="opacity:0.7;font-weight:600">/ ${meta.acLabel}</span>` : ""}</div></div>
      <div class="item"><div class="l">Kurulum Tipi</div><div class="v">${meta.installationLabel ?? "—"}</div></div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="content">${tableHtml}</div>
  ${brandFooterHtml(brand, firmName, userEmail, docId)}
  </body></html>`;
}

interface BuildPricedBoqArgs {
  project: Project;
  projectName: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  brand: BrandContext;
  firmName: string;
  userEmail: string;
}

function buildMeta(project: Project, projectName: string, settings: GesSettings): PrintMeta {
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
}

function preparePricedData(args: BuildPricedBoqArgs) {
  const { kesifA, kesifB, settings } = args;
  const allGroups = [...kesifA, ...kesifB];
  const excludedCodes = new Set<string>(settings.pboqExcluded ?? []);
  const hiddenCodes = new Set<string>(settings.pboqHidden ?? []);
  const marginOverrides: Record<string, number> = settings.pboqMargins ?? {};

  const result = calc(kesifA, kesifB, settings);
  const salePrice = result.salePriceUsd;

  const { map: salePriceMap } = buildSalePrices(
    allGroups,
    settings,
    excludedCodes,
    hiddenCodes,
    marginOverrides,
  );

  // Display group code map — gorunur (en az bir gorunur kalemi olan) gruplar
  // harf-bazinda yeniden numaralandirilir.
  const displayGroupCodeMap = new Map<string, string>();
  let aIdx = 0;
  let bIdx = 0;
  for (const g of allGroups) {
    const visibleCount = g.items.filter((it) => !hiddenCodes.has(it.code)).length;
    if (visibleCount === 0) continue;
    const isA = g.code.startsWith("A");
    displayGroupCodeMap.set(g.code, isA ? `A.${++aIdx}` : `B.${++bIdx}`);
  }

  // Group-level visible totals
  const groupSaleTotals = new Map<string, number>();
  for (const g of allGroups) {
    let total = 0;
    for (const it of g.items) {
      if (hiddenCodes.has(it.code)) continue;
      total += salePriceMap.get(it.code) ?? 0;
    }
    groupSaleTotals.set(g.code, total);
  }

  return {
    allGroups,
    hiddenCodes,
    salePrice,
    salePriceMap,
    groupSaleTotals,
    displayGroupCodeMap,
  };
}

/**
 * Birim Fiyat Cetveli — ÖZET. Sadece grup başlıkları, her grubun kalem
 * sayısı ve toplam tutarı listelenir.
 */
export function buildPricedBoqSummaryHtml(args: BuildPricedBoqArgs): string {
  const { project, projectName, settings, brand, firmName, userEmail } = args;
  const { allGroups, hiddenCodes, salePrice, groupSaleTotals, displayGroupCodeMap } =
    preparePricedData(args);

  // Sadece visible (en az 1 görünür kalem) gruplar
  const visibleGroups = allGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !hiddenCodes.has(it.code)) }))
    .filter((g) => g.items.length > 0);

  const rows = visibleGroups
    .map((g) => {
      const total = groupSaleTotals.get(g.code) ?? 0;
      const isA = g.code.startsWith("A");
      const dispCode = displayGroupCodeMap.get(g.code) ?? g.code;
      return `<tr>
        <td><span class="${isA ? "badge-a" : "badge-b"}">${dispCode}</span></td>
        <td>${escapeHtml(g.name)}</td>
        <td style="text-align:center">${g.items.length}</td>
        <td style="text-align:right;font-weight:700">$${fmt(total)}</td>
        <td style="text-align:right;color:#64748b">₺${fmt(total * settings.usd)}</td>
      </tr>`;
    })
    .join("");

  const tableHtml = `<table>
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
    </table>`;

  return buildShellHtml(
    "Birim Fiyat Cetveli — Özet",
    tableHtml,
    salePrice,
    settings.usd,
    buildMeta(project, projectName, settings),
    brand,
    firmName,
    userEmail,
  );
}

/**
 * Birim Fiyat Cetveli — DETAYLI. Grup başına tüm kalemler, satış birim
 * fiyatı + tutarı ile listelenir.
 */
export function buildPricedBoqDetailedHtml(args: BuildPricedBoqArgs): string {
  const { project, projectName, settings, brand, firmName, userEmail } = args;
  const { allGroups, hiddenCodes, salePrice, salePriceMap, groupSaleTotals, displayGroupCodeMap } =
    preparePricedData(args);

  const visibleGroups = allGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !hiddenCodes.has(it.code)) }))
    .filter((g) => g.items.length > 0);

  const groupRows = visibleGroups
    .map((g) => {
      const grpTotal = groupSaleTotals.get(g.code) ?? 0;
      const isA = g.code.startsWith("A");
      const dispCode = displayGroupCodeMap.get(g.code) ?? g.code;
      const itemRows = g.items
        .map((it, idx) => {
          const sp = salePriceMap.get(it.code) ?? 0;
          const unitPrice = it.miktar > 0 ? sp / it.miktar : 0;
          const displayCode = `${dispCode}.${idx + 1}`;
          return `<tr class="item-row">
          <td class="code-cell">${displayCode}</td>
          <td style="padding-left:18px">${escapeHtml(it.tanim)}</td>
          <td class="dim">${escapeHtml(it.tip || "")}</td>
          <td class="dim">${escapeHtml(it.marka || "")}</td>
          <td style="text-align:center" class="dim">${escapeHtml(it.birim)}</td>
          <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
          <td style="text-align:right">$${fmt(unitPrice, it.code.startsWith("A.1") ? 3 : 2)}</td>
          <td style="text-align:right;font-weight:700">$${fmt(sp)}</td>
        </tr>`;
        })
        .join("");
      return `<tr class="group-row">
        <td colspan="7" style="white-space:nowrap"><span class="${isA ? "badge-a" : "badge-b"}">${dispCode}</span> <strong>${escapeHtml(g.name)}</strong></td>
        <td style="text-align:right;font-weight:800;color:${isA ? "#059669" : "#047857"};white-space:nowrap">$${fmt(grpTotal)}</td>
      </tr>${itemRows}`;
    })
    .join("");

  const tableHtml = `<table>
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
    </table>`;

  return buildShellHtml(
    "Birim Fiyat Cetveli — Detaylı",
    tableHtml,
    salePrice,
    settings.usd,
    buildMeta(project, projectName, settings),
    brand,
    firmName,
    userEmail,
  );
}
