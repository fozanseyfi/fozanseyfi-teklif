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
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Toplantı Notu — ${esc(n.company || "")}</title><style>
@page{margin:14mm 15mm}*{box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1f2937;font-size:12px;line-height:1.55;margin:0;padding:6px}
.head{display:flex;align-items:center;gap:12px;border-bottom:3px solid ${accent};padding-bottom:10px}
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
@media print{body{padding:0}}
</style></head><body onload="setTimeout(()=>window.print(),250)">
<div class="head">${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}">` : ""}<span class="firm">${esc(brand.firm)}</span><span class="r"><span class="tag">TOPLANTI NOTU</span><br>Not No: ${esc(n.id.slice(-6).toUpperCase())} · ${fmtDate(n.date)}</span></div>
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
<div class="foot"><div>${esc(brand.firm)} · Not Defteri · ${fmtDate(todayISO())}</div>
<div style="display:flex;gap:26px"><div class="sig"><div class="l"></div>Hazırlayan${n.recorder ? ": " + esc(n.recorder) : ""}</div><div class="sig"><div class="l"></div>Katılımcı Onayı</div></div></div>
</body></html>`;
}

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
