/**
 * Not Defteri — İZOLE modül veri tipleri. Platformun Müşteriler/Kişiler/Projeler
 * verisiyle HİÇBİR alışveriş yapmaz; kişiler ve şirketler yalnızca bu deftere kaydolur.
 * Tümü kullanıcının Notebook.data (JSON) kaydında saklanır.
 */

export interface NbAction {
  what: string;
  who?: string;
  due?: string; // ISO yyyy-mm-dd
  done?: boolean;
}
export interface NbTopic {
  subject?: string;
  summary?: string;
  decisions?: string[]; // aynı başlık altında birden çok karar
  decision?: string; // eski kayıtlar (okuma uyumluluğu)
}
export interface NbNote {
  id: string;
  title?: string;
  date: string; // yyyy-mm-dd
  startTime?: string;
  endTime?: string;
  type: string; // NB_TYPES id
  company?: string;
  people: string[];
  ourAttendees?: string;
  recorder?: string;
  location?: string;
  topics?: NbTopic[];
  actions?: NbAction[];
  photos?: string[]; // yüklenen fotoğraf URL'leri
  tags?: string;
  followUp?: string;
  followDone?: boolean;
  nextMeeting?: string;
  note?: string;
  pinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface NbContact {
  id: string;
  name: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  note?: string;
}
export interface NbCompany {
  id: string;
  name: string;
  segment?: string;
  city?: string;
  phone?: string;
  email?: string;
  web?: string;
  note?: string;
  createdAt?: string;
}
export interface NotebookData {
  notes: NbNote[];
  contacts: NbContact[];
  companies: NbCompany[];
}

export const EMPTY_NOTEBOOK: NotebookData = { notes: [], contacts: [], companies: [] };

/** Toplantı türleri — bizim temaya uygun renk anahtarları (Tailwind sınıfları editor'de). */
export const NB_TYPES: { id: string; name: string; dot: string; chip: string }[] = [
  { id: "musteri", name: "Müşteri Ziyareti", dot: "bg-rose-500", chip: "border-rose-300 text-rose-700 bg-rose-50" },
  { id: "fuar", name: "Fuar / Etkinlik", dot: "bg-violet-500", chip: "border-violet-300 text-violet-700 bg-violet-50" },
  { id: "demo", name: "Tanıtım / Demo", dot: "bg-sky-500", chip: "border-sky-300 text-sky-700 bg-sky-50" },
  { id: "partner", name: "Distribütör / Partner", dot: "bg-amber-500", chip: "border-amber-300 text-amber-700 bg-amber-50" },
  { id: "ic", name: "İç Toplantı", dot: "bg-slate-500", chip: "border-slate-300 text-slate-700 bg-slate-100" },
  { id: "online", name: "Online Görüşme", dot: "bg-emerald-500", chip: "border-emerald-300 text-emerald-700 bg-emerald-50" },
];
export const nbType = (id: string) => NB_TYPES.find((t) => t.id === id) || NB_TYPES[0];

export const NB_SEGMENTS = ["EPC", "Yatırımcı", "Distribütör", "Sanayi", "Tarım / Sulama", "Kamu", "Diğer"];

/** Bir topic'in kararlarını normalize et (eski decision alanı dahil). */
export function topicDecisions(t: NbTopic): string[] {
  const arr = (t.decisions || []).filter(Boolean);
  if (!arr.length && t.decision) return [t.decision];
  return arr;
}
/** Bir notun etiketlerini dizi olarak ver. */
export function noteTagList(tags?: string): string[] {
  return (tags || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function nbUid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
