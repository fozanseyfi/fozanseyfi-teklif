import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  calculateAnnualProductionKwh,
  calculateCashFlow,
  calculatePaybackYear,
  calculateCO2Saving,
  calculateEquivalentTrees,
} from "@/lib/pricing-engine";
import {
  INSTALLATION_TYPE_LABELS,
  TARIFF_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  COST_CATEGORY_LABELS,
  formatCurrency,
  formatNumber,
  formatDate,
} from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.role, "canGeneratePDF")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { projectId, coverNote, validityDays, includedSections } = body;

  const [project, subscription] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, firmId: session.firmId },
      include: {
        pricingSnapshot: true,
        equipmentItems: { orderBy: { sortOrder: "asc" } },
        costItems: true,
        firm: true,
      },
    }),
    prisma.subscription.findUnique({ where: { firmId: session.firmId } }),
  ]);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (
    subscription &&
    subscription.monthlyProposalLimit !== -1 &&
    subscription.currentMonthCount >= subscription.monthlyProposalLimit
  ) {
    return NextResponse.json({ error: "Monthly limit reached" }, { status: 429 });
  }

  // Finansal hesaplamalar
  const totalInvestment = project.pricingSnapshot?.finalSalePrice ?? 0;
  const annualProduction = calculateAnnualProductionKwh(project.totalPowerKw, 4.5);
  const cashFlow = calculateCashFlow({
    totalInvestment,
    annualProductionKwh: annualProduction,
    electricityUnitPrice: project.electricityUnitPrice,
    electricityEscalationRate: project.electricityEscalationRate,
    panelDegradationRate: 0.005,
    projectLifeYears: project.projectLifeYears,
  });
  const paybackYear = calculatePaybackYear(cashFlow);
  const firstYearSaving = cashFlow[0]?.annualSaving ?? 0;
  const totalCO2 = calculateCO2Saving(annualProduction, project.projectLifeYears);
  const trees = calculateEquivalentTrees(totalCO2);

  const today = new Date();
  const validUntil = new Date(today.getTime() + validityDays * 24 * 60 * 60 * 1000);

  // HTML oluştur
  const html = generatePDFHTML({
    project,
    coverNote,
    validityDays,
    includedSections: includedSections ?? [],
    totalInvestment,
    annualProduction,
    cashFlow,
    paybackYear,
    firstYearSaving,
    totalCO2,
    trees,
    today,
    validUntil,
  });

  // Puppeteer ile PDF oluştur
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" } });
    await browser.close();

    // Abonelik sayacını güncelle
    await prisma.$transaction([
      prisma.proposal.upsert({
        where: { projectId },
        create: { projectId, generatedAt: today, coverNote, validityDays, includedSections: includedSections ?? [], version: 1 },
        update: { generatedAt: today, coverNote, validityDays, includedSections: includedSections ?? [], version: { increment: 1 } },
      }),
      prisma.subscription.update({
        where: { firmId: session.firmId },
        data: { currentMonthCount: { increment: 1 } },
      }),
    ]);

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="teklif-${project.name.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "PDF oluşturulamadı" }, { status: 500 });
  }
}

