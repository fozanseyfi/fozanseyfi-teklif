/**
 * Müşteri ödeme ekstresi — saf hesap + hatırlatma metni. Hem public sayfa
 * (server) hem tahsilat kartı (client) kullanır; server-only DEĞİL.
 */

export interface StmtCollection {
  amount: number;
  collectedDate: string; // yyyy-mm-dd
  isPlanned: boolean;
  note?: string;
}

export type PlannedTone = "future" | "today" | "overdue";

export function dayDiff(dateISO: string, todayISO: string): number {
  const d = new Date(`${dateISO}T00:00:00`);
  const t = new Date(`${todayISO}T00:00:00`);
  if (isNaN(d.getTime()) || isNaN(t.getTime())) return 0;
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function plannedStatus(dateISO: string, todayISO: string): { label: string; tone: PlannedTone } {
  const diff = dayDiff(dateISO, todayISO);
  if (diff > 0) return { label: `${diff} gün sonra`, tone: "future" };
  if (diff === 0) return { label: "bugün", tone: "today" };
  return { label: `${Math.abs(diff)} gün gecikmiş`, tone: "overdue" };
}

/** dd.mm.yyyy — okunur tarih. */
export function trDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtN(n: number): string {
  return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export interface StatementInput {
  customer: string;
  firmName: string;
  projectName: string;
  sym: string;
  total: number; // satış / toplam tutar
  collections: StmtCollection[];
  todayISO: string;
  link?: string;
}

export interface StatementView {
  collected: number;
  remaining: number;
  paid: StmtCollection[];
  planned: (StmtCollection & { status: { label: string; tone: PlannedTone } })[];
  hasOverdue: boolean;
  nextPlanned: (StmtCollection & { status: { label: string; tone: PlannedTone } }) | null;
}

export function buildStatement(inp: StatementInput): StatementView {
  const paid = inp.collections
    .filter((c) => !c.isPlanned)
    .slice()
    .sort((a, b) => a.collectedDate.localeCompare(b.collectedDate));
  const collected = paid.reduce((s, c) => s + (c.amount || 0), 0);
  const planned = inp.collections
    .filter((c) => c.isPlanned)
    .slice()
    .sort((a, b) => a.collectedDate.localeCompare(b.collectedDate))
    .map((c) => ({ ...c, status: plannedStatus(c.collectedDate, inp.todayISO) }));
  const remaining = (inp.total || 0) - collected;
  const hasOverdue = planned.some((p) => p.status.tone === "overdue");
  // Sıradaki planlanan: bugün/gelecek olanların ilki, yoksa gecikmişlerin ilki.
  const upcoming = planned.filter((p) => p.status.tone !== "overdue");
  const nextPlanned = upcoming[0] ?? planned[0] ?? null;
  return { collected, remaining, paid, planned, hasOverdue, nextPlanned };
}

/** WhatsApp / e-posta için KISA düz metin hatırlatma. */
export function reminderText(inp: StatementInput): string {
  const v = buildStatement(inp);
  const L: string[] = [];
  L.push(`Sayın ${inp.customer || "Yetkili"},`);
  L.push("");
  L.push(
    `${inp.firmName} olarak "${inp.projectName}" işiniz için güncel ödeme durumunuzu aşağıdaki linkten görebilirsiniz.`,
  );
  L.push(`Kalan bakiye: ${inp.sym}${fmtN(v.remaining)}`);
  if (inp.link) {
    L.push("");
    L.push(inp.link);
  }
  L.push("");
  L.push("İyi çalışmalar dileriz.");
  return L.join("\n");
}
