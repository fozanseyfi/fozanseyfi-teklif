import { buildStatement, trDate, type StmtCollection } from "@/lib/cost-control-statement";

/**
 * Müşteri ödeme ekstresinin yazdırılabilir (PDF) HTML çıktısı. Tarayıcı
 * "Yazdır → PDF olarak kaydet" ile PDF üretir (platformun genel PDF yaklaşımı).
 */

export interface StatementPrintInput {
  firmName: string;
  customer: string;
  projectName: string;
  sym: string;
  total: number;
  collections: StmtCollection[];
  todayISO: string;
  linkUrl?: string;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function buildStatementPrintHtml(inp: StatementPrintInput): string {
  const v = buildStatement({
    customer: inp.customer,
    firmName: inp.firmName,
    projectName: inp.projectName,
    sym: inp.sym,
    total: inp.total,
    collections: inp.collections,
    todayISO: inp.todayISO,
  });
  const sym = inp.sym;
  const printedAt = trDate(inp.todayISO);

  const paidRows = v.paid.length
    ? v.paid
        .map(
          (p) =>
            `<tr><td>${esc(trDate(p.collectedDate))}</td><td>${esc(p.note || "-")}</td><td class="num">${sym}${fmt(p.amount)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="empty">Kayıtlı ödeme yok</td></tr>`;

  const plannedRows = v.planned.length
    ? v.planned
        .map((p) => {
          const toneClass =
            p.status.tone === "overdue" ? "overdue" : p.status.tone === "today" ? "today" : "future";
          const label =
            p.status.tone === "overdue"
              ? `Gecikmiş — ${esc(p.status.label)}`
              : p.status.tone === "today"
                ? "Bugün"
                : esc(p.status.label);
          return `<tr><td>${esc(trDate(p.collectedDate))}</td><td class="${toneClass}">${label}</td><td class="num">${sym}${fmt(p.amount)}</td></tr>`;
        })
        .join("")
    : "";

  const plannedSection = v.planned.length
    ? `<h2>Planlanan Ödemeler</h2>
       <table>
         <thead><tr><th>Tarih</th><th>Durum</th><th class="num">Tutar</th></tr></thead>
         <tbody>${plannedRows}</tbody>
       </table>`
    : "";

  const overdueBanner = v.hasOverdue
    ? `<div class="banner">Vadesi geçmiş ödemeniz bulunmaktadır. Lütfen en kısa sürede iletişime geçiniz.</div>`
    : "";

  const linkLine = inp.linkUrl
    ? `<p class="link">Çevrimiçi ekstre: ${esc(inp.linkUrl)}</p>`
    : "";

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>Ödeme Ekstresi — ${esc(inp.projectName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px 36px; font-size: 12.5px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
  .firm { font-size: 17px; font-weight: 800; color: #059669; }
  .doc { text-align: right; }
  .doc .t { font-size: 15px; font-weight: 800; letter-spacing: .5px; }
  .doc .d { color: #64748b; font-size: 11px; margin-top: 2px; }
  .greet { margin: 4px 0 14px; }
  .greet b { color: #0f172a; }
  .banner { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 9px 12px; border-radius: 8px; margin-bottom: 14px; font-weight: 600; }
  .summary { display: flex; gap: 10px; margin-bottom: 18px; }
  .sbox { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
  .sbox .l { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
  .sbox .v { font-size: 16px; font-weight: 800; margin-top: 3px; }
  .sbox.g .v { color: #059669; }
  .sbox.a .v { color: #d97706; }
  h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .6px; color: #334155; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eef2f7; }
  thead th { background: #f8fafc; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: #64748b; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.empty { text-align: center; color: #94a3b8; }
  td.overdue { color: #dc2626; font-weight: 700; }
  td.today { color: #d97706; font-weight: 700; }
  td.future { color: #64748b; }
  .foot { margin-top: 26px; border-top: 1px solid #e2e8f0; padding-top: 10px; color: #64748b; font-size: 10.5px; }
  .link { color: #059669; font-size: 10.5px; margin-top: 4px; word-break: break-all; }
  @media print { body { padding: 12px 16px; } }
</style>
</head>
<body>
  <div class="head">
    <div class="firm">${esc(inp.firmName)}</div>
    <div class="doc"><div class="t">ÖDEME EKSTRESİ</div><div class="d">${esc(printedAt)}</div></div>
  </div>

  <p class="greet">Sayın <b>${esc(inp.customer || "Yetkili")}</b>,</p>
  <p class="greet">&quot;${esc(inp.projectName)}&quot; işine ait güncel ödeme durumunuz aşağıdadır.</p>

  ${overdueBanner}

  <div class="summary">
    <div class="sbox"><div class="l">Toplam Tutar</div><div class="v">${sym}${fmt(inp.total)}</div></div>
    <div class="sbox g"><div class="l">Ödenen</div><div class="v">${sym}${fmt(v.collected)}</div></div>
    <div class="sbox a"><div class="l">Kalan Bakiye</div><div class="v">${sym}${fmt(v.remaining)}</div></div>
  </div>

  <h2>Ödeme Geçmişi</h2>
  <table>
    <thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tutar</th></tr></thead>
    <tbody>${paidRows}</tbody>
  </table>

  ${plannedSection}

  <div class="foot">
    Bu ekstre ${esc(inp.firmName)} tarafından bilgilendirme amacıyla düzenlenmiştir. Sorularınız için firma ile iletişime geçebilirsiniz.
    ${linkLine}
  </div>

  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
}
