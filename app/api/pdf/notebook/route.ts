import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBrandSettings } from "@/lib/pdf-brand";
import { nbType, topicDecisions, type NbNote } from "@/lib/notebook/types";
import { fmtDate, peopleStr, todayISO } from "@/lib/notebook/util";

export const runtime = "nodejs";

const esc = (s?: string) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function buildHtml(n: NbNote, firm: string, accent: string, logoUrl?: string): string {
  const t = nbType(n.type);
  const time = (n.startTime || "") + (n.endTime ? " – " + n.endTime : "");
  const acts = (n.actions || []).filter((a) => a.what);
  const row = (a: string, b: string, c: string, d: string) =>
    `<tr><td class="k">${esc(a)}</td><td>${esc(b) || "—"}</td><td class="k">${esc(c)}</td><td>${esc(d) || "—"}</td></tr>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@page{margin:14mm 15mm}*{box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1f2937;font-size:12px;line-height:1.55;margin:0}
.head{display:flex;align-items:center;gap:12px;border-bottom:3px solid ${accent};padding-bottom:10px;margin-bottom:6px}
.head img{max-height:34px;max-width:150px;object-fit:contain}
.head .firm{font-size:15px;font-weight:800;color:#111827}
.head .r{margin-left:auto;text-align:right;font-size:10.5px;color:#6b7280}
.tag{display:inline-block;background:${accent};color:#fff;font-size:10px;font-weight:700;padding:2px 9px;border-radius:99px;letter-spacing:.04em}
h1{font-size:16px;margin:12px 0 10px}
table.meta{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11.5px}
table.meta td{border:1px solid #e5e7eb;padding:5px 9px}
table.meta td.k{background:#f8fafc;font-weight:600;width:15%;white-space:nowrap;color:#475569}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:${accent};margin:16px 0 6px;border-bottom:1px solid #eef0f2;padding-bottom:3px}
.topic{margin-bottom:10px}.topic b{display:block;margin-bottom:2px}
.dec{margin-top:4px;padding:6px 10px;background:#f0f9f4;border-left:3px solid ${accent};border-radius:0 6px 6px 0}
table.acts{width:100%;border-collapse:collapse;font-size:11.5px}
table.acts th{background:#f1f5f9;text-align:left;padding:6px 9px;border:1px solid #e5e7eb;font-size:10px;text-transform:uppercase;color:#475569}
table.acts td{border:1px solid #e5e7eb;padding:6px 9px;vertical-align:top}
.free{white-space:pre-wrap}
.photos{display:flex;flex-wrap:wrap;gap:8px}.photos img{max-width:47%;max-height:220px;border:1px solid #e5e7eb;border-radius:8px;object-fit:cover}
.foot{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;color:#94a3b8;font-size:10px}
.sig{text-align:center;color:#475569}.sig .l{width:170px;border-bottom:1px solid #9ca3af;height:34px;margin-bottom:4px}
</style></head><body>
<div class="head">${logoUrl ? `<img src="${esc(logoUrl)}">` : ""}<span class="firm">${esc(firm)}</span><span class="r"><span class="tag">TOPLANTI NOTU</span><br>Not No: ${esc(n.id.slice(-6).toUpperCase())} · ${fmtDate(n.date)}</span></div>
${n.title ? `<h1>${esc(n.title)}</h1>` : ""}
<table class="meta"><tbody>
${row("Firma / Kurum", n.company || "", "Tür", t.name)}
${row("Tarih / Saat", fmtDate(n.date) + (time ? " · " + time : ""), "Konum", n.location || "")}
${row("Karşı Taraf", peopleStr(n), "Bizim Taraf", n.ourAttendees || "")}
${row("Hazırlayan", n.recorder || "", "Sonraki Toplantı", n.nextMeeting ? fmtDate(n.nextMeeting) : "")}
</tbody></table>
${(n.topics || []).length ? `<h2>Görüşülen Konular ve Kararlar</h2>${n.topics!.map((tp, i) => { const dec = topicDecisions(tp); return `<div class="topic">${tp.subject ? `<b>${i + 1}. ${esc(tp.subject)}</b>` : ""}${tp.summary ? `<div>${esc(tp.summary)}</div>` : ""}${dec.map((d) => `<div class="dec"><b>Karar:</b> ${esc(d)}</div>`).join("")}</div>`; }).join("")}` : ""}
${acts.length ? `<h2>Aksiyon Planı</h2><table class="acts"><thead><tr><th style="width:24px">#</th><th>Aksiyon</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead><tbody>${acts.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.what)}</td><td>${esc(a.who || "—")}</td><td>${a.due ? fmtDate(a.due) : "—"}</td><td>${a.done ? "Tamamlandı" : "Açık"}</td></tr>`).join("")}</tbody></table>` : ""}
${n.note ? `<h2>Notlar</h2><div class="free">${esc(n.note)}</div>` : ""}
${(n.photos || []).length ? `<h2>Fotoğraflar</h2><div class="photos">${n.photos!.map((u) => `<img src="${esc(u)}">`).join("")}</div>` : ""}
${n.tags ? `<h2>Etiketler</h2><div>${esc(n.tags)}</div>` : ""}
<div class="foot"><div>${esc(firm)} · Not Defteri · ${fmtDate(todayISO())}</div>
<div style="display:flex;gap:26px"><div class="sig"><div class="l"></div>Hazırlayan${n.recorder ? ": " + esc(n.recorder) : ""}</div><div class="sig"><div class="l"></div>Katılımcı Onayı</div></div></div>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { note?: NbNote };
  const note = body.note;
  if (!note || !note.id) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: session.organizationId } });
  const brand = parseBrandSettings(org?.brandSettings);
  const firm = brand.payCompanyName || org?.name || "Firma";
  const accent = brand.colorEnabled && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brand.color || "") ? (brand.color as string) : "#059669";
  const logo = brand.logoEnabled && brand.logoUrl ? brand.logoUrl : undefined;

  const html = buildHtml(note, firm, accent, logo);
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "14mm", bottom: "12mm", left: "15mm", right: "15mm" } });
    await browser.close();
    const name = (note.company || "toplanti-notu").replace(/[^\w.-]+/g, "_").slice(0, 40);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Not-${name}.pdf"` },
    });
  } catch (err) {
    console.error("Notebook PDF error:", err);
    return NextResponse.json({ error: "PDF oluşturulamadı" }, { status: 500 });
  }
}
