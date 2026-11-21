import "server-only";
import PizZip from "pizzip";
import type { DorGroup } from "@/lib/ges-defaults";

/**
 * Projenin DoR'u (Sorumluluk Matrisi) → sözleşme eki olarak sade bir .docx.
 * Şablon dosyası yok; en küçük geçerli Word paketi burada üretilir (A4 yatay değil, dikey; tablo tam genişlik).
 */

const esc = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const run = (text: string, opts: { b?: boolean; sz?: number; color?: string } = {}) => {
  const rpr = [
    `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>`,
    opts.b ? "<w:b/>" : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
    `<w:sz w:val="${opts.sz ?? 18}"/>`,
  ].join("");
  // satır sonlarını koru
  return text
    .split(/\r?\n/)
    .map((line, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`)
    .join("");
};

const para = (content: string, opts: { align?: "center" | "left"; after?: number; before?: number } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 0}"/>${opts.align ? `<w:jc w:val="${opts.align}"/>` : ""}</w:pPr>${content}</w:p>`;

const cell = (content: string, width: number, opts: { fill?: string; span?: number; align?: "center" | "left" } = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${opts.span ? `<w:gridSpan w:val="${opts.span}"/>` : ""}${opts.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${para(content, { align: opts.align })}</w:tc>`;

// Sütun genişlikleri (twip) — toplam ≈ 9638 (A4, 2 cm kenar boşluğu)
const W = { kod: 700, madde: 3638, ted: 1150, mon: 1150, dev: 1150, not: 1850 };
const TOTAL = Object.values(W).reduce((a, b) => a + b, 0);

export function buildDorDocx(opts: { groups: DorGroup[]; ek: string; projectName: string }): Buffer {
  const { groups, ek, projectName } = opts;
  const header = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${[
    cell(run("Kod", { b: true }), W.kod, { fill: "E7EAEE", align: "center" }),
    cell(run("Madde", { b: true }), W.madde, { fill: "E7EAEE" }),
    cell(run("Tedarik", { b: true }), W.ted, { fill: "E7EAEE", align: "center" }),
    cell(run("Montaj", { b: true }), W.mon, { fill: "E7EAEE", align: "center" }),
    cell(run("Devreye Alma", { b: true }), W.dev, { fill: "E7EAEE", align: "center" }),
    cell(run("Notlar", { b: true }), W.not, { fill: "E7EAEE" }),
  ].join("")}</w:tr>`;

  // Editördeki gibi: grup adı ve madde başındaki eski numaralar kırpılır (kod sütunu zaten gösterir)
  const gName = (n: string) => n.replace(/^\s*\d+\s*[—\-.:]\s*/, "").trim() || n;
  const iDesc = (d: string) => d.replace(/^\s*\d+(\.\d+)+\s+/, "").trim() || d;
  const rows = groups
    .filter((g) => g.items.length > 0)
    .map((g, gi) => {
      const groupRow = `<w:tr>${cell(run(String(gi + 1), { b: true }), W.kod, { fill: "F2F4F6", align: "center" })}${cell(run(gName(g.name), { b: true }), TOTAL - W.kod, { fill: "F2F4F6", span: 5 })}</w:tr>`;
      const itemRows = g.items
        .map(
          (it, ii) =>
            `<w:tr>${[
              cell(run(`${gi + 1}.${ii + 1}`), W.kod, { align: "center" }),
              cell(run(iDesc(it.description)), W.madde),
              cell(run(it.tedarik), W.ted, { align: "center" }),
              cell(run(it.montaj), W.mon, { align: "center" }),
              cell(run(it.devreAma), W.dev, { align: "center" }),
              cell(run(it.notes || ""), W.not),
            ].join("")}</w:tr>`,
        )
        .join("");
      return groupRow + itemRows;
    })
    .join("");

  const border = (n: string) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="B8BFC8"/>`;
  const table = `<w:tbl><w:tblPr><w:tblW w:w="${TOTAL}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Object.values(W).map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${header}${rows}</w:tbl>`;

  const body = [
    para(run(`${ek} — SORUMLULUK MATRİSİ (DoR)`, { b: true, sz: 26 }), { align: "center", after: 80 }),
    para(run(projectName, { sz: 20, color: "444444" }), { align: "center", after: 200 }),
    para(
      run(
        "Bu ek, taraflar arasındaki tedarik, montaj ve devreye alma sorumluluklarının dağılımını gösterir ve sözleşmenin ayrılmaz parçasıdır.",
        { sz: 18 },
      ),
      { after: 160 },
    ),
    table,
    para(run("Yüklenici: Yüklenici sorumluluğunda · İşveren: İşveren sorumluluğunda · Paylaşımlı: birlikte · —: kapsam dışı", { sz: 16, color: "555555" }), { before: 160 }),
  ].join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
