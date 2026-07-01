import { buildStatement, trDate, type StmtCollection } from "@/lib/cost-control-statement";
import {
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  generateDocId,
  type BrandContext,
} from "@/lib/pdf-brand";

/**
 * Maliyet Kontrol PDF çıktıları — platformun standart PDF görünümü (koyu slate
 * başlık + marka accent bar + brand-row/footer). Tarayıcı "Yazdır → PDF".
 */

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

interface ShellArgs {
  brand: BrandContext;
  firmName: string;
  userEmail: string;
  docTitle: string;
  subtitle: string;
  todayISO: string;
  bodyHtml: string;
}

/** Ortak platform kabuğu — koyu başlık, accent bar, brand footer. */
function shell({ brand, firmName, userEmail, docTitle, subtitle, todayISO, bodyHtml }: ShellArgs): string {
  const docId = generateDocId();
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${esc(docTitle)} — ${esc(subtitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Segoe UI',Arial,sans-serif; color:#0f172a; margin:0; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header { background:${brand.coverGradient}; color:#fff; padding:16px 20px 14px; display:flex; justify-content:space-between; align-items:flex-end; position:relative; z-index:2; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header .doc { text-align:right; }
  .header .doc .t { font-size:15px; font-weight:800; letter-spacing:.5px; }
  .header .doc .d { font-size:10.5px; color:rgba(255,255,255,.8); margin-top:2px; }
  .accent-bar { height:3px; background:${brand.accentGradient}; }
  .content { padding: 22px 26px; }
  .greet { margin: 0 0 12px; }
  .greet b { color:#0f172a; }
  .banner { background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:9px 12px; border-radius:8px; margin-bottom:14px; font-weight:600; }
  .summary { display:flex; gap:10px; margin-bottom:18px; }
  .sbox { flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; }
  .sbox .l { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  .sbox .v { font-size:16px; font-weight:800; margin-top:3px; }
  .sbox.g .v { color:#059669; } .sbox.a .v { color:#d97706; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.6px; color:#334155; margin:18px 0 6px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #eef2f7; }
  thead th { background:#f8fafc; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#64748b; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.empty { text-align:center; color:#94a3b8; }
  td.overdue { color:#dc2626; font-weight:700; } td.today { color:#d97706; font-weight:700; } td.future { color:#64748b; }
  td.owner { font-weight:700; } td.iban { font-family:monospace; font-size:11px; color:#475569; }
  td.rem { color:#d97706; font-weight:700; } td.done { color:#059669; font-weight:700; }
  tr.sub td { padding-top:2px; }
  .subwrap { display:flex; flex-direction:column; gap:2px; padding-left:14px; }
  .subitem { font-size:11px; color:#475569; } .subitem .dim { color:#94a3b8; }
  tfoot td { font-weight:800; border-top:2px solid #e2e8f0; }
  .tot { margin-top:14px; text-align:right; font-size:13px; font-weight:800; } .tot span { color:#d97706; }
  .link { color:${esc(brand.primary)}; font-size:10.5px; margin-top:4px; word-break:break-all; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .content { padding:14px 16px; } }
</style>
</head>
<body>
  ${watermarkHtml(brand, firmName)}
  <div class="header">
    <div>${brandRowHtml(brand, firmName)}<div style="font-size:11px;color:rgba(255,255,255,.85);margin-top:3px">${esc(subtitle)}</div></div>
    <div class="doc"><div class="t">${esc(docTitle)}</div><div class="d">${esc(trDate(todayISO))}</div></div>
  </div>
  <div class="accent-bar"></div>
  <div class="content">${bodyHtml}</div>
  ${brandFooterHtml(brand, firmName, userEmail, docId)}
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
}

// ————————————————————————————————————————————————————————————————
// 1) Müşteri ödeme ekstresi
// ————————————————————————————————————————————————————————————————

export interface StatementPrintInput {
  brand: BrandContext;
  firmName: string;
  userEmail: string;
  customer: string;
  projectName: string;
  sym: string;
  total: number;
  collections: StmtCollection[];
  todayISO: string;
  linkUrl?: string;
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

  const paidRows = v.paid.length
    ? v.paid
        .map(
          (p) =>
            `<tr><td>${esc(trDate(p.collectedDate))}</td><td>${esc(p.note || "-")}</td><td class="num">${sym}${fmt(p.amount)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="empty">Kayıtlı ödeme yok</td></tr>`;

  const plannedSection = v.planned.length
    ? `<h2>Planlanan Ödemeler</h2><table><thead><tr><th>Tarih</th><th>Durum</th><th class="num">Tutar</th></tr></thead><tbody>${v.planned
        .map((p) => {
          const tone = p.status.tone;
          const label =
            tone === "overdue" ? `Gecikmiş — ${esc(p.status.label)}` : tone === "today" ? "Bugün" : esc(p.status.label);
          return `<tr><td>${esc(trDate(p.collectedDate))}</td><td class="${tone}">${label}</td><td class="num">${sym}${fmt(p.amount)}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : "";

  const body = `
    <p class="greet">Sayın <b>${esc(inp.customer || "Yetkili")}</b>,</p>
    <p class="greet">&quot;${esc(inp.projectName)}&quot; işine ait güncel ödeme durumunuz aşağıdadır.</p>
    ${v.hasOverdue ? `<div class="banner">Vadesi geçmiş ödemeniz bulunmaktadır. Lütfen en kısa sürede iletişime geçiniz.</div>` : ""}
    <div class="summary">
      <div class="sbox"><div class="l">Toplam Tutar</div><div class="v">${sym}${fmt(inp.total)}</div></div>
      <div class="sbox g"><div class="l">Ödenen</div><div class="v">${sym}${fmt(v.collected)}</div></div>
      <div class="sbox a"><div class="l">Kalan Bakiye</div><div class="v">${sym}${fmt(v.remaining)}</div></div>
    </div>
    <h2>Ödeme Geçmişi</h2>
    <table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tutar</th></tr></thead><tbody>${paidRows}</tbody></table>
    ${plannedSection}
    ${inp.linkUrl ? `<p class="link">Çevrimiçi ekstre: ${esc(inp.linkUrl)}</p>` : ""}`;

  return shell({
    brand: inp.brand,
    firmName: inp.firmName,
    userEmail: inp.userEmail,
    docTitle: "ÖDEME EKSTRESİ",
    subtitle: inp.projectName,
    todayISO: inp.todayISO,
    bodyHtml: body,
  });
}

// ————————————————————————————————————————————————————————————————
// 2) Ödeme yapılacak kişiler (dağıtım)
// ————————————————————————————————————————————————————————————————

export interface PayOwnerVendorRow {
  name: string;
  total: number;
  remaining: number;
}
export interface PayOwnerRow {
  owner: string;
  iban: string;
  total: number;
  paid: number;
  remaining: number;
  vendors: PayOwnerVendorRow[];
}

function paymentOwnersBodyHtml(groups: PayOwnerRow[]): string {
  const totalRemaining = groups.reduce((s, g) => s + g.remaining, 0);
  const rows = groups
    .map((g) => {
      const done = g.remaining <= 0.5;
      const sub =
        g.vendors.length && (g.vendors.length > 1 || (g.vendors[0] && g.vendors[0].name !== g.owner))
          ? `<tr class="sub"><td colspan="5"><div class="subwrap">${g.vendors
              .map(
                (v) =>
                  `<span class="subitem">↳ ${esc(v.name || "-")}: <b>₺${fmt(v.remaining)}</b> <span class="dim">(toplam ₺${fmt(v.total)})</span></span>`,
              )
              .join("")}</div></td></tr>`
          : "";
      return `<tr>
        <td class="owner">${esc(g.owner)}</td>
        <td class="iban">${esc(g.iban || "-")}</td>
        <td class="num">₺${fmt(g.total)}</td>
        <td class="num">₺${fmt(g.paid)}</td>
        <td class="num ${done ? "done" : "rem"}">${done ? "Ödendi" : "₺" + fmt(g.remaining)}</td>
      </tr>${sub}`;
    })
    .join("");
  return `
    <h2>Ödeme Yapılacak Kişiler</h2>
    <table>
      <thead><tr><th>Ödeme Sahibi</th><th>IBAN</th><th class="num">Ödenecek (KDV dahil)</th><th class="num">Ödenen</th><th class="num">Kalan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot">Toplam Kalan: <span>₺${fmt(totalRemaining)}</span></div>
    <p style="margin-top:8px;color:#64748b;font-size:10.5px">Alt satırlar (↳) ödeme sahibinin hangi tedarikçiler için ödeme yaptığını gösterir.</p>`;
}

export function buildPaymentOwnersPrintHtml(inp: {
  brand: BrandContext;
  firmName: string;
  userEmail: string;
  projectName: string;
  todayISO: string;
  groups: PayOwnerRow[];
}): string {
  return shell({
    brand: inp.brand,
    firmName: inp.firmName,
    userEmail: inp.userEmail,
    docTitle: "ÖDEME LİSTESİ",
    subtitle: inp.projectName,
    todayISO: inp.todayISO,
    bodyHtml: paymentOwnersBodyHtml(inp.groups),
  });
}

// ————————————————————————————————————————————————————————————————
// 3) Harcama kalemleri
// ————————————————————————————————————————————————————————————————

export interface CostLinePrintRow {
  code: string;
  description: string;
  vendorName: string;
  qty: number;
  unit: string;
  net: number;
  vat: number;
  gross: number;
  paidStatus: string; // "Ödendi" | "Kısmi %.." | "Ödenmedi"
}

function costLinesBodyHtml(rows: CostLinePrintRow[]): string {
  const t = rows.reduce(
    (a, r) => ({ net: a.net + r.net, vat: a.vat + r.vat, gross: a.gross + r.gross }),
    { net: 0, vat: 0, gross: 0 },
  );
  const rowsHtml = rows.length
    ? rows
        .map(
          (r) =>
            `<tr>
              <td style="font-family:monospace;color:#64748b">${esc(r.code || "-")}</td>
              <td>${esc(r.description)}${r.vendorName ? `<div class="dim" style="color:#94a3b8;font-size:10px">${esc(r.vendorName)}</div>` : ""}</td>
              <td class="num">${fmt(r.qty)} ${esc(r.unit)}</td>
              <td class="num">₺${fmt(r.net)}</td>
              <td class="num">₺${fmt(r.vat)}</td>
              <td class="num">₺${fmt(r.gross)}</td>
              <td>${esc(r.paidStatus)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">Kalem yok</td></tr>`;
  return `
    <h2>Harcama Kalemleri</h2>
    <table>
      <thead><tr><th>Kod</th><th>Tanım</th><th class="num">Miktar</th><th class="num">KDV hariç</th><th class="num">KDV</th><th class="num">KDV dahil</th><th>Ödeme</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="3" class="num">TOPLAM</td><td class="num">₺${fmt(t.net)}</td><td class="num">₺${fmt(t.vat)}</td><td class="num">₺${fmt(t.gross)}</td><td></td></tr></tfoot>
    </table>`;
}

export function buildCostLinesPrintHtml(inp: {
  brand: BrandContext;
  firmName: string;
  userEmail: string;
  projectName: string;
  todayISO: string;
  rows: CostLinePrintRow[];
}): string {
  return shell({
    brand: inp.brand,
    firmName: inp.firmName,
    userEmail: inp.userEmail,
    docTitle: "HARCAMA KALEMLERİ",
    subtitle: inp.projectName,
    todayISO: inp.todayISO,
    bodyHtml: costLinesBodyHtml(inp.rows),
  });
}

// ————————————————————————————————————————————————————————————————
// 4) Tam analiz raporu — tek PDF, 3 sayfa (özet + kalemler + ödeme listesi)
// ————————————————————————————————————————————————————————————————

export interface CostReportSummary {
  customer: string;
  statusLabel: string;
  salesNet: number;
  salesVat: number;
  salesGross: number;
  costNet: number;
  costVat: number;
  costGross: number;
  vok: number;
  vatPayable: number;
  vatRate: number;
  corporateTax: number;
  corporateRate: number;
  uninvoicedProfit: number;
  invoicedProfit: number;
  netProfit: number;
  paid: number;
  payableRemaining: number;
  collected: number;
  remainingReceivable: number;
  salesSym: string;
}

function money(sym: string, n: number): string {
  return `${sym}${fmt(n)}`;
}

function summaryBodyHtml(s: CostReportSummary): string {
  const kpi = (label: string, value: string, sub?: string) =>
    `<div class="kbox"><div class="kl">${esc(label)}</div><div class="kv">${value}</div>${sub ? `<div class="ks">${esc(sub)}</div>` : ""}</div>`;
  return `
    <h2>Proje Analiz Özeti</h2>
    <p style="margin:0 0 12px;color:#64748b;font-size:11px">Müşteri: <b>${esc(s.customer || "—")}</b> · Durum: ${esc(s.statusLabel)}</p>
    <div class="kgrid">
      ${kpi("Satış (KDV hariç)", money(s.salesSym, s.salesNet), `+KDV ${money(s.salesSym, s.salesVat)} · Dahil ${money(s.salesSym, s.salesGross)}`)}
      ${kpi("Gerçekleşen Maliyet (KDV hariç)", `₺${fmt(s.costNet)}`, `KDV dahil ₺${fmt(s.costGross)}`)}
      ${kpi("Vergi Öncesi Kâr (VÖK, KDV dahil)", `₺${fmt(s.vok)}`)}
      ${kpi("Kalan Alacak", money(s.salesSym, s.remainingReceivable), `Tahsil: ${money(s.salesSym, s.collected)}`)}
      ${kpi("Tedarikçilere Ödenen", `₺${fmt(s.paid)}`)}
      ${kpi("Tedarikçilere Kalan", `₺${fmt(s.payableRemaining)}`)}
    </div>

    <h2 style="margin-top:18px">Vergi &amp; Şirkete Net</h2>
    <table>
      <tbody>
        <tr><td>Müşteriden alınan KDV</td><td class="num">₺${fmt(s.salesVat)}</td></tr>
        <tr><td>Maliyet KDV'si (indirilecek)</td><td class="num">−₺${fmt(s.costVat)}</td></tr>
        <tr class="strong"><td>Devlete Ödenecek KDV (%${fmt(s.vatRate)})</td><td class="num rem">₺${fmt(s.vatPayable)}</td></tr>
        <tr><td>Faturalı kâr (KDV hariç)</td><td class="num">₺${fmt(s.invoicedProfit)}</td></tr>
        <tr><td>− Kurumlar Vergisi (%${fmt(s.corporateRate)})</td><td class="num rem">−₺${fmt(s.corporateTax)}</td></tr>
        <tr><td>+ Faturasız kâr (vergisiz)</td><td class="num">₺${fmt(s.uninvoicedProfit)}</td></tr>
        <tr class="strong"><td>= Şirkete Net Kâr</td><td class="num done">₺${fmt(s.netProfit)}</td></tr>
      </tbody>
    </table>`;
}

export function buildCostReportPrintHtml(inp: {
  brand: BrandContext;
  firmName: string;
  userEmail: string;
  projectName: string;
  todayISO: string;
  summary: CostReportSummary;
  rows: CostLinePrintRow[];
  groups: PayOwnerRow[];
}): string {
  const b = inp.brand;
  const docId = generateDocId();
  const pageHeader = (subtitle: string) => `
    <div class="header">
      <div>${brandRowHtml(b, inp.firmName)}<div style="font-size:11px;color:rgba(255,255,255,.85);margin-top:3px">${esc(subtitle)}</div></div>
      <div class="doc"><div class="t">MALİYET ANALİZ RAPORU</div><div class="d">${esc(trDate(inp.todayISO))}</div></div>
    </div>
    <div class="accent-bar"></div>`;
  const page = (subtitle: string, bodyHtml: string, last = false) =>
    `<section class="page"${last ? "" : ' style="break-after:page;page-break-after:always"'}>${pageHeader(subtitle)}<div class="content">${bodyHtml}</div></section>`;

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>Maliyet Analiz Raporu — ${esc(inp.projectName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Segoe UI',Arial,sans-serif; color:#0f172a; margin:0; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header { background:${b.coverGradient}; color:#fff; padding:16px 20px 14px; display:flex; justify-content:space-between; align-items:flex-end; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header .doc { text-align:right; }
  .header .doc .t { font-size:15px; font-weight:800; letter-spacing:.5px; }
  .header .doc .d { font-size:10.5px; color:rgba(255,255,255,.8); margin-top:2px; }
  .accent-bar { height:3px; background:${b.accentGradient}; }
  .content { padding: 22px 26px; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.6px; color:#334155; margin:0 0 8px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #eef2f7; }
  thead th { background:#f8fafc; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#64748b; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.empty { text-align:center; color:#94a3b8; }
  tr.strong td { font-weight:800; border-top:1px solid #e2e8f0; }
  td.rem { color:#dc2626; font-weight:700; } td.done { color:#059669; font-weight:800; }
  tfoot td { font-weight:800; border-top:2px solid #e2e8f0; }
  .tot { margin-top:14px; text-align:right; font-size:13px; font-weight:800; } .tot span { color:#d97706; }
  .subwrap { display:flex; flex-direction:column; gap:2px; padding-left:14px; }
  .subitem { font-size:11px; color:#475569; } .subitem .dim { color:#94a3b8; }
  .kgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .kbox { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; }
  .kbox .kl { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  .kbox .kv { font-size:16px; font-weight:800; margin-top:3px; }
  .kbox .ks { font-size:10px; color:#94a3b8; margin-top:2px; }
  .foot { padding: 10px 26px; border-top:1px solid #e2e8f0; color:#64748b; font-size:10px; }
  @media print { .content { padding:14px 16px; } }
</style>
</head>
<body>
  ${page("Özet · " + inp.projectName, summaryBodyHtml(inp.summary))}
  ${page("Harcama Kalemleri · " + inp.projectName, costLinesBodyHtml(inp.rows))}
  ${page("Ödeme Listesi · " + inp.projectName, paymentOwnersBodyHtml(inp.groups), true)}
  <div class="foot">${esc(inp.firmName)} · Belge No: ${docId} · ${esc(inp.userEmail)}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;
}
