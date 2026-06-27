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
  lineUnitSaleTRY,
  lineTotalSaleTRY,
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
  const accent = brand.primary;
  const accentLight = brand.primaryLight + "22";
  const docId = generateDocId();
  const rates = { usd: meta.usd, eur: meta.eur };
  const totals = computeQuoteTotals(items, meta);

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
        ? `<tr><td colspan="6" style="background:${accentLight};color:${accent};font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;padding:6px 10px">${QUOTE_ITEM_KIND_LABELS[g.kind]}</td></tr>`
        : "";
      const rows = g.rows
        .map((it) => {
          rowNo += 1;
          const unitSale = lineUnitSaleTRY(it, rates);
          const lineTotal = lineTotalSaleTRY(it, rates);
          return `<tr>
            <td class="num dim">${rowNo}</td>
            <td>${esc(it.name || it.code)}${it.code ? `<span class="code"> · ${esc(it.code)}</span>` : ""}</td>
            <td class="num">${fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} ${esc(it.unit)}</td>
            <td class="num">₺${fmt(unitSale, 2)}</td>
            <td class="num strong">₺${fmt(lineTotal)}</td>
          </tr>`;
        })
        .join("");
      return header + rows;
    })
    .join("");

  const contactLine = [customer.email, customer.phone].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>${esc(quoteTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Segoe UI',Arial,sans-serif; color:#0f172a; margin:0; font-size:12px; }
  .hero { background:${accent}; color:#fff; padding:18px 22px; border-radius:10px; position:relative; z-index:1; }
  .hero h1 { margin:6px 0 0; font-size:18px; letter-spacing:-0.01em; }
  .meta { display:flex; justify-content:space-between; gap:16px; margin-top:16px; }
  .card { border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; font-size:11.5px; flex:1; }
  .card .lbl { font-size:9px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-top:18px; }
  thead th { background:#f1f5f9; text-align:left; font-size:9.5px; text-transform:uppercase; letter-spacing:0.04em; color:#475569; padding:8px 10px; border-bottom:2px solid ${accent}; }
  tbody td { padding:7px 10px; border-bottom:1px solid #eef2f7; font-size:11.5px; vertical-align:top; }
  .num { text-align:right; white-space:nowrap; }
  .dim { color:#94a3b8; }
  .strong { font-weight:700; }
  .code { color:#94a3b8; font-size:10px; }
  .totals { margin-top:16px; margin-left:auto; width:48%; }
  .totals .row { display:flex; justify-content:space-between; padding:5px 10px; font-size:12px; }
  .totals .grand { background:${accentLight}; color:${accent}; font-weight:800; font-size:14px; border-radius:6px; margin-top:4px; }
  .note { margin-top:14px; font-size:10px; color:#64748b; }
</style></head>
<body>
  ${watermarkHtml(brand, firmName)}
  <div class="hero">
    ${brandRowHtml(brand, firmName)}
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85;font-weight:700">Teklif</div>
    <h1>${esc(quoteTitle)}</h1>
  </div>

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
      <th style="width:28px">#</th>
      <th>Açıklama</th>
      <th style="text-align:right;width:90px">Miktar</th>
      <th style="text-align:right;width:100px">Birim Fiyat</th>
      <th style="text-align:right;width:110px">Tutar</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Ara Toplam</span><span>₺${fmt(totals.subtotal)}</span></div>
    <div class="row"><span>KDV (%${fmt(meta.kdvRate)})</span><span>₺${fmt(totals.kdv)}</span></div>
    <div class="row grand"><span>GENEL TOPLAM</span><span>₺${fmt(totals.grandTotal)}</span></div>
  </div>

  ${meta.notes ? `<div class="note"><strong>Not:</strong> ${esc(meta.notes)}</div>` : ""}
  <div class="note">Fiyatlara KDV ${meta.kdvRate > 0 ? "dahil edilmiştir (ayrı satırda gösterilmiştir)" : "uygulanmamıştır"}. Tutarlar Türk Lirası (₺) cinsindendir.</div>

  ${brandFooterHtml(brand, firmName, userEmail, docId)}
</body></html>`;
}
