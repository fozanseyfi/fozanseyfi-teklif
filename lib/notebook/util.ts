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

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
