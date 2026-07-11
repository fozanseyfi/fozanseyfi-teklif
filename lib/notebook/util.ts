import { nbType, topicDecisions, type NbNote } from "./types";

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const isOver = (iso?: string) => !!iso && iso < todayISO();
export const fmtDate = (iso?: string) =>
  iso ? new Date(iso + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";
export const fmtShort = (iso?: string) =>
  iso ? new Date(iso + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
export const monthLabel = (iso: string) =>
  new Date(iso + "T00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
export function initials(name?: string): string {
  const p = (name || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toLocaleUpperCase("tr");
}
export const peopleStr = (n: NbNote) => (n.people || []).join(", ");
export const noteTags = (n: NbNote) => (n.tags || "").split(",").map((s) => s.trim()).filter(Boolean);

/** Paylaşım/kopya için düz metin tutanak. */
export function noteToText(n: NbNote): string {
  const t = nbType(n.type);
  const time = (n.startTime || "") + (n.endTime ? "–" + n.endTime : "");
  let s = `📋 TOPLANTI NOTU\n${n.title ? n.title + "\n" : ""}${"─".repeat(26)}\n`;
  s += `Firma: ${n.company || "-"}\nTarih: ${fmtDate(n.date)}${time ? " · " + time : ""} · ${t.name}`;
  if (n.location) s += ` · ${n.location}`;
  s += "\n";
  if ((n.people || []).length) s += `Karşı taraf: ${peopleStr(n)}\n`;
  if (n.ourAttendees) s += `Bizim taraf: ${n.ourAttendees}\n`;
  if ((n.topics || []).length)
    s += `\nGÖRÜŞÜLEN KONULAR:\n` + n.topics!.map((tp, i) => {
      const dec = topicDecisions(tp);
      return `${i + 1}. ${tp.subject || ""}${tp.summary ? "\n   " + tp.summary : ""}${dec.length ? "\n" + dec.map((d) => "   ➤ Karar: " + d).join("\n") : ""}`;
    }).join("\n") + "\n";
  if ((n.actions || []).length)
    s += `\nAKSİYONLAR:\n` + n.actions!.map((a) => `${a.done ? "✓" : "☐"} ${a.what}${a.who ? " — " + a.who : ""}${a.due ? " — " + fmtDate(a.due) : ""}`).join("\n") + "\n";
  if (n.note) s += `\nNOTLAR:\n${n.note}\n`;
  if (n.followUp) s += `\nTakip: ${fmtDate(n.followUp)}`;
  if (n.nextMeeting) s += `\nSonraki toplantı: ${fmtDate(n.nextMeeting)}`;
  return s.trim();
}

const esc = (s?: string) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export interface PrintBrand { firm: string; accent: string; logoUrl?: string }

/** Markalı (platform formatı) yazdırılabilir tutanak HTML'i — ayrı pencerede açılıp yazdırılır (PDF). */
export function noteToPrintHtml(n: NbNote, brand: PrintBrand): string {
  const t = nbType(n.type);
  const accent = brand.accent || "#059669";
  const time = (n.startTime || "") + (n.endTime ? " – " + n.endTime : "");
  const acts = (n.actions || []).filter((a) => a.what);
  const row = (a: string, b: string, c: string, d: string) => `<tr><td class="k">${esc(a)}</td><td>${esc(b) || "—"}</td><td class="k">${esc(c)}</td><td>${esc(d) || "—"}</td></tr>`;
  const noNo = n.id.slice(-6).toUpperCase();
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Toplantı Notu — ${esc(n.company || "")}</title><style>
@page{margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter','Segoe UI',system-ui,Arial,sans-serif;color:#111827;font-size:11px;line-height:1.55;background:#fff}
.header-bar{background:#111827;color:#fff;padding:9px 24px;font-size:10px;display:flex;justify-content:space-between;align-items:center}
.header-bar .firm{color:${accent};font-weight:700;font-size:12px;display:flex;align-items:center;gap:8px}
.header-bar .firm img{max-height:20px;max-width:90px;object-fit:contain}
.tag{display:inline-block;background:${accent};color:#fff;font-size:9px;font-weight:700;padding:2px 9px;border-radius:99px;letter-spacing:.05em}
.body{padding:24px}
h1{font-size:17px;font-weight:700;margin-bottom:4px}
.sub{color:#6B7280;font-size:10px;margin-bottom:18px}
.section-title{font-size:13px;font-weight:700;color:#111827;margin:20px 0 10px;padding-bottom:5px;border-bottom:2px solid ${accent};display:inline-block}
table.meta{width:100%;border-collapse:collapse;font-size:10.5px}
table.meta td{border:1px solid #E5E7EB;padding:6px 10px}
table.meta td.k{background:#F9FAFB;font-weight:600;width:15%;white-space:nowrap;color:#6B7280}
.topic{margin-bottom:11px}.topic b{display:block;margin-bottom:2px;color:#111827}
.topic .summary{color:#4B5563}
.dec{margin-top:5px;padding:7px 11px;background:#F9FAFB;border-left:3px solid ${accent};border-radius:0 6px 6px 0}
table.acts{width:100%;border-collapse:collapse;font-size:10.5px}
table.acts th{background:#1F2937;color:#fff;text-align:left;padding:7px 10px;font-weight:600;font-size:9.5px}
table.acts td{padding:6px 10px;border-bottom:1px solid #F3F4F6;vertical-align:top}
table.acts tr:nth-child(even) td{background:#F9FAFB}
.free{white-space:pre-wrap;color:#374151;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px}
.photos{display:flex;flex-wrap:wrap;gap:8px}.photos img{max-width:47%;max-height:220px;border:1px solid #E5E7EB;border-radius:8px;object-fit:cover}
.sigs{display:flex;gap:20px;margin-top:26px}
.signature-box{flex:1;border:1px solid #D1D5DB;border-radius:8px;padding:14px;min-height:110px}
.signature-title{font-size:10px;font-weight:700;color:#374151;margin-bottom:4px}
.signature-sub{font-size:9px;color:#9CA3AF}
.signature-line{margin-top:52px;border-top:1px solid #D1D5DB;padding-top:6px;font-size:9px;color:#9CA3AF}
.footer-bar{background:#F9FAFB;border-top:1px solid #E5E7EB;padding:7px 24px;font-size:9px;color:#9CA3AF;display:flex;justify-content:space-between;margin-top:26px}
@media print{.header-bar{-webkit-print-color-adjust:exact;print-color-adjust:exact}table.acts th,.tag,.header-bar .firm{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body onload="setTimeout(()=>window.print(),250)">
<div class="header-bar"><span class="firm">${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}">` : ""}${esc(brand.firm)}</span><span><span class="tag">TOPLANTI NOTU</span> &nbsp;No: ${esc(noNo)} · ${fmtDate(n.date)}</span></div>
<div class="body">
<h1>${esc(n.title || n.company || "Toplantı Notu")}</h1>
<div class="sub">${t.name}${n.location ? " · " + esc(n.location) : ""}</div>
<table class="meta"><tbody>
${row("Firma / Kurum", n.company || "", "Tür", t.name)}
${row("Tarih / Saat", fmtDate(n.date) + (time ? " · " + time : ""), "Konum", n.location || "")}
${row("Karşı Taraf", peopleStr(n), "Bizim Taraf", n.ourAttendees || "")}
${row("Hazırlayan", n.recorder || "", "Sonraki Toplantı", n.nextMeeting ? fmtDate(n.nextMeeting) : "")}
</tbody></table>
${(n.topics || []).length ? `<div class="section-title">Görüşülen Konular ve Kararlar</div>${n.topics!.map((tp, i) => { const dec = topicDecisions(tp); return `<div class="topic">${tp.subject ? `<b>${i + 1}. ${esc(tp.subject)}</b>` : ""}${tp.summary ? `<div class="summary">${esc(tp.summary)}</div>` : ""}${dec.map((d) => `<div class="dec"><b>Karar:</b> ${esc(d)}</div>`).join("")}</div>`; }).join("")}` : ""}
${acts.length ? `<div class="section-title">Aksiyon Planı</div><table class="acts"><thead><tr><th style="width:24px">#</th><th>Aksiyon</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead><tbody>${acts.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.what)}</td><td>${esc(a.who || "—")}</td><td>${a.due ? fmtDate(a.due) : "—"}</td><td>${a.done ? "Tamamlandı" : "Açık"}</td></tr>`).join("")}</tbody></table>` : ""}
${n.note ? `<div class="section-title">Notlar</div><div class="free">${esc(n.note)}</div>` : ""}
${(n.photos || []).length ? `<div class="section-title">Fotoğraflar</div><div class="photos">${n.photos!.map((u) => `<img src="${esc(u)}">`).join("")}</div>` : ""}
${n.tags ? `<div class="section-title">Etiketler</div><div>${esc(n.tags)}</div>` : ""}
<div class="sigs">
  <div class="signature-box"><div class="signature-title">Hazırlayan</div><div class="signature-sub">${n.recorder ? esc(n.recorder) : esc(brand.firm)}</div><div class="signature-line">İmza</div></div>
  <div class="signature-box"><div class="signature-title">Kullanıcı Onayı</div><div class="signature-sub">Katılımcı / Yetkili</div><div class="signature-line">İmza & Kaşe</div></div>
</div>
</div>
<div class="footer-bar"><span>${esc(brand.firm)} · Not Defteri</span><span>${fmtDate(todayISO())}</span></div>
</body></html>`;
}

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
