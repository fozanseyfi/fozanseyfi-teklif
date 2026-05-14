import { toUSD, getGrpTot } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import {
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandContext,
} from "@/lib/pdf-brand";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

interface BuildKesifHtmlArgs {
  title: string;
  groups: KesifGroup[];
  settings: GesSettings;
  grandTotal: number;
  brand: BrandContext;
  firmName: string;
  userEmail: string;
}

/**
 * Kesif-A / Kesif-B icin yazdirilabilir HTML uretir. Hem client tarafindaki
 * "PDF Indir" butonu hem de server tarafindaki combined-pdf endpoint ayni
 * cikti icin bu fonksiyonu cagirir.
 */
export function buildKesifPrintHtml({
  title,
  groups,
  settings,
  grandTotal,
  brand,
  firmName,
  userEmail,
}: BuildKesifHtmlArgs): string {
  const isA = title.includes("A");
  const accentColor = brand.primary !== "#059669" ? brand.primary : (isA ? "#059669" : "#7c3aed");
  const accentLight = brand.primary !== "#059669" ? brand.primaryLight + "20" : (isA ? "#ecfdf5" : "#ede9fe");
  const accentBorder = brand.primary !== "#059669" ? brand.primary : (isA ? "#34d399" : "#a78bfa");
  const docId = generateDocId();

  const rows = groups
    .map((g) => {
      const grpTotal = getGrpTot(g, settings);
      const itemRows = g.items
        .map((it) => {
          const total = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings);
          return `<tr class="item-row">
        <td class="code-cell">${it.code}</td>
        <td style="padding-left:18px">${it.tanim}</td>
        <td class="dim">${it.tip || ""}</td>
        <td class="dim">${it.marka || ""}</td>
        <td style="text-align:center" class="dim">${it.birim}</td>
        <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
        <td style="text-align:right" class="dim">${it.rawFiyat.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${it.fiyatCur}</td>
        <td style="text-align:right;font-weight:700;color:#1e293b">$${fmt(total)}</td>
        <td style="text-align:right" class="dim">₺${fmt(total * settings.usd)}</td>
      </tr>`;
        })
        .join("");
      return `<tr class="group-row">
      <td colspan="2"><strong>${g.code} — ${g.name}</strong></td>
      <td colspan="4"></td>
      <td></td>
      <td style="text-align:right;font-weight:800;color:${accentColor}">$${fmt(grpTotal)}</td>
      <td style="text-align:right" class="dim">₺${fmt(grpTotal * settings.usd)}</td>
    </tr>${itemRows}`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a;padding:0}
    @page{size:A4;margin:14mm}
    .header{background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:16px 20px 14px;display:flex;justify-content:space-between;align-items:flex-end}
    .header h1{font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#fff}
    .header .sub{font-size:9px;color:rgba(255,255,255,0.5);margin-top:3px}
    .header .total-badge{text-align:right}
    .header .total-badge .label{font-size:8px;color:rgba(${isA ? "52,211,153" : "167,139,250"},0.7);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px}
    .header .total-badge .amount{font-size:22px;font-weight:800;color:${accentBorder};letter-spacing:-0.02em}
    .accent-bar{height:3px;background:linear-gradient(90deg,${accentColor},${accentBorder},transparent)}
    .content{padding:14px 20px 20px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:8.5px;font-weight:600;white-space:nowrap}
    td{padding:3.5px 7px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .group-row td{background:#f8fafc;border-top:2px solid #e2e8f0;border-bottom:1px solid #cbd5e1;font-size:10px;color:#1e293b;padding:5px 7px}
    .item-row:nth-child(even) td{background:#fcfcfd}
    .code-cell{color:#94a3b8;font-family:monospace;font-size:8px;width:52px}
    .dim{color:#64748b}
    .num{color:#334155;font-variant-numeric:tabular-nums}
    .total-row td{background:${accentLight};font-weight:700;font-size:10px;border-top:3px double ${accentBorder};color:${accentColor}}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  ${watermarkHtml(brand, firmName)}
  <div class="header" style="position:relative;z-index:2">
    <div>
      ${brandRowHtml(brand, firmName)}
      <div class="header h1">${title}</div>
      <div class="sub">${new Date().toLocaleDateString("tr-TR")} · ${groups.reduce((s, g) => s + g.items.length, 0)} kalem · ${groups.length} grup</div>
    </div>
    <div class="total-badge">
      <div class="label">Genel Toplam</div>
      <div class="amount">$${fmt(grandTotal)}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="content" style="position:relative;z-index:2">
    <table>
      <thead><tr>
        <th style="width:52px">Kod</th>
        <th>Tanım</th>
        <th style="width:110px">Tip/Model</th>
        <th style="width:90px">Marka</th>
        <th style="text-align:center;width:44px">Birim</th>
        <th style="text-align:right;width:60px">Miktar</th>
        <th style="text-align:right;width:110px">Birim Fiyat</th>
        <th style="text-align:right;width:90px">Toplam USD</th>
        <th style="text-align:right;width:90px">Toplam TRY</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total-row">
          <td colspan="7" style="text-align:right">GENEL TOPLAM</td>
          <td style="text-align:right">$${fmt(grandTotal)}</td>
          <td style="text-align:right">₺${fmt(grandTotal * settings.usd)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${brandFooterHtml(brand, firmName, userEmail, docId)}
  </body></html>`;
}
