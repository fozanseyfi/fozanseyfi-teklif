import { nbType, type NbNote } from "./types";

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
  if ((n.agenda || []).length) s += `\nGÜNDEM:\n` + n.agenda!.map((a, i) => `${i + 1}. ${a}`).join("\n") + "\n";
  if ((n.topics || []).length)
    s += `\nGÖRÜŞÜLEN KONULAR:\n` + n.topics!.map((tp, i) => `${i + 1}. ${tp.subject || ""}${tp.summary ? "\n   " + tp.summary : ""}${tp.decision ? "\n   ➤ Karar: " + tp.decision : ""}`).join("\n") + "\n";
  if ((n.actions || []).length)
    s += `\nAKSİYONLAR:\n` + n.actions!.map((a) => `${a.done ? "✓" : "☐"} ${a.what}${a.who ? " — " + a.who : ""}${a.due ? " — " + fmtDate(a.due) : ""}`).join("\n") + "\n";
  if (n.note) s += `\nNOTLAR:\n${n.note}\n`;
  if (n.followUp) s += `\nTakip: ${fmtDate(n.followUp)}`;
  if (n.nextMeeting) s += `\nSonraki toplantı: ${fmtDate(n.nextMeeting)}`;
  return s.trim();
}

const esc = (s?: string) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Yazdırılabilir (PDF) tutanak HTML'i — ayrı pencerede açılır. */
export function noteToPrintHtml(n: NbNote, firmName: string): string {
  const t = nbType(n.type);
  const time = (n.startTime || "") + (n.endTime ? " – " + n.endTime : "");
  const rows = (cells: [string, string][]) =>
    cells.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v) || "—"}</td></tr>`).join("");
  const acts = (n.actions || []).filter((a) => a.what);
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>Toplantı Notu — ${esc(n.company || "")}</title>
<style>
@page{margin:16mm 15mm}
*{box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a1a1a;font-size:12.5px;line-height:1.55;margin:0}
.brand{display:flex;align-items:center;border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:14px}
.brand .t{font-size:19px;font-weight:800;letter-spacing:-.01em}
.brand .n{margin-left:auto;text-align:right;font-size:11px;color:#666}
h1{font-size:17px;margin:0 0 10px}
table.meta{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px}
table.meta td{border:1px solid #e2e0da;padding:5px 9px}
table.meta td.k{background:#f5f4f1;font-weight:600;width:16%;white-space:nowrap;color:#444}
h2{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#059669;margin:16px 0 6px}
ol{margin:0 0 4px 18px}
.topic{margin-bottom:10px}
.topic b{display:block}
.dec{margin-top:4px;padding:6px 10px;background:#eaf7ef;border-left:3px solid #059669;border-radius:0 6px 6px 0}
table.acts{width:100%;border-collapse:collapse;font-size:12px}
table.acts th{background:#f1efe9;text-align:left;padding:6px 9px;border:1px solid #e2e0da;font-size:10.5px;text-transform:uppercase}
table.acts td{border:1px solid #e2e0da;padding:6px 9px;vertical-align:top}
.free{white-space:pre-wrap}
.foot{margin-top:22px;padding-top:10px;border-top:1px solid #e2e0da;display:flex;justify-content:space-between;color:#777;font-size:11px}
.sig{text-align:center}.sig .l{width:170px;border-bottom:1px solid #999;height:32px;margin-bottom:4px}
</style></head><body onload="window.print()">
<div class="brand"><span class="t">TOPLANTI NOTU</span><span class="n">${esc(firmName)}<br>Not No: ${esc(n.id.slice(-6).toUpperCase())} · ${fmtDate(n.date)}</span></div>
${n.title ? `<h1>${esc(n.title)}</h1>` : ""}
<table class="meta"><tbody>
${rows([["Firma / Kurum", n.company || ""], ["Toplantı Türü", t.name]])}
${rows([["Tarih / Saat", fmtDate(n.date) + (time ? " · " + time : "")], ["Konum", n.location || ""]])}
${rows([["Karşı Taraf", peopleStr(n)], ["Bizim Taraf", n.ourAttendees || ""]])}
${rows([["Hazırlayan", n.recorder || ""], ["Sonraki Toplantı", n.nextMeeting ? fmtDate(n.nextMeeting) : ""]])}
</tbody></table>
${(n.agenda || []).length ? `<h2>Gündem</h2><ol>${n.agenda!.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>` : ""}
${(n.topics || []).length ? `<h2>Görüşülen Konular ve Kararlar</h2>${n.topics!.map((tp, i) => `<div class="topic">${tp.subject ? `<b>${i + 1}. ${esc(tp.subject)}</b>` : ""}${tp.summary ? `<div>${esc(tp.summary)}</div>` : ""}${tp.decision ? `<div class="dec"><b>Karar:</b> ${esc(tp.decision)}</div>` : ""}</div>`).join("")}` : ""}
${acts.length ? `<h2>Aksiyon Planı</h2><table class="acts"><thead><tr><th style="width:26px">#</th><th>Aksiyon</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead><tbody>${acts.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.what)}</td><td>${esc(a.who || "—")}</td><td>${a.due ? fmtDate(a.due) : "—"}</td><td>${a.done ? "Tamamlandı" : isOver(a.due) ? "Gecikti" : "Açık"}</td></tr>`).join("")}</tbody></table>` : ""}
${(n.products || []).length ? `<h2>İlgi Alanı</h2><div>${(n.products || []).map(esc).join(", ")}</div>` : ""}
${n.note ? `<h2>Notlar</h2><div class="free">${esc(n.note)}</div>` : ""}
${n.followUp ? `<h2>Takip</h2><div>Takip tarihi: <b>${fmtDate(n.followUp)}</b>${n.followDone ? " · ✓ Yapıldı" : ""}</div>` : ""}
<div class="foot"><div>Bu not ${esc(firmName)} · Not Defteri ile hazırlanmıştır · ${fmtDate(todayISO())}</div>
<div style="display:flex;gap:28px"><div class="sig"><div class="l"></div>Hazırlayan${n.recorder ? ": " + esc(n.recorder) : ""}</div><div class="sig"><div class="l"></div>Katılımcı Onayı</div></div></div>
</body></html>`;
}

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
