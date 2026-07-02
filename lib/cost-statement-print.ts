import { buildStatement, trDate, plannedStatus, type StmtCollection } from "@/lib/cost-control-statement";
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

/** IBAN'ı okunur grupla: ilk 2 karakter, ardından 4'erli bloklar (TR 7800 2050 …). */
export function formatIban(iban: string): string {
  const s = (iban || "").replace(/\s+/g, "").toUpperCase();
  if (!s) return "";
  const head = s.slice(0, 2);
  const rest = s.slice(2).replace(/(.{4})/g, "$1 ").trim();
  return rest ? `${head} ${rest}` : head;
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
  h2 { font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#0f172a; margin:22px 0 10px; padding:7px 12px; border-left:4px solid ${esc(brand.primary)}; border-radius:0 8px 8px 0; background:linear-gradient(90deg, ${esc(brand.primary)}14, transparent 80%); }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #eef2f7; }
  thead th { background:#f8fafc; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#64748b; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.dim { color:#94a3b8; font-size:11px; }
  td.empty { text-align:center; color:#94a3b8; }
  td.overdue { color:#dc2626; font-weight:700; } td.today { color:#d97706; font-weight:700; } td.future { color:#64748b; }
  .progwrap { margin:2px 0 18px; }
  .progrow { display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:5px; }
  .progrow b { color:#059669; }
  .prog { height:10px; border-radius:99px; background:#eef2f7; overflow:hidden; }
  .prog > span { display:block; height:100%; background:${brand.accentGradient}; border-radius:99px; }
  .qr { display:flex; align-items:center; gap:16px; margin-top:20px; padding:14px 16px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
  .qr .qrimg { flex:0 0 auto; padding:6px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; line-height:0; }
  .qr .qrimg svg { display:block; width:96px; height:96px; }
  .qr .qrh { font-size:12px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:.5px; }
  .qr .qrd { font-size:11px; color:#64748b; margin-top:3px; line-height:1.5; }
  .qr .qrl { font-size:11px; color:#64748b; margin-top:6px; }
  .linksent { font-size:11.5px; color:#64748b; margin-top:14px; }
  .pay { margin-top:20px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
  .pay .payh { background:#f1f5f9; padding:8px 14px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#334155; }
  .pay .paytbl { width:100%; }
  .pay .paytbl td { border-bottom:1px solid #f1f5f9; padding:8px 14px; }
  .pay .paytbl tr:last-child td { border-bottom:0; }
  .pay .payk { width:130px; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#94a3b8; vertical-align:top; }
  .pay .payv { font-size:12px; font-weight:600; color:#0f172a; }
  .pay .payv.mono { font-family:'Courier New',monospace; letter-spacing:.5px; font-weight:700; }
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
  qrSvg?: string; // çevrimiçi ekstre karekodu (SVG markup) — client'ta üretilir
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
  const total = inp.total || 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, (v.collected / total) * 100)) : 0;

  // Ödeme geçmişi — kümülatif % (o ödemeden sonra toplam ne kadarı ödendi).
  let running = 0;
  const paidRows = v.paid.length
    ? v.paid
        .map((p) => {
          running += p.amount || 0;
          const cum = total > 0 ? Math.max(0, Math.min(100, (running / total) * 100)) : 0;
          return `<tr><td>${esc(trDate(p.collectedDate))}</td><td>${esc(p.note || "-")}</td><td class="num">${sym}${fmt(p.amount)}</td><td class="num dim">%${fmt1(cum)}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="empty">Kayıtlı ödeme yok</td></tr>`;

  const plannedSection = v.planned.length
    ? `<h2>Planlanan Ödemeler</h2><table><thead><tr><th>Tarih</th><th>Açıklama</th><th>Durum</th><th class="num">Tutar</th><th class="num">Toplamın %</th></tr></thead><tbody>${v.planned
        .map((p) => {
          const tone = p.status.tone;
          const label =
            tone === "overdue" ? `Gecikmiş — ${esc(p.status.label)}` : tone === "today" ? "Bugün" : esc(p.status.label);
          const share = total > 0 ? (p.amount / total) * 100 : 0;
          return `<tr><td>${esc(trDate(p.collectedDate))}</td><td>${esc(p.note || "-")}</td><td class="${tone}">${label}</td><td class="num">${sym}${fmt(p.amount)}</td><td class="num dim">%${fmt1(share)}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : "";

  const bank = inp.brand;
  const payBlock =
    bank.payCompanyName || bank.payIban || bank.payBankName
      ? `<div class="pay">
           <div class="payh">Ödeme Bilgileri</div>
           <table class="paytbl"><tbody>
             ${bank.payCompanyName ? `<tr><td class="payk">Hesap Sahibi</td><td class="payv">${esc(bank.payCompanyName)}</td></tr>` : ""}
             ${bank.payBankName ? `<tr><td class="payk">Banka</td><td class="payv">${esc(bank.payBankName)}</td></tr>` : ""}
             ${bank.payIban ? `<tr><td class="payk">IBAN</td><td class="payv mono">${esc(formatIban(bank.payIban))}</td></tr>` : ""}
           </tbody></table>
         </div>`
      : "";

  const linkWord = inp.linkUrl
    ? `<a href="${esc(inp.linkUrl)}" style="color:${esc(bank.primary)};font-weight:700;text-decoration:underline">linkten</a>`
    : "";
  const linkSentence = inp.linkUrl
    ? `Güncel ekstrenize ${linkWord} de ulaşım sağlayabilirsiniz.`
    : "";

  const qrBlock = inp.qrSvg
    ? `<div class="qr">
         <div class="qrimg">${inp.qrSvg}</div>
         <div class="qrtxt">
           <div class="qrh">Çevrimiçi Ekstre</div>
           <div class="qrd">Karekodu telefonunuzla okutarak güncel ödeme durumunuzu her an görüntüleyebilirsiniz.</div>
           ${inp.linkUrl ? `<div class="qrl">${linkSentence}</div>` : ""}
         </div>
       </div>`
    : inp.linkUrl
      ? `<p class="linksent">${linkSentence}</p>`
      : "";

  const body = `
    <p class="greet">Sayın <b>${esc(inp.customer || "Yetkili")}</b>,</p>
    <p class="greet">&quot;${esc(inp.projectName)}&quot; işine ait güncel ödeme durumunuz aşağıdadır.</p>
    ${v.hasOverdue ? `<div class="banner">Vadesi geçmiş ödemeniz bulunmaktadır. Lütfen en kısa sürede iletişime geçiniz.</div>` : ""}
    <div class="summary">
      <div class="sbox"><div class="l">Toplam Tutar</div><div class="v">${sym}${fmt(total)}</div></div>
      <div class="sbox g"><div class="l">Ödenen</div><div class="v">${sym}${fmt(v.collected)}</div></div>
      <div class="sbox a"><div class="l">Kalan Bakiye</div><div class="v">${sym}${fmt(v.remaining)}</div></div>
    </div>
    <div class="progwrap">
      <div class="progrow"><span>Ödeme tamamlanma</span><span><b>%${fmt1(pct)}</b> ödendi · kalan ${sym}${fmt(v.remaining)}</span></div>
      <div class="prog"><span style="width:${pct.toFixed(1)}%"></span></div>
    </div>
    <h2>Ödeme Geçmişi</h2>
    <table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tutar</th><th class="num">Kümülatif</th></tr></thead><tbody>${paidRows}</tbody></table>
    ${plannedSection}
    ${payBlock}
    ${qrBlock}`;

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
  current: number; // anlık (nakit) VÖK = tahsil − ödenen
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
function fmt1(n: number): string {
  return (n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function summaryBodyHtml(s: CostReportSummary): string {
  const kpi = (label: string, value: string, sub?: string) =>
    `<div class="kbox"><div class="kl">${esc(label)}</div><div class="kv">${value}</div>${sub ? `<div class="ks">${esc(sub)}</div>` : ""}</div>`;
  return `
    <h2>Proje Analiz Özeti</h2>
    <p style="margin:0 0 12px;color:#64748b;font-size:11px">Müşteri: <b>${esc(s.customer || "—")}</b> · Durum: ${esc(s.statusLabel)}</p>
    <div class="kgrid">
      ${kpi("Satış (KDV hariç)", money(s.salesSym, s.salesNet), `+KDV ${money(s.salesSym, s.salesVat)} · Dahil ${money(s.salesSym, s.salesGross)}`)}
      ${kpi("Gerçekleşen Maliyet (KDV hariç)", `₺${fmt(s.costNet)}`, `+KDV ₺${fmt(s.costVat)} · Dahil ₺${fmt(s.costGross)}`)}
      ${kpi("Vergi Öncesi Kâr (VÖK, KDV dahil)", `₺${fmt(s.vok)}`, `Anlık (nakit) ₺${fmt(s.current)}`)}
      ${kpi("Kalan Alacak", money(s.salesSym, s.remainingReceivable), `Tahsil: ${money(s.salesSym, s.collected)}`)}
      ${kpi("Tedarikçilere Ödenen", `₺${fmt(s.paid)}`)}
      ${kpi("Tedarikçilere Kalan", `₺${fmt(s.payableRemaining)}`)}
    </div>

    <h2 style="margin-top:18px">Vergi &amp; Şirkete Net</h2>
    <table>
      <tbody>
        <tr><td>Müşteriden alınan KDV</td><td class="num">₺${fmt(s.salesVat)}</td></tr>
        <tr><td>Maliyet KDV'si (indirilecek)</td><td class="num">−₺${fmt(s.costVat)}</td></tr>
        <tr class="strong"><td>Devlete Ödenecek KDV (%${fmt(s.vatRate)})</td><td class="num ${s.vatPayable > 0 ? "rem" : "done"}">${s.vatPayable > 0 ? `₺${fmt(s.vatPayable)}` : "KDV yükü yok"}</td></tr>
        <tr><td>Vergi Öncesi Kâr (VÖK, KDV dahil)</td><td class="num">₺${fmt(s.vok)}</td></tr>
        <tr><td>− Ödenecek KDV</td><td class="num rem">${s.vatPayable > 0 ? `−₺${fmt(s.vatPayable)}` : "yük yok (0)"}</td></tr>
        <tr><td>− Kurumlar Vergisi (%${fmt(s.corporateRate)})</td><td class="num rem">−₺${fmt(s.corporateTax)}</td></tr>
        <tr class="strong"><td>= Şirkete Net Kâr</td><td class="num done">₺${fmt(s.netProfit)}</td></tr>
      </tbody>
    </table>
    <p style="margin-top:6px;color:#64748b;font-size:10px">Kurumlar vergisi yalnız faturalı kâr (₺${fmt(s.invoicedProfit)}) üzerinden; faturasız kâr (₺${fmt(s.uninvoicedProfit)}) VÖK'e dahildir.</p>`;
}

export interface ReportBreakdownRow {
  name: string;
  amount: number;
  pct: number;
}
export interface ReportCollection {
  date: string;
  amount: number;
  planned: boolean;
  note: string;
}
export interface ReportPartner {
  name: string;
  sharePercent: number;
  amount: number;
}

/** Ayrı sayfa: Maliyet Kırılımı (kategori · KDV dahil) — büyük başlıklı. */
function breakdownPageHtml(breakdown: ReportBreakdownRow[]): string {
  const total = breakdown.reduce((s, r) => s + r.amount, 0);
  const rows = breakdown.length
    ? breakdown
        .map(
          (r) => `<tr>
            <td>${esc(r.name)}</td>
            <td style="width:38%"><div class="prog"><span style="width:${Math.max(0, Math.min(100, r.pct)).toFixed(1)}%"></span></div></td>
            <td class="num">₺${fmt(r.amount)}</td>
            <td class="num">%${fmt1(r.pct)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Kalem yok</td></tr>`;
  return `
    <div class="bigtitle">
      <div class="t">Maliyet Kırılımı</div>
      <div class="s">Kategori Bazında · KDV Dahil</div>
      <div class="rule"></div>
    </div>
    <table>
      <thead><tr><th>Kategori</th><th>Dağılım</th><th class="num">Tutar (KDV dahil)</th><th class="num">Pay</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2" class="num">TOPLAM</td><td class="num">₺${fmt(total)}</td><td class="num">%100,0</td></tr></tfoot>
    </table>`;
}

/** Sayfa 1 ekleri: müşteriden tahsilat + ortaklara dağıtım (beautified). */
function extraSummaryHtml(
  s: CostReportSummary,
  collections: ReportCollection[],
  partners: ReportPartner[],
  todayISO: string,
): string {
  const sym = s.salesSym;
  const pct = s.salesGross > 0 ? Math.max(0, Math.min(100, (s.collected / s.salesGross) * 100)) : 0;

  const paid = collections.filter((c) => !c.planned).sort((a, b) => (a.date < b.date ? 1 : -1));
  const planned = collections.filter((c) => c.planned).sort((a, b) => (a.date < b.date ? -1 : 1));
  const collRows = paid.length
    ? paid
        .map((c) => `<tr><td>${esc(trDate(c.date))}</td><td>${esc(c.note || "-")}</td><td class="num done">${money(sym, c.amount)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="empty">Tahsilat kaydı yok</td></tr>`;
  const plannedRows = planned.length
    ? `<h2 style="margin-top:14px">Planlanan Tahsilatlar</h2>
       <table><thead><tr><th>Planlanan Tarih</th><th>Durum</th><th>Açıklama</th><th class="num">Tutar</th></tr></thead>
       <tbody>${planned
         .map((c) => {
           const st = plannedStatus(c.date, todayISO);
           return `<tr><td>${esc(trDate(c.date))}</td><td class="${st.tone}">${esc(st.label)}</td><td>${esc(c.note || "-")}</td><td class="num">${money(sym, c.amount)}</td></tr>`;
         })
         .join("")}</tbody></table>`
    : "";
  const tahsilat = `
    <h2 style="margin-top:18px">Müşteriden Tahsilat</h2>
    <div class="kgrid" style="margin-bottom:6px">
      <div class="kbox"><div class="kl">Satış (KDV dahil)</div><div class="kv">${money(sym, s.salesGross)}</div></div>
      <div class="kbox g"><div class="kl">Tahsil Edilen</div><div class="kv">${money(sym, s.collected)}</div></div>
      <div class="kbox a"><div class="kl">Kalan Alacak</div><div class="kv">${money(sym, s.remainingReceivable)}</div></div>
    </div>
    <div class="prog"><span style="width:${pct.toFixed(1)}%"></span></div>
    <div class="proglbl"><span>Tahsilat ilerlemesi</span><span>%${fmt1(pct)} tahsil edildi</span></div>
    <table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tutar</th></tr></thead><tbody>${collRows}</tbody></table>
    ${plannedRows}`;

  const ort = partners.length
    ? `<h2 style="margin-top:18px">Ortaklara Dağıtım (mevcut kâr)</h2>
       <table><thead><tr><th>Ortak</th><th class="num">Pay %</th><th class="num">Tutar</th></tr></thead>
       <tbody>${partners
         .map((p) => `<tr><td>${esc(p.name)}</td><td class="num">%${fmt1(p.sharePercent)}</td><td class="num">₺${fmt(p.amount)}</td></tr>`)
         .join("")}</tbody></table>`
    : "";

  return `${tahsilat}${ort}`;
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
  breakdown: ReportBreakdownRow[];
  collections: ReportCollection[];
  partners: ReportPartner[];
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
  .kbox.g { border-color:#bbf7d0; background:#f0fdf4; } .kbox.a { border-color:#fed7aa; background:#fffbeb; }
  .kbox .kl { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  .kbox .kv { font-size:16px; font-weight:800; margin-top:3px; }
  .kbox.g .kv { color:#059669; } .kbox.a .kv { color:#d97706; }
  .kbox .ks { font-size:10px; color:#94a3b8; margin-top:2px; }
  .prog { height:8px; border-radius:99px; background:#eef2f7; overflow:hidden; margin:2px 0 4px; }
  .prog > span { display:block; height:100%; background:${b.accentGradient}; }
  .proglbl { display:flex; justify-content:space-between; font-size:10px; color:#64748b; margin-bottom:12px; }
  td.overdue { color:#dc2626; font-weight:700; } td.today { color:#d97706; font-weight:700; } td.future { color:#64748b; }
  .bigtitle { text-align:center; margin:26px 0 18px; }
  .bigtitle .t { font-size:20px; font-weight:800; letter-spacing:.5px; color:#0f172a; }
  .bigtitle .s { font-size:11px; color:#64748b; margin-top:4px; text-transform:uppercase; letter-spacing:.6px; }
  .bigtitle .rule { width:56px; height:3px; border-radius:99px; background:${b.accentGradient}; margin:10px auto 0; }
  .foot { padding: 10px 26px; border-top:1px solid #e2e8f0; color:#64748b; font-size:10px; }
  @media print { .content { padding:14px 16px; } }
</style>
</head>
<body>
  ${page("Özet · " + inp.projectName, summaryBodyHtml(inp.summary) + extraSummaryHtml(inp.summary, inp.collections, inp.partners, inp.todayISO))}
  ${inp.breakdown.length ? page("Maliyet Kırılımı · " + inp.projectName, breakdownPageHtml(inp.breakdown)) : ""}
  ${page("Harcama Kalemleri · " + inp.projectName, costLinesBodyHtml(inp.rows))}
  ${page("Ödeme Listesi · " + inp.projectName, paymentOwnersBodyHtml(inp.groups), true)}
  <div class="foot">${esc(inp.firmName)} · Belge No: ${docId} · ${esc(inp.userEmail)}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;
}
