import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calc } from "@/lib/ges-engine";
import { formatDate } from "@/lib/utils";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, includedSections = [], coverNote = "", validityDays = 30 } = body;

  const [project, detail] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId: session.organizationId },
      include: { organization: true },
    }),
    prisma.projectDetail.findUnique({ where: { projectId } }),
  ]);

  if (!project || !detail) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const kesifA = detail.kesifA as unknown as KesifGroup[];
  const kesifB = detail.kesifB as unknown as KesifGroup[];
  const settings = detail.settings as unknown as GesSettings;
  const result = calc(kesifA, kesifB, settings);

  const today = new Date();
  const validUntil = new Date(today.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const html = buildGESpdf({ project, settings, kesifA, kesifB, result, includedSections, coverNote, today, validUntil });

  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "15mm", right: "15mm" } });
    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="epc-teklif-${project.name.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("GES PDF error:", err);
    return NextResponse.json({ error: "PDF oluşturulamadı" }, { status: 500 });
  }
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtTry(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtKwh(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} GWh`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} MWh`;
  return `${n.toFixed(0)} kWh`;
}

function buildGESpdf(data: {
  project: any;
  settings: GesSettings;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  result: ReturnType<typeof calc>;
  includedSections: string[];
  coverNote: string;
  today: Date;
  validUntil: Date;
}): string {
  const { project, settings, kesifA, kesifB, result, includedSections, coverNote, today, validUntil } = data;
  const acc = project.organization.themeColor ?? "#F59E0B";
  const has = (s: string) => includedSections.includes(s);

  const annualProduction = settings.dcGuc * 1000 * (settings.peakSunHoursPerDay ?? 4.5) * 365 * (settings.systemEfficiency ?? 0.80);
  const annualConsumption = (settings.monthlyConsumptionKwh ?? []).reduce((a: number, b: number) => a + b, 0);
  const selfConsumption = Math.min(annualProduction, annualConsumption);

  const firstYearSaving = (selfConsumption + (annualProduction - selfConsumption) * 0.9) * (settings.electricityUnitPriceTry ?? 3.5);
  const paybackYears = firstYearSaving > 0 ? result.salePriceTry / firstYearSaving : 0;

  function kesifTable(groups: KesifGroup[], title: string): string {
    const rows = groups.flatMap(g => {
      const grpRows = g.items.map(it => {
        const totalUsd = it.miktar * (it.fiyatCur === "USD" ? it.rawFiyat : it.fiyatCur === "EUR" ? (it.rawFiyat * settings.eur) / settings.usd : it.rawFiyat / settings.usd);
        return `<tr>
          <td style="padding-left:20px;color:#6B7280">${it.tanim}</td>
          <td style="color:#6B7280">${it.tip || ""}</td>
          <td style="text-align:right">${it.miktar.toLocaleString("tr-TR")}</td>
          <td style="text-align:center">${it.birim}</td>
          <td style="text-align:right">${it.rawFiyat.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${it.fiyatCur}</td>
          <td style="text-align:right;font-weight:600">${fmtUsd(totalUsd)}</td>
        </tr>`;
      });
      const grpTotal = g.items.reduce((s, it) => {
        const usd = it.miktar * (it.fiyatCur === "USD" ? it.rawFiyat : it.fiyatCur === "EUR" ? (it.rawFiyat * settings.eur) / settings.usd : it.rawFiyat / settings.usd);
        return s + usd;
      }, 0);
      return [
        `<tr style="background:#F3F4F6"><td colspan="5" style="font-weight:700;padding:6px 10px">${g.code} — ${g.name}</td><td style="text-align:right;font-weight:700">${fmtUsd(grpTotal)}</td></tr>`,
        ...grpRows,
      ];
    });
    return `
    <div style="margin-bottom:20px">
      <div class="section-title">${title}</div>
      <table>
        <tr><th>Kalem</th><th>Tip/Marka</th><th style="text-align:right">Miktar</th><th style="text-align:center">Birim</th><th style="text-align:right">Birim Fiyat</th><th style="text-align:right">Toplam (USD)</th></tr>
        ${rows.join("")}
        <tr class="grand-total"><td colspan="5">TOPLAM</td><td style="text-align:right">${fmtUsd(groups === kesifA ? result.kaTotal : result.kbTotal)}</td></tr>
      </table>
    </div>`;
  }

  // Build yearly savings for feasibility table
  const life = settings.projectLifeYears ?? 25;
  let currentPrice = settings.electricityUnitPriceTry ?? 3.5;
  const escalation = settings.electricityEscalationRate ?? 0.35;
  let cumSaving = 0;
  const yearRows: string[] = [];
  for (let y = 0; y < Math.min(life, 15); y++) {
    const saving = (selfConsumption + (annualProduction - selfConsumption) * 0.9) * currentPrice;
    cumSaving += saving;
    const netPos = cumSaving - result.salePriceTry;
    yearRows.push(`<tr>
      <td>${y + 1}</td>
      <td style="text-align:right">${fmtKwh(annualProduction)}</td>
      <td style="text-align:right">${currentPrice.toFixed(3)}</td>
      <td style="text-align:right;color:#059669;font-weight:600">${fmtTry(saving)}</td>
      <td style="text-align:right">${fmtTry(cumSaving)}</td>
      <td style="text-align:right;color:${netPos >= 0 ? "#059669" : "#DC2626"};font-weight:${netPos >= 0 ? "700" : "400"}">${fmtTry(netPos)}</td>
    </tr>`);
    currentPrice *= (1 + escalation);
  }

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111827; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .cover { background: #111827; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center; padding: 40px; }
  .firm-name { color: ${acc}; font-size: 18px; font-weight: 700; margin-bottom: 32px; }
  .cover h1 { font-size: 26px; font-weight: 700; letter-spacing: 1px; }
  .cover h2 { font-size: 18px; font-weight: 500; margin-top: 8px; color: #D1D5DB; }
  .price-badge { margin-top: 32px; background: ${acc}; color: #111827; border-radius: 12px; padding: 16px 32px; text-align: center; }
  .price-badge .label { font-size: 11px; font-weight: 600; opacity: 0.8; }
  .price-badge .amount { font-size: 28px; font-weight: 800; }
  .customer-box { margin-top: 24px; background: #1F2937; border-radius: 10px; padding: 16px 24px; text-align: left; min-width: 260px; }
  .customer-box p { color: #9CA3AF; font-size: 9px; margin-bottom: 3px; }
  .customer-box strong { color: white; font-size: 13px; }
  .validity { margin-top: 6px; font-size: 9px; color: #6B7280; }
  .inner { padding: 18px 20px; }
  .section-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid ${acc}; display: inline-block; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi-box { background: #F9FAFB; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #E5E7EB; }
  .kpi-label { font-size: 9px; color: #6B7280; margin-bottom: 3px; }
  .kpi-value { font-size: 14px; font-weight: 700; color: #111827; }
  .kpi-value.accent { color: ${acc}; font-size: 16px; }
  .kpi-value.green { color: #059669; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
  th { background: #1F2937; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #F3F4F6; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .total-row td { font-weight: 700; background: #F3F4F6; }
  .grand-total td { font-weight: 700; background: #1F2937; color: white; font-size: 11px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #F3F4F6; font-size: 10px; }
  .info-row span { color: #6B7280; }
  .info-row strong { color: #111827; }
  .cost-summary { background: #F9FAFB; border-radius: 8px; padding: 12px; border: 1px solid #E5E7EB; }
  .cost-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px; }
  .cost-line.total { border-top: 2px solid #E5E7EB; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 12px; }
  .cost-line.total .amount { color: ${acc}; }
  .env-box { background: #ECFDF5; border-radius: 8px; padding: 14px; border: 1px solid #A7F3D0; }
  .env-title { color: #065F46; font-weight: 700; margin-bottom: 8px; font-size: 11px; }
  .env-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; }
  .env-val { font-size: 13px; font-weight: 700; color: #059669; }
  .env-label { font-size: 9px; color: #6B7280; }
  .signature-box { border: 1px solid #D1D5DB; border-radius: 8px; padding: 14px; }
  .header-bar { background: #111827; color: white; padding: 6px 20px; font-size: 9px; display: flex; justify-content: space-between; align-items: center; }
  .header-bar .firm { color: ${acc}; font-weight: 700; }
  .footer-bar { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 5px 20px; font-size: 9px; color: #9CA3AF; display: flex; justify-content: space-between; }
  .section-break { margin: 12px 0; border-top: 1px dashed #E5E7EB; }
</style>
</head>
<body>

<!-- KAPAK -->
${has("kapak") ? `
<div class="page cover">
  <div class="firm-name">☀ ${project.organization.name}</div>
  <h1>EPC SOLAR ENERJİ SİSTEMİ</h1>
  <h2>TEKLİF SUNUMU</h2>
  ${coverNote ? `<p style="margin-top:20px;color:#9CA3AF;max-width:380px;font-size:11px;line-height:1.6">${coverNote}</p>` : ""}
  <div class="price-badge">
    <div class="label">EPC SATIŞ FİYATI</div>
    <div class="amount">${fmtUsd(result.salePriceUsd)}</div>
    <div class="label" style="margin-top:4px">${fmtTry(result.salePriceTry)} · ${result.perKwUsd.toFixed(0)} $/kWp</div>
  </div>
  <div class="customer-box">
    <p>Hazırlanan</p>
    <strong>${project.customerName || project.name}</strong>
    ${project.customerAddress ? `<div class="validity">${project.customerAddress}</div>` : ""}
    <div class="validity" style="margin-top:10px">
      Teklif Tarihi: ${formatDate(today)}<br>
      Geçerlilik: ${formatDate(validUntil)}
    </div>
  </div>
</div>
` : ""}

<!-- YÖNETİCİ ÖZETİ -->
${has("ozet") ? (() => {
  const brutKarPct = result.salePriceUsd > 0 ? (result.brutKar / result.salePriceUsd * 100).toFixed(1) : "0";
  const netKarPct = result.salePriceUsd > 0 ? (result.netKarAmt / result.salePriceUsd * 100).toFixed(1) : "0";
  const kaPct = result.salePriceUsd > 0 ? (result.kaTotal / result.salePriceUsd * 100).toFixed(0) : "0";
  const kbPct = result.salePriceUsd > 0 ? (result.kbTotal / result.salePriceUsd * 100).toFixed(0) : "0";
  const contPct = result.salePriceUsd > 0 ? (result.contingencyAmt / result.salePriceUsd * 100).toFixed(0) : "0";
  const ohcPct = result.salePriceUsd > 0 ? (result.genelGiderAmt / result.salePriceUsd * 100).toFixed(0) : "0";
  const karPctBar = result.salePriceUsd > 0 ? (result.netKarAmt / result.salePriceUsd * 100).toFixed(0) : "0";
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#111827;background:#fff;padding:0;margin:0;">

  <!-- TOP BAR -->
  <div style="background:linear-gradient(135deg,#071120 0%,#0c1e3c 50%,#122448 100%);padding:14px 24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:rgba(251,191,36,0.6);text-transform:uppercase;margin-bottom:3px">☀ ${project.organization.name}</div>
      <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:-0.02em;">${project.name}</div>
      ${project.customerName ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">İşveren: ${project.customerName}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;color:rgba(251,191,36,0.5);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">EPC Satış Fiyatı</div>
      <div style="font-size:24px;font-weight:900;color:#fbbf24;letter-spacing:-0.02em;">${fmtUsd(result.salePriceUsd)}</div>
      <div style="font-size:10px;color:#94a3b8;">${fmtTry(result.salePriceTry)} · ${result.perKwUsd.toFixed(0)} $/kWp</div>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,transparent,#fbbf24 30%,#6366f1 70%,transparent);"></div>

  <!-- KPI STRIP -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    ${[
      { label: "DC Güç", val: `${settings.dcGuc.toFixed(2)} MWp`, sub: `AC: ${settings.acGuc.toFixed(2)} MW` },
      { label: "Özgül Maliyet", val: `${result.perKwUsd.toFixed(0)} $/kWp`, sub: "" },
      { label: "Brüt Kar Marjı", val: `%${brutKarPct}`, sub: fmtUsd(result.brutKar) },
      { label: "Net Kar Marjı", val: `%${netKarPct}`, sub: fmtUsd(result.netKarAmt) },
      { label: "Panel / İnverter", val: `${settings.panelAdet ?? 0} adet`, sub: `${settings.invAdet ?? 0} inverter` },
    ].map(k => `<div style="padding:10px 14px;border-right:1px solid #e2e8f0;">
      <div style="font-size:8.5px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">${k.label}</div>
      <div style="font-size:15px;font-weight:800;color:#1e293b;">${k.val}</div>
      ${k.sub ? `<div style="font-size:8.5px;color:#94a3b8;">${k.sub}</div>` : ""}
    </div>`).join("")}
  </div>

  <!-- MAIN CONTENT -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:0;">

    <!-- LEFT: Proje bilgileri + maliyet -->
    <div style="padding:18px 20px;border-right:1px solid #e2e8f0;">
      <div style="font-size:11px;font-weight:800;color:#1e293b;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid #fbbf24;display:inline-block;">PRoje BİLGİLERİ</div>
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
        ${[
          ["Proje Adı", project.name],
          ["İşveren", project.customerName || "—"],
          ["Lokasyon", project.projectLocation || "—"],
          ["DC / AC Güç", `${settings.dcGuc.toFixed(2)} MW / ${settings.acGuc.toFixed(2)} MW`],
          ["Panel", `${settings.panelAdet ?? 0} adet × ${settings.panelGuc} Wp`],
          ["İnverter", `${settings.invAdet ?? 0} adet × ${settings.invGuc} kW`],
          ["Trafo Sayısı", `${settings.trafoSayisi} adet`],
          ["Teklif Tarihi", formatDate(today)],
          ["Geçerlilik", formatDate(validUntil)],
        ].map(([l, v]) => `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:4px 0;color:#6b7280;width:45%">${l}</td>
          <td style="padding:4px 0;font-weight:600;color:#1e293b;">${v}</td>
        </tr>`).join("")}
      </table>

      <div style="font-size:11px;font-weight:800;color:#1e293b;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid #fbbf24;display:inline-block;">MALİYET KIRILIMU</div>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <th style="text-align:left;padding:5px 8px;font-weight:600;color:#374151;">Kalem</th>
          <th style="text-align:right;padding:5px 8px;font-weight:600;color:#374151;">USD</th>
          <th style="text-align:right;padding:5px 8px;font-weight:600;color:#374151;">% Satış</th>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px;">Kesif-A</td><td style="text-align:right;padding:4px 8px;">${fmtUsd(result.kaTotal)}</td><td style="text-align:right;padding:4px 8px;color:#6b7280;">%${kaPct}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px;">Kesif-B</td><td style="text-align:right;padding:4px 8px;">${fmtUsd(result.kbTotal)}</td><td style="text-align:right;padding:4px 8px;color:#6b7280;">%${kbPct}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;background:#f1f5f9;font-weight:700;"><td style="padding:5px 8px;">Maliyet (A + B)</td><td style="text-align:right;padding:5px 8px;">${fmtUsd(result.directCost)}</td><td style="text-align:right;padding:5px 8px;color:#6b7280;"></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px;">Contingency (%${settings.contingency})</td><td style="text-align:right;padding:4px 8px;">${fmtUsd(result.contingencyAmt)}</td><td style="text-align:right;padding:4px 8px;color:#6b7280;">%${contPct}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px;">Overhead Cost (%${settings.genelGider})</td><td style="text-align:right;padding:4px 8px;color:#2563eb;">${fmtUsd(result.genelGiderAmt)}</td><td style="text-align:right;padding:4px 8px;color:#6b7280;">%${ohcPct}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 8px;">Net Kâr (%${settings.netKar})</td><td style="text-align:right;padding:4px 8px;color:#059669;">${fmtUsd(result.netKarAmt)}</td><td style="text-align:right;padding:4px 8px;color:#6b7280;">%${karPctBar}</td></tr>
        <tr style="background:#ecfdf5;border-bottom:2px solid #6ee7b7;font-weight:700;"><td style="padding:5px 8px;color:#065f46;">Brüt Kâr</td><td style="text-align:right;padding:5px 8px;color:#065f46;">${fmtUsd(result.brutKar)}</td><td style="text-align:right;padding:5px 8px;color:#065f46;">%${brutKarPct}</td></tr>
        <tr style="background:#fffbeb;border-top:2px solid #fbbf24;"><td style="padding:6px 8px;font-weight:900;font-size:11px;color:#92400e;">EPC SATIŞ FİYATI</td><td style="text-align:right;padding:6px 8px;font-weight:900;font-size:13px;color:#d97706;">${fmtUsd(result.salePriceUsd)}</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:#92400e;">100%</td></tr>
        <tr style="background:#fffbeb;"><td colspan="2" style="padding:3px 8px 6px;font-size:9px;color:#b45309;">TL Karşılığı (1 USD = ${settings.usd} TRY)</td><td style="text-align:right;padding:3px 8px 6px;font-size:9px;font-weight:700;color:#b45309;">${fmtTry(result.salePriceTry)}</td></tr>
      </table>
    </div>

    <!-- RIGHT: Döviz duyarlılığı + Onay -->
    <div style="padding:18px 20px;">
      <div style="font-size:11px;font-weight:800;color:#1e293b;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid #6366f1;display:inline-block;">DÖVİZ DUYARLILIĞI</div>
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:20px;">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <th style="text-align:left;padding:5px 8px;font-weight:600;color:#374151;">Senaryo</th>
          <th style="text-align:right;padding:5px 8px;font-weight:600;color:#374151;">USD/TRY</th>
          <th style="text-align:right;padding:5px 8px;font-weight:600;color:#374151;">TL Satış</th>
          <th style="text-align:right;padding:5px 8px;font-weight:600;color:#374151;">Fark</th>
        </tr>
        ${[-0.20, -0.10, 0, 0.10, 0.20].map((delta) => {
          const rate = settings.usd * (1 + delta);
          const tryAmt = result.salePriceUsd * rate;
          const diff = tryAmt - result.salePriceTry;
          const isBase = delta === 0;
          const label = isBase ? "Güncel" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`;
          return `<tr style="border-bottom:1px solid #f1f5f9;${isBase ? "background:#fffbeb;font-weight:700;" : ""}">
            <td style="padding:4px 8px;color:${isBase ? "#92400e" : "#374151"};">${label}</td>
            <td style="text-align:right;padding:4px 8px;color:${isBase ? "#b45309" : "#6b7280"};">${rate.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="text-align:right;padding:4px 8px;font-weight:${isBase ? "700" : "500"};color:${isBase ? "#d97706" : "#1e293b"};">${fmtTry(tryAmt)}</td>
            <td style="text-align:right;padding:4px 8px;font-size:9px;color:${isBase ? "#9ca3af" : diff > 0 ? "#059669" : "#dc2626"};">${isBase ? "—" : `${diff > 0 ? "+" : ""}${fmtTry(diff)}`}</td>
          </tr>`;
        }).join("")}
      </table>

      <div style="font-size:11px;font-weight:800;color:#1e293b;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid #fbbf24;display:inline-block;">ONAY VE İMZA</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="border:1px solid #d1d5db;border-radius:8px;padding:12px;min-height:90px;">
          <div style="font-weight:700;font-size:10px;margin-bottom:4px;">${project.organization.name}</div>
          <div style="font-size:8.5px;color:#9ca3af;margin-bottom:30px;">${project.organization.address ?? ""}</div>
          <div style="border-top:1px solid #d1d5db;padding-top:5px;font-size:8.5px;color:#9ca3af;">İmza / Kaşe / Tarih</div>
        </div>
        <div style="border:1px solid #d1d5db;border-radius:8px;padding:12px;min-height:90px;">
          <div style="font-weight:700;font-size:10px;margin-bottom:4px;">${project.customerName || "İşveren"}</div>
          <div style="font-size:8.5px;color:#9ca3af;margin-bottom:30px;">Yukarıdaki teklif şartlarını kabul ediyorum.</div>
          <div style="border-top:1px solid #d1d5db;padding-top:5px;font-size:8.5px;color:#9ca3af;">İmza / Kaşe / Tarih</div>
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0;font-size:9px;color:#6b7280;line-height:1.6;">
        <strong style="color:#374151;display:block;margin-bottom:4px;">Teklif Koşulları</strong>
        Bu teklif <strong>${formatDate(today)}</strong> tarihinde düzenlenmiş olup <strong>${formatDate(validUntil)}</strong> tarihine kadar geçerlidir.
        Teklif, fiyat güncellemesi veya yazılı mutabakat olmaksızın bu tarihten sonra geçerliliğini yitirir.
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:#071120;padding:8px 24px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:8.5px;color:#475569;">${project.organization.name} · EPC Yönetici Özeti</span>
    <span style="font-size:8.5px;color:#475569;">${formatDate(today)}</span>
  </div>
</div>
`; })() : ""}

<!-- KESİF-A -->
${has("kesif-a") ? `
<div class="page">
  <div class="header-bar"><span class="firm">${project.organization.name}</span><span>${project.name}</span></div>
  <div class="inner">
    ${kesifTable(kesifA, "KESİF-A — DOĞRUDAN MALİYETLER")}
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>EPC Teklif · ${project.organization.name}</span></div>
</div>
` : ""}

<!-- KESİF-B -->
${has("kesif-b") ? `
<div class="page">
  <div class="header-bar"><span class="firm">${project.organization.name}</span><span>${project.name}</span></div>
  <div class="inner">
    ${kesifTable(kesifB, "KESİF-B — DOLAYLI MALİYETLER")}
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>EPC Teklif · ${project.organization.name}</span></div>
</div>
` : ""}

<!-- FİZİBİLİTE -->
${has("fizibilite") ? `
<div class="page">
  <div class="header-bar"><span class="firm">${project.organization.name}</span><span>${project.name}</span></div>
  <div class="inner">
    <div class="section-title">FİZİBİLİTE ANALİZİ</div>
    <div class="kpi-grid" style="margin-bottom:12px">
      <div class="kpi-box">
        <div class="kpi-label">Yıllık Üretim</div>
        <div class="kpi-value">${fmtKwh(annualProduction)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">İlk Yıl Tasarruf</div>
        <div class="kpi-value green">${fmtTry((selfConsumption + (annualProduction - selfConsumption) * 0.9) * (settings.electricityUnitPriceTry ?? 3.5))}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Geri Ödeme</div>
        <div class="kpi-value">${paybackYears > 0 ? paybackYears.toFixed(1) + " yıl" : "—"}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Yıllık CO₂</div>
        <div class="kpi-value">${(annualProduction * 0.0005).toFixed(1)} ton</div>
      </div>
    </div>
    <table style="margin-bottom:14px">
      <tr><th>Yıl</th><th style="text-align:right">Üretim</th><th style="text-align:right">Birim Fiyat</th><th style="text-align:right">Yıllık Tasarruf</th><th style="text-align:right">Kümülatif</th><th style="text-align:right">Net Pozisyon</th></tr>
      ${yearRows.join("")}
    </table>
    <div class="env-box">
      <div class="env-title">Çevre Katkısı (${settings.projectLifeYears ?? 25} Yıl)</div>
      <div class="env-grid">
        <div><div class="env-val">${(annualProduction * 0.0005).toFixed(1)} ton/yıl</div><div class="env-label">CO₂ Tasarrufu</div></div>
        <div><div class="env-val">${(annualProduction * 0.0005 * (settings.projectLifeYears ?? 25)).toFixed(0)} ton</div><div class="env-label">Toplam CO₂</div></div>
        <div><div class="env-val">${Math.round(annualProduction * 0.0005 * (settings.projectLifeYears ?? 25) * 50)}</div><div class="env-label">Eşdeğer Ağaç</div></div>
      </div>
    </div>
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>EPC Teklif · ${project.organization.name}</span></div>
</div>
` : ""}

<!-- İMZA -->
${has("imza") ? `
<div class="page">
  <div class="header-bar"><span class="firm">${project.organization.name}</span><span>${project.name}</span></div>
  <div class="inner">
    <div class="section-title">İMZA & ONAY</div>
    <p style="color:#6B7280;margin-bottom:20px;font-size:10px">Bu teklif ${formatDate(validUntil)} tarihine kadar geçerlidir.</p>
    <div class="two-col">
      <div class="signature-box" style="min-height:120px">
        <div style="font-weight:600;margin-bottom:6px;font-size:11px">Teklifi Veren — ${project.organization.name}</div>
        <div style="font-size:9px;color:#9CA3AF;margin-bottom:40px">
          ${project.organization.address ?? ""}<br>
          ${project.organization.phone ?? ""} ${project.organization.email ? "· " + project.organization.email : ""}
        </div>
        <div style="border-top:1px solid #D1D5DB;padding-top:6px;font-size:9px;color:#9CA3AF">İmza & Kaşe</div>
      </div>
      <div class="signature-box" style="min-height:120px">
        <div style="font-weight:600;margin-bottom:6px;font-size:11px">Müşteri Onayı — ${project.customerName || "—"}</div>
        <div style="margin-top:60px;border-top:1px solid #D1D5DB;padding-top:6px;font-size:9px;color:#9CA3AF">İmza & Tarih</div>
      </div>
    </div>
  </div>
  <div class="footer-bar"><span>${project.organization.name} · ${formatDate(today)}</span><span>EPC Teklif</span></div>
</div>
` : ""}

</body>
</html>`;
}

