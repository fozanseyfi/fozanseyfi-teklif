import {
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandContext,
} from "@/lib/pdf-brand";
import {
  type QuoteItem,
  type QuoteMeta,
  type QuoteItemKindT,
  type QuoteOutputCurrency,
  lineUnitSaleOut,
  lineTotalSaleOut,
  computeQuoteTotals,
  QUOTE_ITEM_KIND_LABELS,
} from "@/lib/quote";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface BuildQuoteHtmlArgs {
  quoteTitle: string;
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    location?: string | null;
  };
  items: QuoteItem[];
  meta: QuoteMeta;
  brand: BrandContext;
  firmName: string;
  userEmail: string;
}

export function buildQuotePrintHtml({
  quoteTitle,
  customer,
  items,
  meta,
  brand,
  firmName,
  userEmail,
}: BuildQuoteHtmlArgs): string {
  // Diğer PDF'lerle aynı standart başlık: koyu slate gradyan + renkli accent bar.
  const accent = brand.primary;
  const accentLight = brand.primaryLight + "22";
  const docId = generateDocId();
  const out: QuoteOutputCurrency = meta.outputCurrency || "TRY";
  const rates = { usd: meta.usd, eur: meta.eur };
  const totals = computeQuoteTotals(items, meta);
  const sym = totals.symbol;

  const dateStr = meta.quoteDate
    ? new Date(meta.quoteDate).toLocaleDateString("tr-TR")
    : new Date().toLocaleDateString("tr-TR");

  const groups: { kind: QuoteItemKindT; rows: QuoteItem[] }[] = (
    [
      { kind: "MALZEME", rows: items.filter((i) => i.kind === "MALZEME") },
      { kind: "HIZMET", rows: items.filter((i) => i.kind === "HIZMET") },
    ] as { kind: QuoteItemKindT; rows: QuoteItem[] }[]
  ).filter((g) => g.rows.length > 0);
  const showGroupHeaders = groups.length > 1;
  let rowNo = 0;

  const bodyRows = groups
    .map((g) => {
      const header = showGroupHeaders
        ? `<tr><td colspan="5" class="grp">${QUOTE_ITEM_KIND_LABELS[g.kind]}</td></tr>`
        : "";
      const rows = g.rows
        .map((it) => {
          rowNo += 1;
          const desc = it.desc ? `<div class="desc">${esc(it.desc)}</div>` : "";
          return `<tr>
            <td class="num dim">${rowNo}</td>
            <td><strong>${esc(it.name || it.code)}</strong>${it.code ? `<span class="code"> · ${esc(it.code)}</span>` : ""}${desc}</td>
            <td class="num">${fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} ${esc(it.unit)}</td>
            <td class="num">${sym}${fmt(lineUnitSaleOut(it, out, rates), 2)}</td>
            <td class="num strong">${sym}${fmt(lineTotalSaleOut(it, out, rates))}</td>
          </tr>`;
        })
        .join("");
      return header + rows;
    })
    .join("");

  const contactLine = [customer.email, customer.phone].filter(Boolean).join(" · ");

  // Ödeme şekli — yalnız işaretli (show) satırlar.
  const pts = (meta.paymentTerms ?? []).filter((p) => p.show && p.text.trim());
  const paymentTermsHtml = pts.length
    ? `<div class="block"><div class="blk-ttl">Ödeme Şekli</div><ul>${pts.map((p) => `<li>${esc(p.text)}</li>`).join("")}</ul></div>`
    : "";

  // Teklif notları — her satır ayrı madde.
  const noteLines = (meta.notes ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const notesHtml = noteLines.length
    ? `<div class="block"><div class="blk-ttl">Notlar</div><ol>${noteLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${esc(quoteTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Segoe UI',Arial,sans-serif; color:#0f172a; margin:0; font-size:12px; }
  .header { background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color:#fff; padding:16px 20px 14px; display:flex; justify-content:space-between; align-items:flex-end; position:relative; z-index:2; }
  .header h1 { font-size:17px; font-weight:700; letter-spacing:-0.02em; color:#fff; margin:6px 0 0; }
  .header .sub { font-size:9px; color:rgba(255,255,255,0.55); margin-top:3px; }
  .total-badge { text-align:right; }
  .total-badge .label { font-size:8px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px; }
  .total-badge .amount { font-size:22px; font-weight:800; color:${accent}; letter-spacing:-0.02em; }
  .accent-bar { height:3px; background:linear-gradient(90deg, ${accent}, ${brand.primaryLight}, transparent); }
  .content { padding:16px 20px; position:relative; z-index:2; }
  .meta { display:flex; justify-content:space-between; gap:16px; }
  .card { border:1px solid #e2e8f0; border-radius:8px; padding:11px 13px; font-size:11.5px; flex:1; }
  .card .lbl { font-size:9px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  thead th { background:#1e293b; color:#fff; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.04em; padding:7px 9px; }
  tbody td { padding:7px 9px; border-bottom:1px solid #eef2f7; font-size:11.5px; vertical-align:top; }
  .num { text-align:right; white-space:nowrap; }
  .dim { color:#94a3b8; }
  .strong { font-weight:700; }
  .code { color:#94a3b8; font-size:10px; }
  .desc { color:#64748b; font-size:10px; margin-top:2px; }
  .grp { background:${accentLight}; color:${accent}; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; padding:5px 9px; }
  .totals { margin-top:14px; margin-left:auto; width:48%; }
  .totals .row { display:flex; justify-content:space-between; padding:4px 9px; font-size:12px; }
  .totals .grand { background:${accentLight}; color:${accent}; font-weight:800; font-size:14px; border-radius:6px; margin-top:4px; }
  .note { margin-top:14px; font-size:10px; color:#64748b; }
  .block { margin-top:14px; page-break-inside:avoid; break-inside:avoid; }
  .blk-ttl { font-size:11px; font-weight:700; color:#334155; margin-bottom:4px; }
  .block ul, .block ol { margin:0; padding-left:20px; }
  .block li { font-size:11px; color:#475569; margin:2px 0; white-space:pre-line; }
  .approve { margin-top:26px; border:1.5px dashed #cbd5e1; border-radius:8px; padding:14px 16px; page-break-inside:avoid; break-inside:avoid; }
  .approve .ttl { font-size:11px; font-weight:700; color:#334155; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
  .approve .box { width:14px; height:14px; border:1.5px solid #475569; border-radius:3px; display:inline-block; }
  .approve .lines { display:flex; gap:24px; margin-top:14px; font-size:10px; color:#64748b; }
  .approve .lines > div { flex:1; }
  .approve .sig { margin-top:22px; border-top:1px solid #94a3b8; padding-top:3px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body>
  ${watermarkHtml(brand, firmName)}
  <div class="header">
    <div>
      ${brandRowHtml(brand, firmName)}
      <h1>${esc(quoteTitle)}</h1>
      <div class="sub">${dateStr} · ${items.length} kalem · Teklif para birimi: ${out === "TRY" ? "TL" : out}</div>
    </div>
    <div class="total-badge">
      <div class="label">Genel Toplam</div>
      <div class="amount">${sym}${fmt(totals.grandTotal)}</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <div class="content">
    <div class="meta">
      <div class="card">
        <div class="lbl">Müşteri</div>
        <div style="font-weight:700;margin-top:3px">${esc(customer.name || "—")}</div>
        ${contactLine ? `<div style="color:#475569;margin-top:2px">${esc(contactLine)}</div>` : ""}
        ${customer.address ? `<div style="color:#64748b;margin-top:2px">${esc(customer.address)}</div>` : ""}
        ${customer.location ? `<div style="color:#64748b;margin-top:2px">${esc(customer.location)}</div>` : ""}
      </div>
      <div class="card" style="max-width:200px">
        <div class="lbl">Teklif Bilgisi</div>
        ${meta.quoteNo ? `<div style="margin-top:3px"><span class="dim">No:</span> ${esc(meta.quoteNo)}</div>` : ""}
        <div style="margin-top:2px"><span class="dim">Tarih:</span> ${dateStr}</div>
        ${meta.validityDays ? `<div style="margin-top:2px"><span class="dim">Geçerlilik:</span> ${meta.validityDays} gün</div>` : ""}
      </div>
    </div>

    <table>
      <thead><tr>
        <th style="width:26px">#</th>
        <th>Açıklama</th>
        <th style="text-align:right;width:80px">Miktar</th>
        <th style="text-align:right;width:100px">Birim Fiyat</th>
        <th style="text-align:right;width:110px">Tutar</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Ara Toplam</span><span>${sym}${fmt(totals.subtotal)}</span></div>
      <div class="row"><span>KDV (%${fmt(meta.kdvRate)})</span><span>${sym}${fmt(totals.kdv)}</span></div>
      <div class="row grand"><span>GENEL TOPLAM</span><span>${sym}${fmt(totals.grandTotal)}</span></div>
    </div>

    ${paymentTermsHtml}
    ${notesHtml}

    <div class="approve">
      <div class="ttl"><span class="box"></span> Bu teklifi okudum, kabul ediyorum.</div>
      <div class="lines">
        <div>Ad Soyad / Unvan<div class="sig">&nbsp;</div></div>
        <div>Tarih<div class="sig">&nbsp;</div></div>
        <div>İmza / Kaşe<div class="sig">&nbsp;</div></div>
      </div>
    </div>
  </div>

  ${brandFooterHtml(brand, firmName, userEmail, docId)}
  <script>
    // Logo/görseller yüklendikten sonra yazdır (logo eksik çıkmasın).
    window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 200); });
  </script>
</body></html>`;
}