function generatePDFHTML(data: any): string {
  const { project, coverNote, includedSections, totalInvestment, annualProduction, cashFlow, paybackYear, firstYearSaving, totalCO2, trees, today, validUntil } = data;
  const acc = project.firm.themeColor ?? "#F59E0B";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #111827; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .cover { background: #111827; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center; padding: 40px; }
  .logo-circle { width: 64px; height: 64px; background: ${acc}; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px; }
  .firm-name { color: ${acc}; font-size: 20px; font-weight: 700; margin-bottom: 40px; }
  .cover h1 { font-size: 28px; font-weight: 700; letter-spacing: 2px; }
  .cover h2 { font-size: 20px; font-weight: 500; margin-top: 8px; color: #D1D5DB; }
  .customer-box { margin-top: 40px; background: #1F2937; border-radius: 12px; padding: 20px 30px; text-align: left; min-width: 280px; }
  .customer-box p { color: #9CA3AF; font-size: 10px; margin-bottom: 4px; }
  .customer-box strong { color: white; font-size: 14px; }
  .validity { margin-top: 8px; font-size: 10px; color: #6B7280; }
  .section { padding: 24px; border-bottom: 1px solid #E5E7EB; }
  .section-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid ${acc}; display: inline-block; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi-box { background: #F9FAFB; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-label { font-size: 9px; color: #6B7280; margin-bottom: 4px; }
  .kpi-value { font-size: 16px; font-weight: 700; color: #111827; }
  .kpi-value.accent { color: ${acc}; }
  .kpi-value.green { color: #059669; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #1F2937; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #F3F4F6; }
  tr:nth-child(even) td { background: #F9FAFB; }
  .total-row td { font-weight: 700; background: #F3F4F6; }
  .grand-total td { font-weight: 700; background: #111827; color: white; font-size: 12px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F3F4F6; font-size: 10px; }
  .info-row span { color: #6B7280; }
  .info-row strong { color: #111827; }
  .env-box { background: #ECFDF5; border-radius: 8px; padding: 16px; }
  .env-title { color: #065F46; font-weight: 700; margin-bottom: 8px; }
  .env-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; }
  .env-val { font-size: 14px; font-weight: 700; color: #059669; }
  .env-label { font-size: 9px; color: #6B7280; }
  .signature-box { border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; height: 120px; }
  .signature-title { font-size: 10px; font-weight: 600; color: #374151; margin-bottom: 8px; }
  .header-bar { background: #111827; color: white; padding: 8px 24px; font-size: 9px; display: flex; justify-content: space-between; align-items: center; }
  .header-bar .firm { color: ${acc}; font-weight: 700; }
  .footer-bar { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 6px 24px; font-size: 9px; color: #9CA3AF; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<!-- KAPAK SAYFASI -->
<div class="page cover">
  <div class="logo-circle">☀</div>
  <div class="firm-name">${project.firm.name}</div>
  <h1>SOLAR ENERJİ SİSTEMİ</h1>
  <h2>PROJE TEKLİFİ</h2>
  ${coverNote ? `<p style="margin-top:24px;color:#9CA3AF;max-width:400px;font-size:12px;">${coverNote}</p>` : ""}
  <div class="customer-box">
    <p>Sayın</p>
    <strong>${project.customerName}</strong>
    ${project.customerAddress ? `<div class="validity">${project.customerAddress}</div>` : ""}
    <div class="validity" style="margin-top:12px;">
      Teklif Tarihi: ${formatDate(today)}<br>
      Geçerlilik Tarihi: ${formatDate(validUntil)}
    </div>
  </div>
</div>

<!-- YÖNETİCİ ÖZETİ -->
<div class="page">
  <div class="header-bar"><span class="firm">${project.firm.name}</span><span>${project.name}</span></div>
  <div class="section">
    <div class="section-title">YÖNETİCİ ÖZETİ</div>
    <p style="color:#4B5563;margin-bottom:16px;line-height:1.6;">
      ${project.projectLocation} konumunda, ${INSTALLATION_TYPE_LABELS[project.installationType]} tipinde kurulacak olan
      <strong>${project.totalPowerKw.toFixed(1)} kWp</strong> güçündeki solar enerji sistemi için hazırlanan bu teklif,
      yatırımın tüm teknik ve finansal detaylarını kapsamaktadır.
    </p>
    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">Sistem Gücü</div>
        <div class="kpi-value">${project.totalPowerKw.toFixed(1)}<br><span style="font-size:10px;font-weight:400">kWp</span></div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Proje Bedeli</div>
        <div class="kpi-value accent">${formatCurrency(totalInvestment)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Geri Ödeme</div>
        <div class="kpi-value">${paybackYear > 0 ? paybackYear + " Yıl" : "—"}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">İlk Yıl Tasarruf</div>
        <div class="kpi-value green">${formatCurrency(firstYearSaving)}</div>
      </div>
    </div>
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>Sayfa 2</span></div>
</div>

<!-- TEKNİK KAPSAM -->
<div class="page">
  <div class="header-bar"><span class="firm">${project.firm.name}</span><span>${project.name}</span></div>
  <div class="section">
    <div class="section-title">TEKNİK KAPSAM</div>
    <div class="two-col">
      <div>
        <div style="font-weight:600;margin-bottom:8px;font-size:11px;">Sistem Parametreleri</div>
        <div class="info-row"><span>Kurulum Tipi</span><strong>${INSTALLATION_TYPE_LABELS[project.installationType]}</strong></div>
        <div class="info-row"><span>Lokasyon</span><strong>${project.projectLocation}</strong></div>
        <div class="info-row"><span>Toplam Güç</span><strong>${project.totalPowerKw.toFixed(1)} kWp</strong></div>
        <div class="info-row"><span>Panel Adedi</span><strong>${project.panelCount}</strong></div>
        <div class="info-row"><span>İnvertör Adedi</span><strong>${project.inverterCount}</strong></div>
        <div class="info-row"><span>Toplam Alan</span><strong>${project.totalAreaM2} m²</strong></div>
        <div class="info-row"><span>Yıllık Üretim</span><strong>${formatNumber(annualProduction)} kWh</strong></div>
      </div>
      <div>
        <div style="font-weight:600;margin-bottom:8px;font-size:11px;">Ekipman Listesi</div>
        <table>
          <tr><th>Kategori</th><th>Marka/Model</th><th style="text-align:right">Adet</th><th style="text-align:right">Toplam</th></tr>
          ${project.equipmentItems.map((item: any) => `
            <tr>
              <td>${EQUIPMENT_CATEGORY_LABELS[item.category]}</td>
              <td>${[item.brand, item.model].filter(Boolean).join(" ") || "—"}</td>
              <td style="text-align:right">${item.quantity}</td>
              <td style="text-align:right">${formatCurrency(item.totalPrice)}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    </div>
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>Sayfa 3</span></div>
</div>

<!-- TİCARİ KAPSAM -->
<div class="page">
  <div class="header-bar"><span class="firm">${project.firm.name}</span><span>${project.name}</span></div>
  <div class="section">
    <div class="section-title">TİCARİ KAPSAM</div>
    <table>
      <tr><th>Kalem</th><th>Açıklama</th><th style="text-align:right">Tutar (KDV Hariç)</th></tr>
      ${project.equipmentItems.map((item: any) => `
        <tr>
          <td>${EQUIPMENT_CATEGORY_LABELS[item.category]}</td>
          <td>${[item.brand, item.model].filter(Boolean).join(" ") || "—"}</td>
          <td style="text-align:right">${formatCurrency(item.totalPrice)}</td>
        </tr>
      `).join("")}
      ${project.costItems.map((item: any) => `
        <tr>
          <td>${COST_CATEGORY_LABELS[item.category]}</td>
          <td>${item.description}</td>
          <td style="text-align:right">${formatCurrency(item.amount)}</td>
        </tr>
      `).join("")}
      ${project.pricingSnapshot ? `
        <tr class="total-row">
          <td colspan="2">Toplam Maliyet</td>
          <td style="text-align:right">${formatCurrency(project.pricingSnapshot.finalTotalCost)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2">Kâr Marjı (%${Math.round(project.pricingSnapshot.profitMarginPercent * 100)})</td>
          <td style="text-align:right">${formatCurrency(project.pricingSnapshot.finalSalePrice - project.pricingSnapshot.finalTotalCost)}</td>
        </tr>
        <tr class="grand-total">
          <td colspan="2">GENEL TOPLAM (KDV HARİÇ)</td>
          <td style="text-align:right">${formatCurrency(project.pricingSnapshot.finalSalePrice)}</td>
        </tr>
      ` : ""}
    </table>
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>Sayfa 4</span></div>
</div>

<!-- FİZİBİLİTE -->
<div class="page">
  <div class="header-bar"><span class="firm">${project.firm.name}</span><span>${project.name}</span></div>
  <div class="section">
    <div class="section-title">FİZİBİLİTE ANALİZİ</div>
    <table style="margin-bottom:16px;">
      <tr><th>Yıl</th><th style="text-align:right">Üretim (kWh)</th><th style="text-align:right">Birim Fiyat</th><th style="text-align:right">Yıllık Tasarruf</th><th style="text-align:right">Kümülatif</th><th style="text-align:right">Net Pozisyon</th></tr>
      ${cashFlow.slice(0, 15).map((row: any) => `
        <tr>
          <td>${row.year}</td>
          <td style="text-align:right">${formatNumber(row.productionKwh)}</td>
          <td style="text-align:right">${row.unitPrice.toFixed(3)}</td>
          <td style="text-align:right">${formatCurrency(row.annualSaving)}</td>
          <td style="text-align:right">${formatCurrency(row.cumulativeSaving)}</td>
          <td style="text-align:right;color:${row.netPosition >= 0 ? "#059669" : "#DC2626"};font-weight:${row.netPosition >= 0 ? "600" : "400"}">${formatCurrency(row.netPosition)}</td>
        </tr>
      `).join("")}
    </table>
    <div class="env-box">
      <div class="env-title">🌱 Çevre Katkısı</div>
      <div class="env-grid">
        <div><div class="env-val">${(totalCO2 / project.projectLifeYears).toFixed(1)} ton</div><div class="env-label">Yıllık CO₂ Tasarrufu</div></div>
        <div><div class="env-val">${totalCO2.toFixed(0)} ton</div><div class="env-label">${project.projectLifeYears} Yıl CO₂ Tasarrufu</div></div>
        <div><div class="env-val">${trees}</div><div class="env-label">Eşdeğer Ağaç</div></div>
      </div>
    </div>
  </div>
  <div class="footer-bar"><span>${formatDate(today)}</span><span>Sayfa 5</span></div>
</div>

<!-- İMZA -->
<div class="page">
  <div class="header-bar"><span class="firm">${project.firm.name}</span><span>${project.name}</span></div>
  <div class="section">
    <div class="section-title">İMZA & ONAY</div>
    <p style="color:#6B7280;margin-bottom:24px;font-size:10px;">Bu teklif ${formatDate(validUntil)} tarihine kadar geçerlidir.</p>
    <div class="two-col">
      <div class="signature-box">
        <div class="signature-title">Teklifi Veren — ${project.firm.name}</div>
        <div style="margin-top:8px;font-size:9px;color:#9CA3AF;">
          ${project.firm.address ?? ""}<br>
          ${project.firm.phone ?? ""} · ${project.firm.email ?? ""}
        </div>
        <div style="margin-top:30px;border-top:1px solid #D1D5DB;padding-top:8px;font-size:9px;color:#9CA3AF;">İmza & Kaşe</div>
      </div>
      <div class="signature-box">
        <div class="signature-title">Müşteri Onayı — ${project.customerName}</div>
        <div style="margin-top:30px;border-top:1px solid #D1D5DB;padding-top:8px;margin-top:60px;font-size:9px;color:#9CA3AF;">İmza & Tarih</div>
      </div>
    </div>
  </div>
  <div class="footer-bar"><span>${project.firm.name} · ${formatDate(today)}</span><span>Sayfa 6</span></div>
</div>

</body>
</html>`;
}
