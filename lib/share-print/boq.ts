import type { Project } from "@prisma/client";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { toUSD } from "@/lib/ges-engine";
import {
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandContext,
} from "@/lib/pdf-brand";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface BuildBoqHtmlArgs {
  project: Project;
  projectName: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  brand: BrandContext;
  firmName: string;
  userEmail: string;
  showPrices: boolean;
}

/**
 * Bill of Quantities (BoQ) — Fiyatsız (kapsam listesi) veya Fiyatlı (tutarlı)
 * yazdirilabilir HTML. Boş kalemler (miktar=0) elenir, grup kodları yeniden
 * harf-bazında numaralandirilir (A.7 boş → A.8 yeni A.7 olur).
 */
export function buildBoqPrintHtml({
  project,
  projectName,
  kesifA,
  kesifB,
  settings,
  brand,
  firmName,
  userEmail,
  showPrices,
}: BuildBoqHtmlArgs): string {
  // Visible groups — miktar=0 elenir, gruplar harf-bazında yeniden numaralandırılır
  const allGroups = [...kesifA, ...kesifB];
  const filtered = allGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => it.miktar > 0) }))
    .filter((g) => g.items.length > 0);
  let aIdx = 0;
  let bIdx = 0;
  const visibleGroups = filtered.map((g) => {
    const isA = g.code.startsWith("A");
    const newGroupCode = isA ? `A.${++aIdx}` : `B.${++bIdx}`;
    return { ...g, displayGroupCode: newGroupCode };
  });

  const totalItems = visibleGroups.reduce((s, g) => s + g.items.length, 0);

  let kaTotal = 0;
  let kbTotal = 0;
  for (const g of visibleGroups) {
    const grpSum = g.items.reduce((s, it) => s + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings), 0);
    if (g.code.startsWith("A")) kaTotal += grpSum;
    else if (g.code.startsWith("B")) kbTotal += grpSum;
  }
  const grandTotal = kaTotal + kbTotal;

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
  const structuredLoc = [settings.il, settings.ilce]
    .filter((x): x is string => !!x && !!x.trim())
    .join(" / ");
  const location =
    structuredLoc ||
    (project.projectLocation && project.projectLocation.trim()) ||
    "";

  const docId = generateDocId();

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BoQ — ${escapeHtml(projectName)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a;padding:0}
      @page{size:A4;margin:14mm}
      .cover{background:${brand.coverGradient};color:#fff;padding:22px 24px 18px;border-radius:0 0 12px 12px;margin-bottom:6px}
      .cover .top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
      .cover .badge{display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
      .cover h1{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;line-height:1.15}
      .cover .date{font-size:10.5px;color:rgba(255,255,255,0.75);margin-top:5px;font-weight:500}
      .cover .badge-r{text-align:right;color:#fff;flex-shrink:0}
      .cover .badge-r .label{font-size:8.5px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:4px}
      .cover .badge-r .count{font-size:24px;font-weight:900;color:#fff;line-height:1}
      .cover .badge-r .alt{font-size:10px;color:rgba(255,255,255,0.95);font-weight:600;margin-top:4px}
      .meta-grid{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      .meta-grid .item{background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px}
      .meta-grid .item .l{font-size:8px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:3px}
      .meta-grid .item .v{font-size:11.5px;color:#fff;font-weight:700;letter-spacing:-0.01em;line-height:1.2;word-break:break-word}
      .accent-bar{height:3px;background:${brand.accentGradient}}
      .content{padding:14px 22px 6px;position:relative;z-index:2}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:9.5px}
      th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:8.5px;font-weight:700;white-space:nowrap;text-transform:uppercase;letter-spacing:0.04em}
      td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      .group-row td{background:#f8fafc;border-top:2px solid ${brand.primary};border-bottom:1px solid #e2e8f0;font-size:10.5px;color:${brand.primaryDark};padding:6px 8px;font-weight:800}
      .item-row:nth-child(even) td{background:#fcfcfd}
      .code-cell{color:#94a3b8;font-family:"Courier New",monospace;font-size:8.5px;width:62px}
      .dim{color:#64748b}
      .num{color:#334155;font-variant-numeric:tabular-nums}
      .subtotal td{background:#f1f5f9;font-weight:800;color:${brand.primaryDark};border-top:2px solid ${brand.primary};padding:6px 8px}
      .total-row td{background:#e2e8f0;font-weight:900;color:${brand.primaryDark};border-top:3px solid ${brand.primary};font-size:11.5px;padding:7px 8px}
      .footer{margin-top:14px;padding:10px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    ${watermarkHtml(brand, firmName)}
    <div class="cover">
      ${brandRowHtml(brand, firmName)}
      <div class="top">
        <div>
          <span class="badge">Bill of Quantities · Kapsam Listesi</span>
          <h1>${escapeHtml(projectName)}</h1>
          <div class="date">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}</div>
        </div>
        <div class="badge-r">
          <div class="label">${showPrices ? "Toplam Tutar" : "Toplam Kalem"}</div>
          <div class="count">${showPrices ? `$${fmt(grandTotal)}` : totalItems}</div>
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
          <tr class="subtotal"><td colspan="7" style="text-align:right">KEŞİF-A ARA TOPLAM</td><td style="text-align:right">$${fmt(kaTotal)}</td></tr>
          <tr class="subtotal"><td colspan="7" style="text-align:right">KEŞİF-B ARA TOPLAM</td><td style="text-align:right">$${fmt(kbTotal)}</td></tr>
          <tr class="total-row"><td colspan="7" style="text-align:right">GENEL TOPLAM</td><td style="text-align:right">$${fmt(grandTotal)}</td></tr>`
              : ""
          }
        </tbody>
      </table>
    </div>
    ${brandFooterHtml(brand, firmName, userEmail, docId)}
    </body></html>`;
}
