import type { Project } from "@prisma/client";
import { calc, getGrpTot, toUSD } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";
import {
  resolveBrand,
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandSettings,
} from "@/lib/pdf-brand";

interface PrintArgs {
  project: Project;
  settings: GesSettings;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  timeline: TimelineData;
  firmName: string;
  brand: BrandSettings;
  userEmail: string;
}

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

/**
 * Patron / direktor seviyesinde sunulabilecek "executive analiz" PDF'i
 * uretir. KPI, maliyet kirilimi, halka grafigi, top kalemler, cash flow,
 * doviz duyarliligi — hepsi tek belgede.
 *
 * Client tarafindan `printAnaliz()` cagrilir (window.open + print).
 * Server tarafi (combined-pdf endpoint) `buildAnalizPrintHtml()` cagirip
 * HTML'i Puppeteer'a verir. Ikisi de ayni HTML uretir.
 */
export function printAnaliz(args: PrintArgs) {
  const html = buildAnalizPrintHtml(args);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function buildAnalizPrintHtml({ project, settings: s, kesifA, kesifB, timeline, firmName, brand, userEmail }: PrintArgs): string {
  const result = calc(kesifA, kesifB, s);
  const dcWp = s.dcGuc * 1_000_000;
  const dcKw = s.dcGuc * 1000;
  const perKwUsd = result.perKwUsd;
  const sale = result.salePriceUsd;
  const brandCtx = resolveBrand(brand);
  const docId = generateDocId();

  // Group totals
  const groupTotals = [...kesifA, ...kesifB]
    .map((g) => ({ code: g.code, name: g.name, total: getGrpTot(g, s) }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);

  // Top 5 items
  const allItems: { code: string; name: string; group: string; total: number; isA: boolean }[] = [];
  for (const g of [...kesifA, ...kesifB]) {
    for (const it of g.items) {
      const total = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s);
      if (total > 0) {
        allItems.push({
          code: it.code,
          name: it.tanim,
          group: g.name,
          total,
          isA: g.code.startsWith("A"),
        });
      }
    }
  }
  const top5 = allItems.sort((a, b) => b.total - a.total).slice(0, 5);

  // Cash flow kümülatif (basit — finans hesabı analiz'inkiyle aynı sonuç)
  const cum: number[] = [];
  if (timeline?.rows?.length) {
    let acc = 0;
    for (let m = 0; m < timeline.months; m++) {
      let inflow = 0;
      let outflow = 0;
      for (const row of timeline.rows) {
        const pct = row.values?.[m] ? row.values[m] / 100 : 0;
        if (!pct) continue;
        if (row.type === "inflow") {
          inflow += pct * sale;
        } else {
          // Group lookup
          const match = row.name.match(/^([AB]\.\d+)/);
          if (match) {
            const code = match[1];
            const total = groupTotals.find((g) => g.code === code || g.code.startsWith(code + "."))?.total || 0;
            outflow += pct * total;
          }
        }
      }
      acc += inflow - outflow;
      cum.push(acc);
    }
  }
  const minCum = cum.length ? Math.min(...cum, 0) : 0;
  const maxCum = cum.length ? Math.max(...cum, 0) : 1;

  // Sensitivity (USD/TRY)
  const sensitivity = [-0.2, -0.1, 0, 0.1, 0.2].map((delta) => ({
    label: delta === 0 ? "Güncel" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
    rate: s.usd * (1 + delta),
    tryAmt: sale * s.usd * (1 + delta),
    isBase: delta === 0,
  }));

  // Donut SVG (cost ring)
  const donutData = groupTotals.map((g) => ({
    label: `${g.code} ${g.name}`,
    value: g.total,
    color: g.code.startsWith("A") ? "#059669" : "#3b82f6",
    isA: g.code.startsWith("A"),
  }));
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // Line chart for cumulative
  const W = 500;
  const H = 130;
  const yScale = (v: number) =>
    H - 6 - ((v - minCum) / (maxCum - minCum || 1)) * (H - 12);
  const xScale = (i: number) => (i / Math.max(1, cum.length - 1)) * W;
  const linePath = cum
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;
  const zeroY = yScale(0);

  let donutAcc = 0;
  const donutPaths = donutData
    .map((d) => {
      const start = (donutAcc / donutTotal) * Math.PI * 2 - Math.PI / 2;
      donutAcc += d.value;
      const end = (donutAcc / donutTotal) * Math.PI * 2 - Math.PI / 2;
      const r1 = 50;
      const r2 = 80;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = (Math.cos(start) * r2).toFixed(2);
      const y1 = (Math.sin(start) * r2).toFixed(2);
      const x2 = (Math.cos(end) * r2).toFixed(2);
      const y2 = (Math.sin(end) * r2).toFixed(2);
      const x3 = (Math.cos(end) * r1).toFixed(2);
      const y3 = (Math.sin(end) * r1).toFixed(2);
      const x4 = (Math.cos(start) * r1).toFixed(2);
      const y4 = (Math.sin(start) * r1).toFixed(2);
      return `<path d="M ${x1} ${y1} A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z" fill="${d.color}" stroke="white" stroke-width="1.5" />`;
    })
    .join("");

  // KPI strip
  const pctOf = (x: number) => (sale > 0 ? (x / sale) * 100 : 0);
  const perKwOf = (x: number) => (dcKw > 0 ? Math.round(x / dcKw) : 0);

  const kpis = [
    { label: "Maliyet (A + B)", value: result.directCost, tone: "muted", pct: pctOf(result.directCost) },
    { label: "Contingency", value: result.contingencyAmt, tone: "primary", pct: pctOf(result.contingencyAmt), rate: s.contingency },
    { label: "OHC", value: result.genelGiderAmt, tone: "info", pct: pctOf(result.genelGiderAmt), rate: s.genelGider },
    { label: "Net Kâr", value: result.netKarAmt, tone: "success", pct: pctOf(result.netKarAmt), rate: s.netKar },
    { label: "Brüt Kâr", value: result.brutKar, tone: "highlight", pct: pctOf(result.brutKar) },
  ];

  const TONE_BG: Record<string, string> = {
    muted: "background:#f1f5f9;color:#0f172a",
    primary: "background:#ecfdf5;color:#047857;border:1px solid #34d399",
    info: "background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd",
    success: "background:#d1fae5;color:#065f46;border:1px solid #34d399",
    highlight: "background:linear-gradient(135deg,#059669,#047857);color:#fff",
  };

  // EUR
  const salePriceEur = s.eur > 0 ? (sale * s.usd) / s.eur : 0;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Analiz — ${escapeHtml(project.name || "Proje")}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;font-size:10px;color:#0f172a;background:#fff}
  @page{size:A4;margin:14mm}
  .page-break{page-break-after:always}
  .cover{background:${brandCtx.coverGradient};color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-end;border-radius:0 0 14px 14px;margin-bottom:16px;position:relative;z-index:2}
  .cover h1{font-size:22px;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}
  .cover .sub{font-size:11px;color:rgba(255,255,255,0.75);font-weight:500}
  .cover .meta{margin-top:10px;font-size:10px;color:rgba(236,253,245,0.85);display:flex;gap:14px;flex-wrap:wrap}
  .cover .meta strong{color:#fff;font-weight:700;margin-left:4px}
  .cover .price{text-align:right}
  .cover .price .label{font-size:9px;text-transform:uppercase;letter-spacing:0.16em;color:rgba(167,243,208,0.85);font-weight:600}
  .cover .price .amount{font-size:30px;font-weight:900;color:#fff;line-height:1}
  .cover .price .alt{font-size:11px;color:rgba(167,243,208,0.95);font-weight:600;margin-top:4px}
  .cover .badge{display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em}

  .container{padding:0 16px 16px}
  h2.section{font-size:13px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;margin:18px 0 8px;padding-bottom:5px;border-bottom:2px solid #10b981;display:inline-block}
  h2.section .sub{font-size:9px;font-weight:600;color:#64748b;margin-left:8px;text-transform:uppercase;letter-spacing:0.1em}

  .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:6px}
  .kpi{padding:9px 11px;border-radius:8px;font-weight:700}
  .kpi .l{font-size:8.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;opacity:0.75;margin-bottom:3px}
  .kpi .v{font-size:14px;font-weight:800;letter-spacing:-0.01em}
  .kpi .p{font-size:8.5px;font-weight:600;opacity:0.75;margin-top:2px}
  .kpi .perKw{font-size:8.5px;font-weight:600;opacity:0.7;margin-top:1px}

  table{width:100%;border-collapse:collapse;font-size:9.5px}
  th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
  td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  tr.alt td{background:#fafbfc}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .total td{background:#ecfdf5;font-weight:800;color:#047857;border-top:2px solid #10b981;border-bottom:none}
  .grand td{background:linear-gradient(135deg,#d1fae5,#a7f3d0);font-weight:900;color:#065f46;font-size:11px;border-top:2px solid #047857}

  .badge-a{display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:800;background:#ecfdf5;color:#047857}
  .badge-b{display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:800;background:#eff6ff;color:#1d4ed8}

  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
  .three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .card{padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
  .card.tone-success{background:#ecfdf5;border-color:#34d399}
  .card.tone-info{background:#eff6ff;border-color:#93c5fd}
  .card.tone-warning{background:#fffbeb;border-color:#fcd34d}
  .card .l{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:4px}
  .card .v{font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#0f172a}
  .card .v.success{color:#047857}
  .card .v.info{color:#1d4ed8}
  .card .sub{font-size:9px;color:#64748b;margin-top:2px}

  .legend{display:flex;flex-wrap:wrap;gap:6px;font-size:9px;margin-top:8px}
  .legend .it{display:flex;align-items:center;gap:4px;padding:2px 6px;background:#f8fafc;border-radius:4px}
  .legend .sw{width:9px;height:9px;border-radius:2px}

  .row-bar{display:flex;align-items:center;gap:6px;font-size:9.5px}
  .row-bar .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .row-bar .amt{font-weight:700;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .row-bar .bar{flex-basis:40%;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden}
  .row-bar .bar .fill{height:100%;background:linear-gradient(90deg,#10b981,#059669);border-radius:4px}

  .footer{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8}

  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

${watermarkHtml(brandCtx, firmName)}

<!-- COVER -->
<div class="cover">
  <div>
    ${brandRowHtml(brandCtx, firmName)}
    <span class="badge">Yönetici Özeti · Solar EPC Analiz</span>
    <h1 style="margin-top:8px">${escapeHtml(project.name || "Proje")}</h1>
    <div class="sub">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}${project.customerName ? ` · ${escapeHtml(project.customerName)}` : ""}</div>
    <div class="meta">
      ${project.projectLocation ? `<span>📍 ${escapeHtml(project.projectLocation)}</span>` : ""}
      <span>⚡ DC <strong>${fmt(s.dcGuc, 2)} MWp</strong></span>
      ${s.acGuc > 0 ? `<span>AC <strong>${fmt(s.acGuc, 2)} MWe</strong></span>` : ""}
      <span>USD/Wp <strong>$${(perKwUsd / 1000).toFixed(3)}</strong></span>
    </div>
  </div>
  <div class="price">
    <div class="label">Toplam EPC Satış Fiyatı</div>
    <div class="amount">$${fmt(sale)}</div>
    <div class="alt">₺${fmt(sale * s.usd)}${salePriceEur > 0 ? ` · €${fmt(salePriceEur)}` : ""}</div>
    <div class="alt" style="margin-top:6px;font-size:10px;background:rgba(255,255,255,0.18);padding:3px 9px;border-radius:99px;display:inline-block">
      Brüt Kâr Marjı %${pctOf(result.brutKar).toFixed(1)} · $${fmt(result.brutKar)}
    </div>
  </div>
</div>

<div class="container">

  <!-- KPI Strip -->
  <h2 class="section">Mali Özet <span class="sub">5 Ana KPI</span></h2>
  <div class="kpi-grid">
    ${kpis
      .map(
        (k) => `
      <div class="kpi" style="${TONE_BG[k.tone]}">
        <div class="l">${k.label}</div>
        <div class="v">$${fmt(k.value)}</div>
        ${k.rate !== undefined ? `<div class="p">${(k.rate as number).toFixed(1)}% · ${perKwOf(k.value)} USD/kWp</div>` : `<div class="p">%${k.pct.toFixed(1)} · ${perKwOf(k.value)} USD/kWp</div>`}
      </div>`,
      )
      .join("")}
  </div>

  <!-- Two-column: Cost Ring + Sensitivity -->
  <div class="two-col">
    <div>
      <h2 class="section">Maliyet Halkası <span class="sub">Grup Bazlı Dağılım</span></h2>
      <div style="display:flex;align-items:center;gap:14px">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <g transform="translate(90 90)">${donutPaths}</g>
          <text x="90" y="86" text-anchor="middle" font-size="9" fill="#64748b" font-weight="600" letter-spacing="0.1em">TOPLAM</text>
          <text x="90" y="102" text-anchor="middle" font-size="14" fill="#0f172a" font-weight="800">$${fmt(donutTotal)}</text>
        </svg>
        <div class="legend" style="flex:1;flex-direction:column;align-items:stretch;gap:3px">
          ${donutData
            .slice(0, 8)
            .map(
              (d) => `
            <div class="it" style="background:transparent;padding:2px 0;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0">
                <span class="sw" style="background:${d.color}"></span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.label)}</span>
              </div>
              <strong style="font-variant-numeric:tabular-nums">%${donutTotal > 0 ? ((d.value / donutTotal) * 100).toFixed(1) : "0"}</strong>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </div>

    <div>
      <h2 class="section">Döviz Duyarlılığı <span class="sub">±20% USD/TRY</span></h2>
      <table>
        <thead><tr><th>Senaryo</th><th class="num">USD/TRY</th><th class="num">TL Satış</th><th class="num">Fark</th></tr></thead>
        <tbody>
          ${sensitivity
            .map((sn) => {
              const diff = sn.tryAmt - sale * s.usd;
              return `<tr${sn.isBase ? ' style="background:#fef3c7;font-weight:700"' : ""}>
                <td>${sn.label}</td>
                <td class="num">${fmt(sn.rate, 2)}</td>
                <td class="num">₺${fmt(sn.tryAmt)}</td>
                <td class="num" style="color:${sn.isBase ? "#92400e" : diff > 0 ? "#047857" : "#dc2626"}">${sn.isBase ? "—" : `${diff > 0 ? "+" : ""}₺${fmt(Math.abs(diff))}`}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Grup Bazlı Maliyet Tablosu -->
  <h2 class="section">Maliyet Kırılımı <span class="sub">Grup Bazlı</span></h2>
  <table>
    <thead>
      <tr>
        <th style="width:50px">Kod</th>
        <th>Grup</th>
        <th class="num">Tutar (USD)</th>
        <th class="num">USD/Wp</th>
        <th class="num">% Direkt</th>
        <th class="num">% Satış</th>
      </tr>
    </thead>
    <tbody>
      ${groupTotals
        .map((g, i) => {
          const isA = g.code.startsWith("A");
          return `<tr${i % 2 ? ' class="alt"' : ""}>
            <td><span class="${isA ? "badge-a" : "badge-b"}">${g.code}</span></td>
            <td>${escapeHtml(g.name)}</td>
            <td class="num"><strong>$${fmt(g.total)}</strong></td>
            <td class="num">${dcWp > 0 ? `$${(g.total / dcWp).toFixed(4)}` : "—"}</td>
            <td class="num">${result.directCost > 0 ? ((g.total / result.directCost) * 100).toFixed(1) : "0"}%</td>
            <td class="num" style="color:#047857">${sale > 0 ? ((g.total / sale) * 100).toFixed(1) : "0"}%</td>
          </tr>`;
        })
        .join("")}
      <tr class="total"><td colspan="2">MALİYET (A + B)</td><td class="num">$${fmt(result.directCost)}</td><td class="num">${dcWp > 0 ? `$${(result.directCost / dcWp).toFixed(4)}` : "—"}</td><td class="num">100.0%</td><td class="num">${sale > 0 ? ((result.directCost / sale) * 100).toFixed(1) : "0"}%</td></tr>
      <tr><td colspan="2">Contingency (%${s.contingency})</td><td class="num">$${fmt(result.contingencyAmt)}</td><td colspan="2"></td><td class="num">${pctOf(result.contingencyAmt).toFixed(1)}%</td></tr>
      <tr><td colspan="2">Overhead Cost (%${s.genelGider})</td><td class="num">$${fmt(result.genelGiderAmt)}</td><td colspan="2"></td><td class="num">${pctOf(result.genelGiderAmt).toFixed(1)}%</td></tr>
      <tr><td colspan="2">Net Kâr (%${s.netKar})</td><td class="num">$${fmt(result.netKarAmt)}</td><td colspan="2"></td><td class="num">${pctOf(result.netKarAmt).toFixed(1)}%</td></tr>
      <tr class="grand"><td colspan="2">EPC SATIŞ FİYATI</td><td class="num">$${fmt(sale)}</td><td class="num">${dcWp > 0 ? `$${(sale / dcWp).toFixed(4)}` : "—"}</td><td colspan="2" class="num">100.0%</td></tr>
    </tbody>
  </table>

  <!-- Top 5 -->
  <h2 class="section">Top 5 Maliyet Kalemi</h2>
  <div style="display:flex;flex-direction:column;gap:5px">
    ${top5
      .map((it) => {
        const pct = result.directCost > 0 ? (it.total / result.directCost) * 100 : 0;
        return `<div class="row-bar">
          <span class="${it.isA ? "badge-a" : "badge-b"}">${it.code}</span>
          <span class="name">${escapeHtml(it.name)}</span>
          <span style="color:#64748b;font-size:9px">${escapeHtml(it.group)}</span>
          <div class="bar"><div class="fill" style="width:${Math.min(pct, 100).toFixed(1)}%"></div></div>
          <span class="amt">$${fmt(it.total)}</span>
          <span class="amt" style="color:#64748b;font-weight:600;width:46px">%${pct.toFixed(1)}</span>
        </div>`;
      })
      .join("")}
  </div>

  ${
    cum.length > 0
      ? `
  <!-- Cash Flow -->
  <h2 class="section">Cash Flow · Kümülatif Pozisyon <span class="sub">${timeline.months} ay</span></h2>
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#fff">
    <svg viewBox="0 0 ${W} ${H + 14}" style="width:100%;height:160px">
      <defs>
        <linearGradient id="cfg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" x2="${W}" y1="${zeroY}" y2="${zeroY}" stroke="#cbd5e1" stroke-dasharray="4 3"/>
      <path d="${areaPath}" fill="url(#cfg)"/>
      <path d="${linePath}" fill="none" stroke="#047857" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${cum.map((v, i) => `<circle cx="${xScale(i)}" cy="${yScale(v)}" r="2.5" fill="#047857" stroke="white" stroke-width="1.2"/>`).join("")}
      ${["O","Ş","M","N","M","H","T","A","E","E","K","A"].slice(0, cum.length).map((m, i) => `<text x="${xScale(i)}" y="${H + 12}" font-size="7.5" text-anchor="middle" fill="#94a3b8" font-weight="600">${m}</text>`).join("")}
    </svg>
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:9px;color:#64748b">
      <span><strong style="color:#dc2626">Maks. Kredi İhtiyacı:</strong> $${fmt(Math.abs(minCum))}</span>
      <span><strong style="color:#047857">Final Bakiye:</strong> $${fmt(cum[cum.length - 1] || 0)}</span>
      <span><strong>Yıllık Kredi Faizi:</strong> %${s.krediFaiz.toFixed(1)}</span>
    </div>
  </div>`
      : ""
  }

  <div class="footer">
    <span>SolarTeklif · Yönetici Özeti · ${new Date().toLocaleDateString("tr-TR")}</span>
    <span>Proje: ${escapeHtml(project.name || "Proje")}</span>
  </div>

</div>
${brandFooterHtml(brandCtx, firmName, userEmail, docId)}
</body></html>`;

  return html;
}
