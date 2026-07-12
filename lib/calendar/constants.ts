/** Takvim modulu — tur/oncelik/durum etiketleri ve renkleri (UI + PDF ortak). */

export const EVENT_TYPES = [
  { id: "TOPLANTI", name: "Toplantı", dot: "bg-sky-500", chip: "border-sky-300 text-sky-700 bg-sky-50", hex: "#0ea5e9" },
  { id: "GOREV", name: "Görev", dot: "bg-emerald-500", chip: "border-emerald-300 text-emerald-700 bg-emerald-50", hex: "#10b981" },
  { id: "HATIRLATMA", name: "Hatırlatma", dot: "bg-amber-500", chip: "border-amber-300 text-amber-700 bg-amber-50", hex: "#f59e0b" },
  { id: "TERMIN", name: "Termin", dot: "bg-rose-500", chip: "border-rose-300 text-rose-700 bg-rose-50", hex: "#f43f5e" },
  { id: "ZIYARET", name: "Ziyaret", dot: "bg-violet-500", chip: "border-violet-300 text-violet-700 bg-violet-50", hex: "#8b5cf6" },
  { id: "ARAMA", name: "Arama", dot: "bg-teal-500", chip: "border-teal-300 text-teal-700 bg-teal-50", hex: "#14b8a6" },
  { id: "DIGER", name: "Diğer", dot: "bg-slate-500", chip: "border-slate-300 text-slate-700 bg-slate-100", hex: "#64748b" },
] as const;

export type EventTypeId = (typeof EVENT_TYPES)[number]["id"];
export const evType = (id: string) => EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[6];

export const PRIORITIES = [
  { id: "DUSUK", name: "Düşük", chip: "border-slate-200 text-slate-600 bg-slate-50" },
  { id: "NORMAL", name: "Normal", chip: "border-sky-200 text-sky-700 bg-sky-50" },
  { id: "YUKSEK", name: "Yüksek", chip: "border-rose-200 text-rose-700 bg-rose-50" },
] as const;

export const STATUSES = [
  { id: "PLANLANDI", name: "Planlandı" },
  { id: "TAMAMLANDI", name: "Tamamlandı" },
  { id: "IPTAL", name: "İptal" },
] as const;

export const VISIBILITIES = [
  { id: "ORG", name: "Tüm ekip", hint: "Organizasyondaki herkes görür" },
  { id: "KATILIMCILAR", name: "Katılımcılar", hint: "Sadece davetliler ve sahibi görür" },
  { id: "OZEL", name: "Özel", hint: "Sadece sen görürsün" },
] as const;

export const ATTENDEE_STATUSES = [
  { id: "DAVETLI", name: "Davetli", chip: "border-slate-200 text-slate-600 bg-slate-50" },
  { id: "KABUL", name: "Kabul", chip: "border-emerald-200 text-emerald-700 bg-emerald-50" },
  { id: "RET", name: "Ret", chip: "border-rose-200 text-rose-700 bg-rose-50" },
] as const;

/** Hatirlatma secenekleri — etkinlikten kac dakika once. */
export const REMINDER_OPTIONS = [
  { minutes: 0, name: "Etkinlik anında" },
  { minutes: 10, name: "10 dakika önce" },
  { minutes: 30, name: "30 dakika önce" },
  { minutes: 60, name: "1 saat önce" },
  { minutes: 180, name: "3 saat önce" },
  { minutes: 1440, name: "1 gün önce" },
  { minutes: 2880, name: "2 gün önce" },
  { minutes: 10080, name: "1 hafta önce" },
] as const;

export const reminderLabel = (m: number) =>
  REMINDER_OPTIONS.find((r) => r.minutes === m)?.name || `${m} dk önce`;
