import type { DorGroup } from "@/lib/ges-defaults";
import {
  generateDocId,
  brandRowHtml,
  brandFooterHtml,
  watermarkHtml,
  type BrandContext,
} from "@/lib/pdf-brand";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripLeadingNumber(name: string): string {
  return name.replace(/^\s*\d+\s*[—\-.:]\s*/, "").trim() || name;
}

function respClass(v: string): string {
  return v === "Yüklenici" ? "tag-y" : v === "İşveren" ? "tag-i" : v === "Paylaşımlı" ? "tag-p" : "tag-n";
}

interface BuildDorHtmlArgs {
  projectName: string;
  groups: DorGroup[];
  brand: BrandContext;
  firmName: string;
  userEmail: string;
}

/**
 * DoR (Division of Responsibilities) icin yazdirilabilir HTML.
 */
export function buildDorPrintHtml({
  projectName,
  groups,
  brand,
  firmName,
  userEmail,
}: BuildDorHtmlArgs): string {
  const docId = generateDocId();

  const groupsHtml = groups
    .map((g, gi) => {
      const rows = g.items
        .map(
          (it, idx) => `<tr class="${idx % 2 ? "alt" : ""}">
              <td class="num-cell">${gi + 1}.${idx + 1}</td>
              <td>${escapeHtml(it.description)}</td>
              <td class="ctr"><span class="tag ${respClass(it.tedarik)}">${escapeHtml(it.tedarik)}</span></td>
              <td class="ctr"><span class="tag ${respClass(it.montaj)}">${escapeHtml(it.montaj)}</span></td>
              <td class="ctr"><span class="tag ${respClass(it.devreAma)}">${escapeHtml(it.devreAma)}</span></td>
              <td class="note">${escapeHtml(it.notes || "")}</td>
            </tr>`,
        )
        .join("");
      return `<tr class="grp"><td colspan="6">${gi + 1} — ${escapeHtml(stripLeadingNumber(g.name))}</td></tr>${rows}`;
    })
    .join("");
  const totalCount = groups.reduce((s, g) => s + g.items.length, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DoR — ${escapeHtml(projectName)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a}
      @page{size:A4;margin:14mm}
      .header{background:${brand.coverGradient};color:#fff;padding:22px 24px 18px;display:flex;justify-content:space-between;align-items:flex-end;border-radius:0 0 12px 12px;margin-bottom:6px;position:relative;z-index:2}
      .header .badge{display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
      .header h1{font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.02em}
      .header .sub{font-size:10.5px;color:rgba(255,255,255,0.78);margin-top:5px;font-weight:500}
      .header .stats{text-align:right}
      .header .stats .label{font-size:8.5px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:4px}
      .header .stats .count{font-size:24px;font-weight:900;color:#fff;line-height:1}
      .header .stats .alt{font-size:10px;color:rgba(255,255,255,0.95);font-weight:600;margin-top:4px}
      .accent-bar{height:3px;background:${brand.accentGradient};margin-bottom:16px}
      .legend{display:flex;gap:8px;padding:0 22px 14px;flex-wrap:wrap}
      .legend .tag{font-size:9px;font-weight:700}
      .content{padding:0 22px 22px}
      table{width:100%;border-collapse:collapse;font-size:9.5px}
      th{background:#1e293b;color:#fff;padding:7px 9px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
      td{padding:5px 9px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      tr.alt td{background:#fafbfc}
      tr.grp td{background:#f8fafc;border-top:2px solid ${brand.primary};padding:7px 9px;font-weight:800;color:${brand.primaryDark};font-size:10.5px;letter-spacing:-0.01em}
      .num-cell{color:#475569;font-family:"Courier New",monospace;font-size:8.5px;font-weight:700;width:42px;text-align:center}
      .ctr{text-align:center;width:88px}
      .note{color:#64748b;font-size:9px}
      .tag{display:inline-block;padding:2px 7px;border-radius:99px;font-size:8.5px;font-weight:700;letter-spacing:0.02em;border:1px solid}
      .tag-y{background:#ecfdf5;color:#047857;border-color:#34d399}
      .tag-i{background:#eff6ff;color:#1d4ed8;border-color:#93c5fd}
      .tag-p{background:#fffbeb;color:#92400e;border-color:#fcd34d}
      .tag-n{background:#f1f5f9;color:#94a3b8;border-color:#cbd5e1}
      .footer{margin-top:14px;padding:10px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    ${watermarkHtml(brand, firmName)}
    <div class="header">
      <div>
        ${brandRowHtml(brand, firmName)}
        <span class="badge">Division of Responsibilities</span>
        <h1>${escapeHtml(projectName)}</h1>
        <div class="sub">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}</div>
      </div>
      <div class="stats">
        <div class="label">Toplam Madde</div>
        <div class="count">${totalCount}</div>
        <div class="alt">${groups.length} ana başlık</div>
      </div>
    </div>
    <div class="accent-bar"></div>
    <div class="legend">
      <span class="tag tag-y">Yüklenici</span>
      <span class="tag tag-i">İşveren</span>
      <span class="tag tag-p">Paylaşımlı</span>
      <span class="tag tag-n">—</span>
    </div>
    <div class="content">
      <table>
        <thead><tr>
          <th style="width:42px;text-align:center">Kod</th>
          <th>Madde</th>
          <th class="ctr">Tedarik</th>
          <th class="ctr">Montaj</th>
          <th class="ctr">Devreye Alma</th>
          <th>Notlar</th>
        </tr></thead>
        <tbody>${groupsHtml}</tbody>
      </table>
    </div>
    ${brandFooterHtml(brand, firmName, userEmail, docId)}
    </body></html>`;
}
