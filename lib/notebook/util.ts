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

/** Teklif (malzeme/hizmet) PDF'iyle aynı başlık formatı: koyu slate gradyan + logo + accent bar. */
export interface PrintBrand { accent: string; accentLight: string; logoUrl?: string; slogan?: string }

/** Yazdırılabilir tutanak HTML'i — platformun teklif PDF formatı (ayrı pencerede açılıp yazdırılır). */
export function noteToPrintHtml(n: NbNote, brand: PrintBrand): string {
  const t = nbType(n.type);
  const accent = brand.accent || "#059669";
  const accentLight = brand.accentLight || accent + "22";
  const time = (n.startTime || "") + (n.endTime ? " – " + n.endTime : "");
  const acts = (n.actions || []).filter((a) => a.what);
  const topics = (n.topics || []).filter((tp) => tp.subject || tp.summary || topicDecisions(tp).length);
  const dateStr = new Date(n.date + "T00:00").toLocaleDateString("tr-TR");
  const logo = brand.logoUrl
    ? `<div style="display:flex;flex-direction:column;gap:1px;margin-bottom:10px"><img src="${esc(brand.logoUrl)}" alt="" style="max-height:48px;max-width:200px;object-fit:contain"/>${brand.slogan ? `<div style="font-size:9.5px;color:rgba(255,255,255,0.85);font-style:italic;margin-top:2px">${esc(brand.slogan)}</div>` : ""}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>Toplantı Notu — ${esc(n.company || dateStr)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Segoe UI',Arial,sans-serif; color:#0f172a; margin:0; font-size:12px; }
  .header { background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color:#fff; padding:16px 20px 14px; display:flex; justify-content:space-between; align-items:flex-end; }
  .header h1 { font-size:17px; font-weight:700; letter-spacing:-0.02em; color:#fff; margin:6px 0 0; }
  .header .sub { font-size:9px; color:rgba(255,255,255,0.55); margin-top:3px; }
  .total-badge { text-align:right; }
  .total-badge .label { font-size:8px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px; }
  .total-badge .amount { font-size:15px; font-weight:800; color:${accent}; letter-spacing:-0.02em; }
  .accent-bar { height:3px; background:linear-gradient(90deg, ${accent}, ${accentLight}, transparent); }
  .content { padding:16px 20px; }
  .meta { display:flex; justify-content:space-between; gap:16px; }
  .card { border:1px solid #e2e8f0; border-radius:8px; padding:11px 13px; font-size:11.5px; flex:1; }
  .card .lbl { font-size:9px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700; }
  .dim { color:#94a3b8; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  thead th { background:#1e293b; color:#fff; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.04em; padding:7px 9px; }
  tbody td { padding:7px 9px; border-bottom:1px solid #eef2f7; font-size:11.5px; vertical-align:top; }
  .block { margin-top:16px; page-break-inside:avoid; break-inside:avoid; }
  .blk-ttl { font-size:11px; font-weight:700; color:#334155; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em; border-bottom:2px solid ${accent}; display:inline-block; padding-bottom:3px; }
  .topic { margin-top:8px; }
  .topic b { display:block; color:#0f172a; }
  .topic .summary { color:#64748b; font-size:11px; margin-top:2px; white-space:pre-line; }
  .dec { margin-top:4px; padding:5px 9px; background:${accentLight}; color:#334155; border-left:3px solid ${accent}; border-radius:0 6px 6px 0; font-size:11px; }
  .dec b { color:${accent}; }
  .free { white-space:pre-line; color:#475569; font-size:11.5px; }
  .photos { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .photos img { max-width:47%; max-height:220px; border:1px solid #e2e8f0; border-radius:8px; object-fit:cover; }
  .tags span { display:inline-block; background:${accentLight}; color:${accent}; font-weight:700; font-size:10px; padding:3px 9px; border-radius:99px; margin:0 4px 4px 0; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body onload="setTimeout(()=>window.print(),250)">
  <div class="header">
    <div>
      ${logo}
      <h1>${esc(n.title || n.company || "Toplantı Notu")}</h1>
      <div class="sub">${dateStr}${time ? " · " + esc(time) : ""} · ${esc(t.name)}${n.location ? " · " + esc(n.location) : ""}</div>
    </div>
    <div class="total-badge">
      <div class="label">Toplantı Notu</div>
      <div class="amount">${dateStr}</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <div class="content">
    <div class="meta">
      <div class="card">
        <div class="lbl">Firma / Kurum</div>
        <div style="font-weight:700;margin-top:3px">${esc(n.company || "—")}</div>
        ${peopleStr(n) ? `<div style="color:#475569;margin-top:3px"><span class="dim">Karşı taraf:</span> ${esc(peopleStr(n))}</div>` : ""}
        ${n.ourAttendees ? `<div style="color:#475569;margin-top:2px"><span class="dim">Bizim taraf:</span> ${esc(n.ourAttendees)}</div>` : ""}
      </div>
      <div class="card" style="max-width:210px">
        <div class="lbl">Toplantı Bilgisi</div>
        <div style="margin-top:3px"><span class="dim">Tarih:</span> ${fmtDate(n.date)}</div>
        ${time ? `<div style="margin-top:2px"><span class="dim">Saat:</span> ${esc(time)}</div>` : ""}
        <div style="margin-top:2px"><span class="dim">Tür:</span> ${esc(t.name)}</div>
        ${n.location ? `<div style="margin-top:2px"><span class="dim">Konum:</span> ${esc(n.location)}</div>` : ""}
        ${n.nextMeeting ? `<div style="margin-top:2px"><span class="dim">Sonraki:</span> ${fmtDate(n.nextMeeting)}</div>` : ""}
      </div>
    </div>

    ${topics.length ? `<div class="block"><div class="blk-ttl">Görüşülen Konular ve Kararlar</div>${topics.map((tp, i) => { const dec = topicDecisions(tp); return `<div class="topic">${tp.subject ? `<b>${i + 1}. ${esc(tp.subject)}</b>` : ""}${tp.summary ? `<div class="summary">${esc(tp.summary)}</div>` : ""}${dec.map((d) => `<div class="dec"><b>Karar:</b> ${esc(d)}</div>`).join("")}</div>`; }).join("")}</div>` : ""}

    ${acts.length ? `<div class="block"><div class="blk-ttl">Aksiyon Planı</div><table><thead><tr><th style="width:26px">#</th><th>Aksiyon</th><th style="width:120px">Sorumlu</th><th style="width:110px">Termin</th><th style="width:90px">Durum</th></tr></thead><tbody>${acts.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.what)}</td><td>${esc(a.who || "—")}</td><td>${a.due ? fmtDate(a.due) : "—"}</td><td>${a.done ? "Tamamlandı" : "Açık"}</td></tr>`).join("")}</tbody></table></div>` : ""}

    ${n.note ? `<div class="block"><div class="blk-ttl">Notlar</div><div class="free">${esc(n.note)}</div></div>` : ""}

    ${(n.photos || []).length ? `<div class="block"><div class="blk-ttl">Fotoğraflar</div><div class="photos">${n.photos!.map((u) => `<img src="${esc(u)}"/>`).join("")}</div></div>` : ""}

    ${n.tags ? `<div class="block"><div class="blk-ttl">Etiketler</div><div class="tags">${n.tags.split(",").map((x) => x.trim()).filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}
  </div>
</body></html>`;
}

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
