import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getYearlyReport } from "@/lib/insights";
import { formatDate, formatNumber } from "@/lib/utils";

/**
 * Yıllık özet PDF — sadece admin. /admin/insights ekranındaki "Yıllık
 * Rapor Üret" butonu bu endpoint'i çağırır. ?year=YYYY ile istenir
 * (verilmezse içinde bulunulan yıl).
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Geçersiz yıl" }, { status: 400 });
  }

  const [report, orgPrettyName] = await Promise.all([
    getYearlyReport(user.organizationId, year),
    Promise.resolve(user.organization.name),
  ]);

  const html = buildYearlyReportHtml({
    year,
    organizationName: orgPrettyName,
    generatedAt: new Date(),
    report,
  });

  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "15mm", right: "15mm" },
    });
    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="yillik-rapor-${year}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Yearly report PDF error:", err);
    return NextResponse.json({ error: "PDF oluşturulamadı" }, { status: 500 });
  }
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function buildYearlyReportHtml(data: {
  year: number;
  organizationName: string;
  generatedAt: Date;
  report: Awaited<ReturnType<typeof getYearlyReport>>;
}): string {
  const { year, organizationName, generatedAt, report } = data;
  const { totals, monthly, topWonProjects, topCustomers, statusBreakdown, salespeople } = report;

  // Trend bar grafiği — max değere göre normalize
  const maxCount = Math.max(1, ...monthly.map((m) => m.count));

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111827; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .page:last-child { page-break-after: auto; }

  /* KAPAK */
  .cover {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; color: #fff;
    text-align: center; padding: 40px;
  }
  .cover .badge {
    font-size: 11px; font-weight: 700; letter-spacing: 0.16em;
    color: #34d399; text-transform: uppercase; margin-bottom: 18px;
  }
  .cover h1 { font-size: 48px; font-weight: 800; letter-spacing: -0.02em; }
  .cover h2 { font-size: 22px; font-weight: 500; color: #cbd5e1; margin-top: 12px; }
  .cover .firm { font-size: 14px; color: #94a3b8; margin-top: 32px; }
  .cover .meta { font-size: 11px; color: #64748b; margin-top: 8px; }
  .cover .highlight-row {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 14px; margin-top: 56px; min-width: 480px;
  }
  .cover .highlight-card {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px; padding: 16px 12px; text-align: center;
  }
  .cover .highlight-val { font-size: 24px; font-weight: 800; color: #fbbf24; }
  .cover .highlight-label { font-size: 10px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }

  /* SAYFA İÇİ */
  .inner { padding: 24px 28px; }
  .header-bar {
    background: #0f172a; color: #fff; padding: 8px 24px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px;
  }
  .header-bar .firm { color: #34d399; font-weight: 700; }
  .footer-bar {
    background: #f8fafc; border-top: 1px solid #e2e8f0;
    padding: 6px 24px; font-size: 9px; color: #64748b;
    display: flex; justify-content: space-between;
  }

  .section-title {
    font-size: 14px; font-weight: 800; color: #0f172a;
    margin-bottom: 12px; padding-bottom: 6px;
    border-bottom: 2px solid #10b981; display: inline-block;
  }
  .section-block { margin-bottom: 22px; }

  /* KPI GRID */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; background: #fafafa; }
  .kpi-label { font-size: 9.5px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi-value { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; }
  .kpi-sub { font-size: 9.5px; color: #94a3b8; margin-top: 2px; }
  .kpi-card.accent { background: #ecfdf5; border-color: #a7f3d0; }
  .kpi-card.accent .kpi-value { color: #047857; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
  th { background: #f1f5f9; color: #374151; padding: 6px 8px; text-align: left; font-weight: 700; font-size: 9.5px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #fafbfc; }

  /* TREND BAR */
  .trend-grid { display: grid; grid-template-columns: 64px 1fr 60px 60px; gap: 4px 12px; align-items: center; font-size: 10px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
  .trend-month { font-weight: 700; color: #374151; }
  .trend-bar-track { background: #f1f5f9; border-radius: 99px; height: 14px; position: relative; overflow: hidden; }
  .trend-bar-fill { background: linear-gradient(90deg, #10b981, #059669); height: 100%; border-radius: 99px; }
  .trend-bar-won { background: #047857; height: 100%; border-radius: 99px; position: absolute; left: 0; top: 0; opacity: 0.85; }
  .trend-bar-label { position: absolute; right: 6px; top: 0; line-height: 14px; font-size: 9px; font-weight: 700; color: #fff; }
  .trend-mwp { text-align: right; tabular-nums: true; color: #d97706; font-weight: 700; }
  .trend-won { text-align: right; tabular-nums: true; color: #064e3b; font-weight: 600; font-size: 9.5px; }

  /* STATUS BARS */
  .status-list { display: grid; gap: 8px; }
  .status-row { display: grid; grid-template-columns: 1fr 60px; gap: 8px; align-items: center; font-size: 10.5px; }
  .status-label { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #374151; }
  .status-dot { width: 8px; height: 8px; border-radius: 99px; }
  .status-bar-track { background: #f1f5f9; border-radius: 99px; height: 8px; overflow: hidden; margin-top: 3px; }
  .status-count { text-align: right; tabular-nums: true; color: #6b7280; font-weight: 600; }

  /* TWO COLUMN */
  .two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; }
</style>
</head>
<body>

<!-- KAPAK -->
<div class="page cover">
  <div class="badge">Yıllık Performans Raporu</div>
  <h1>${year}</h1>
  <h2>${organizationName}</h2>
  <div class="firm">${totals.offerCount} teklif · ${formatNumber(totals.totalMwp, 1)} MWp · ${totals.wonCount} kazanılan iş</div>
  <div class="meta">Hazırlanma: ${formatDate(generatedAt)}</div>
  <div class="highlight-row">
    <div class="highlight-card">
      <div class="highlight-val">${totals.offerCount}</div>
      <div class="highlight-label">Toplam Teklif</div>
    </div>
    <div class="highlight-card">
      <div class="highlight-val">${formatNumber(totals.totalMwp, 1)}</div>
      <div class="highlight-label">Toplam MWp</div>
    </div>
    <div class="highlight-card">
      <div class="highlight-val">${totals.winRate === null ? "—" : `%${totals.winRate}`}</div>
      <div class="highlight-label">Kazanma Oranı</div>
    </div>
  </div>
</div>

<!-- SAYFA 2: KPI ÖZETİ + YILLIK TREND -->
<div class="page">
  <div class="header-bar">
    <span class="firm">${organizationName}</span>
    <span>${year} Yıllık Raporu · Sayfa 2</span>
  </div>
  <div class="inner">

    <div class="section-block">
      <div class="section-title">Yıl Özeti</div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Toplam Teklif</div>
          <div class="kpi-value">${totals.offerCount}</div>
          <div class="kpi-sub">${year} yılı boyunca</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Toplam MWp</div>
          <div class="kpi-value">${formatNumber(totals.totalMwp, 1)}</div>
          <div class="kpi-sub">Kurulu güç tüm projeler</div>
        </div>
        <div class="kpi-card accent">
          <div class="kpi-label">Kazanılan İş</div>
          <div class="kpi-value">${totals.wonCount}</div>
          <div class="kpi-sub">${totals.winRate === null ? "Sonuçlanan yok" : `%${totals.winRate} kazanma oranı`}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Kaybedilen</div>
          <div class="kpi-value">${totals.lostCount}</div>
          <div class="kpi-sub">Pipeline: ${totals.pipelineCount} bekleyen</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tamamlanan Ciro</div>
          <div class="kpi-value">${fmtUsd(totals.completedRevenueUsd)}</div>
          <div class="kpi-sub">Kazanılan tekliflerden</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Bekleyen Ciro</div>
          <div class="kpi-value">${fmtUsd(totals.pendingRevenueUsd)}</div>
          <div class="kpi-sub">${totals.pipelineCount} aktif pipeline</div>
        </div>
      </div>
      ${totals.avgPerKwUsd !== null ? `
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;font-size:11px;color:#374151">
        Ortalama özgül maliyet: <strong>$${(totals.avgPerKwUsd / 1000).toFixed(3)}/Wp</strong> · Yıl boyunca fiyatlanan projelerin ortalaması
      </div>` : ""}
    </div>

    <div class="section-block">
      <div class="section-title">Aylık Trend</div>
      <div style="font-size:10px;color:#6b7280;margin-bottom:8px">Yeşil bar: teklif sayısı (koyu yeşil = kazanılan). Sağ sütun: aylık toplam MWp.</div>
      ${monthly.map((m) => {
        const widthPct = (m.count / maxCount) * 100;
        const wonPct = m.count === 0 ? 0 : (m.wonCount / m.count) * widthPct;
        return `
        <div class="trend-grid">
          <div class="trend-month">${m.month}</div>
          <div class="trend-bar-track">
            <div class="trend-bar-fill" style="width:${widthPct.toFixed(1)}%"></div>
            <div class="trend-bar-won" style="width:${wonPct.toFixed(1)}%"></div>
            <div class="trend-bar-label">${m.count > 0 ? m.count : ""}</div>
          </div>
          <div class="trend-won">${m.wonCount > 0 ? `↑ ${m.wonCount}` : ""}</div>
          <div class="trend-mwp">${m.mwp > 0 ? `${formatNumber(m.mwp, 1)} MWp` : "—"}</div>
        </div>`;
      }).join("")}
    </div>

  </div>
  <div class="footer-bar">
    <span>${organizationName} · Yıllık Rapor ${year}</span>
    <span>${formatDate(generatedAt)}</span>
  </div>
</div>

<!-- SAYFA 3: TOP PROJELER + STATUS DAĞILIMI -->
<div class="page">
  <div class="header-bar">
    <span class="firm">${organizationName}</span>
    <span>${year} Yıllık Raporu · Sayfa 3</span>
  </div>
  <div class="inner">

    <div class="section-block">
      <div class="section-title">Yılın En Büyük Kazanılan Projeleri</div>
      ${topWonProjects.length === 0 ? `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:18px;text-align:center;color:#6b7280;font-size:11px">
          ${year} yılında kazanılan teklif yok.
        </div>
      ` : `
      <table>
        <tr>
          <th style="width:36px">#</th>
          <th>Proje</th>
          <th>Müşteri</th>
          <th style="text-align:right">MWp</th>
          <th style="text-align:right">Satış Bedeli</th>
        </tr>
        ${topWonProjects.map((p, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.customerName)}</td>
            <td style="text-align:right;tabular-nums">${formatNumber(p.totalPowerKw / 1000, 2)}</td>
            <td style="text-align:right;tabular-nums;font-weight:700;color:#047857">${fmtUsd(p.finalSalePriceUsd)}</td>
          </tr>
        `).join("")}
      </table>
      `}
    </div>

    <div class="two-col">
      <div>
        <div class="section-title">Top Müşteriler</div>
        ${topCustomers.length === 0 ? `
          <div style="font-size:11px;color:#9ca3af;padding:12px 0">Müşteri verisi yok.</div>
        ` : `
        <table>
          <tr>
            <th>Müşteri</th>
            <th style="text-align:right">Teklif</th>
            <th style="text-align:right">Kazanılan</th>
            <th style="text-align:right">MWp</th>
          </tr>
          ${topCustomers.map((c) => `
            <tr>
              <td>${escapeHtml(c.name)}</td>
              <td style="text-align:right;tabular-nums">${c.offerCount}</td>
              <td style="text-align:right;tabular-nums;color:#047857;font-weight:700">${c.wonCount}</td>
              <td style="text-align:right;tabular-nums">${formatNumber(c.totalMwp, 1)}</td>
            </tr>
          `).join("")}
        </table>
        `}
      </div>

      <div>
        <div class="section-title">Durum Dağılımı</div>
        ${statusBreakdown.length === 0 ? `
          <div style="font-size:11px;color:#9ca3af;padding:12px 0">Proje yok.</div>
        ` : `
        <div class="status-list">
          ${(() => {
            const total = statusBreakdown.reduce((s, x) => s + x.count, 0);
            return statusBreakdown.map((s) => {
              const pct = total === 0 ? 0 : Math.round((s.count / total) * 100);
              return `
              <div>
                <div class="status-row">
                  <div class="status-label">
                    <span class="status-dot" style="background:${s.color}"></span>
                    ${escapeHtml(s.label)}
                  </div>
                  <div class="status-count">${s.count} · %${pct}</div>
                </div>
                <div class="status-bar-track">
                  <div style="background:${s.color};width:${pct}%;height:100%;border-radius:99px"></div>
                </div>
              </div>`;
            }).join("");
          })()}
        </div>
        `}
      </div>
    </div>

  </div>
  <div class="footer-bar">
    <span>${organizationName} · Yıllık Rapor ${year}</span>
    <span>${formatDate(generatedAt)}</span>
  </div>
</div>

<!-- SAYFA 4: EKİP -->
<div class="page">
  <div class="header-bar">
    <span class="firm">${organizationName}</span>
    <span>${year} Yıllık Raporu · Sayfa 4</span>
  </div>
  <div class="inner">

    <div class="section-block">
      <div class="section-title">Ekip Performansı</div>
      ${salespeople.length === 0 ? `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:18px;text-align:center;color:#6b7280;font-size:11px">
          Bu yıl proje oluşturan kullanıcı bulunmuyor.
        </div>
      ` : `
      <table>
        <tr>
          <th style="width:36px">#</th>
          <th>Kullanıcı</th>
          <th style="text-align:right">Teklif</th>
          <th style="text-align:right">Kazanılan</th>
          <th style="text-align:right">Win %</th>
          <th style="text-align:right">MWp</th>
        </tr>
        ${salespeople.map((s, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td>
              <strong>${escapeHtml(s.name)}</strong>
              <div style="font-size:9px;color:#9ca3af">${escapeHtml(s.email)}</div>
            </td>
            <td style="text-align:right;tabular-nums">${s.count}</td>
            <td style="text-align:right;tabular-nums;color:#047857;font-weight:700">${s.wonCount}</td>
            <td style="text-align:right;tabular-nums">${s.wonRate === null ? "—" : `%${s.wonRate}`}</td>
            <td style="text-align:right;tabular-nums">${formatNumber(s.totalMwp, 1)}</td>
          </tr>
        `).join("")}
      </table>
      `}
    </div>

    <div style="margin-top:32px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;font-size:10.5px;color:#374151;line-height:1.6">
      <strong style="color:#0f172a;display:block;margin-bottom:6px;font-size:11px">Rapor Hakkında</strong>
      Bu rapor ${organizationName} firmasının ${year} yılındaki teklif performansını özetler.
      Verilerin tamamı sistem üzerinden otomatik üretilmiş olup, sadece aktif (silinmemiş ve şablon olmayan)
      projeler dahil edilmiştir. Ciro değerleri proje detayındaki <em>finalSalePrice</em> alanı baz alınarak
      hesaplanmıştır. Rapor ${formatDate(generatedAt)} tarihinde oluşturulmuştur.
    </div>

  </div>
  <div class="footer-bar">
    <span>${organizationName} · Yıllık Rapor ${year}</span>
    <span>${formatDate(generatedAt)}</span>
  </div>
</div>

</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
