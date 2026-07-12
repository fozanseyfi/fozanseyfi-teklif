"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Trash2, Check, MapPin, Users, Bell, Briefcase, Clock,
} from "lucide-react";
import {
  listCalendarEvents, saveCalendarEvent, deleteCalendarEvent, toggleCalendarEventDone, respondToEvent,
  type CalEvent, type CalMember, type CalEventInput,
} from "@/app/actions/calendar";
import {
  EVENT_TYPES, PRIORITIES, VISIBILITIES, ATTENDEE_STATUSES, REMINDER_OPTIONS, evType, reminderLabel,
} from "@/lib/calendar/constants";
import { DayTimeGrid } from "./day-time-grid";
import type { AttendeeStatus, CalendarEventType, CalendarPriority, CalendarVisibility } from "@prisma/client";

type View = "month" | "week" | "day" | "agenda";

const IN = "w-full rounded-md border border-border bg-background px-2.5 py-2 text-[13.5px] outline-none focus:border-primary";
const LBL = "mb-1 block text-[11.5px] font-medium text-muted-foreground";
const DOWS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/* ---- tarih yardimcilari (hepsi yerel saat) ---- */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => isoDay(a) === isoDay(b);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const longDate = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
/** <input type="datetime-local"> degeri (yerel). */
const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function CalendarApp({
  members, projects, me, canCreate, initialEventId,
}: {
  members: CalMember[];
  projects: { id: string; name: string }[];
  me: string;
  canCreate: boolean;
  initialEventId?: string;
}) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [typeF, setTypeF] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);
  const [memberF, setMemberF] = useState("");

  const [form, setForm] = useState<(CalEventInput & { canEdit?: boolean; canDelete?: boolean; attendeeStatuses?: Record<string, AttendeeStatus>; createdById?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  /* ---- yuklenecek tarih araligi ---- */
  const { from, to, title } = useMemo(() => {
    if (view === "month") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const grid = startOfWeek(first);
      return {
        from: grid,
        to: addDays(grid, 42),
        title: cursor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
      };
    }
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 7);
      return { from: s, to: e, title: `${s.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${addDays(e, -1).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}` };
    }
    if (view === "day") {
      const s = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      return { from: s, to: addDays(s, 1), title: longDate(s) };
    }
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { from: s, to: addDays(s, 30), title: "Önümüzdeki 30 gün" };
  }, [view, cursor]);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan veri cekme (dis senkronizasyon)
    setLoading(true);
    listCalendarEvents(fromISO, toISO)
      .then((r) => { if (alive) { setEvents(r); setLoading(false); } })
      .catch(() => { if (alive) { toast.error("Takvim yüklenemedi"); setLoading(false); } });
    return () => { alive = false; };
  }, [fromISO, toISO, reloadKey]);

  // Bildirimden gelen ?event=<id> — etkinlik yuklendiginde ac (URL disaridan gelen durum).
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened || !initialEventId || !events.length) return;
    const e = events.find((x) => x.id === initialEventId);
    if (!e) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL parametresinden acilan modal (dis senkronizasyon)
    setForm(toForm(e));
    setOpened(true);
  }, [initialEventId, events, opened]);

  const shown = useMemo(() => events.filter((e) => {
    if (typeF && e.type !== typeF) return false;
    if (mineOnly && e.createdById !== me && !e.attendees.some((a) => a.userId === me)) return false;
    if (memberF && e.createdById !== memberF && !e.attendees.some((a) => a.userId === memberF)) return false;
    return true;
  }), [events, typeF, mineOnly, memberF, me]);

  const dayEvents = (d: Date) => shown.filter((e) => sameDay(new Date(e.startAt), d)).sort((a, b) => a.startAt < b.startAt ? -1 : 1);

  /* ---- eylemler ---- */
  function toForm(e: CalEvent) {
    return {
      id: e.id, title: e.title, description: e.description || "", type: e.type,
      startAt: e.startAt, endAt: e.endAt, allDay: e.allDay, location: e.location || "",
      priority: e.priority, status: e.status, visibility: e.visibility, projectId: e.projectId,
      attendeeIds: e.attendees.map((a) => a.userId), reminders: e.myReminders,
      canEdit: e.canEdit, canDelete: e.canDelete, createdById: e.createdById,
      attendeeStatuses: Object.fromEntries(e.attendees.map((a) => [a.userId, a.status])) as Record<string, AttendeeStatus>,
    };
  }
  function openNew(d?: Date) {
    if (!canCreate) { toast.error("Görüntüleyici rolünde etkinlik oluşturamazsınız"); return; }
    // Varsayilan sure 30 dk; saat 10'ar dk adima yuvarlanir.
    const base = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0) : new Date();
    base.setMinutes(Math.round(base.getMinutes() / 10) * 10, 0, 0);
    const end = new Date(base.getTime() + 30 * 60_000);
    setForm({
      // Bir tur filtresi aciksa yeni etkinlik dogrudan o turde acilir.
      title: "", description: "", type: (typeF || "TOPLANTI") as CalendarEventType,
      startAt: base.toISOString(), endAt: end.toISOString(), allDay: false, location: "",
      priority: "NORMAL" as CalendarPriority, status: "PLANLANDI", visibility: "ORG" as CalendarVisibility,
      projectId: null, attendeeIds: [], reminders: [60], canEdit: true, canDelete: true,
    });
  }
  const patch = (p: Partial<CalEventInput>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function save() {
    if (!form) return;
    setBusy(true);
    const r = await saveCalendarEvent({
      id: form.id, title: form.title, description: form.description, type: form.type,
      startAt: form.startAt, endAt: form.endAt, allDay: form.allDay, location: form.location,
      priority: form.priority, status: form.status, visibility: form.visibility,
      projectId: form.projectId, attendeeIds: form.attendeeIds, reminders: form.reminders,
    });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success(form.id ? "Etkinlik güncellendi" : "Etkinlik oluşturuldu");
    setForm(null); setReloadKey((k) => k + 1);
  }
  async function remove() {
    if (!form?.id) return;
    if (!confirm(`"${form.title}" silinsin mi?`)) return;
    setBusy(true);
    const r = await deleteCalendarEvent(form.id);
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success("Etkinlik silindi");
    setForm(null); setReloadKey((k) => k + 1);
  }
  async function toggleDone(id: string) {
    const r = await toggleCalendarEventDone(id);
    if (r.error) { toast.error(r.error); return; }
    setReloadKey((k) => k + 1);
  }
  async function respond(id: string, status: AttendeeStatus) {
    const r = await respondToEvent(id, status);
    if (r.error) { toast.error(r.error); return; }
    toast.success(status === "KABUL" ? "Katılım kabul edildi" : "Katılım reddedildi");
    setForm(null); setReloadKey((k) => k + 1);
  }

  const move = (dir: number) => setCursor((c) => {
    if (view === "month") return new Date(c.getFullYear(), c.getMonth() + dir, 1);
    if (view === "week") return addDays(c, 7 * dir);
    return addDays(c, dir);
  });

  /* ---------- render parcalari ---------- */
  function eventPill(e: CalEvent, withTime = true) {
    const t = evType(e.type);
    const done = e.status === "TAMAMLANDI";
    return (
      <button
        key={e.id}
        type="button"
        onClick={(ev) => { ev.stopPropagation(); setForm(toForm(e)); }}
        className={cn("flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11.5px] hover:bg-muted", e.status === "IPTAL" && "opacity-50")}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />
        {withTime && !e.allDay && <span className="shrink-0 tabular-nums text-muted-foreground">{hhmm(e.startAt)}</span>}
        <span className={cn("truncate", done && "text-muted-foreground line-through")}>{e.title}</span>
      </button>
    );
  }

  function renderMonth() {
    const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(from, i));
    return (
      <div className="grid grid-cols-7 gap-1.5">
        {DOWS.map((d) => <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">{d}</div>)}
        {cells.map((d) => {
          const evs = dayEvents(d);
          const out = d.getMonth() !== cursor.getMonth();
          const today = sameDay(d, new Date());
          return (
            <button
              key={isoDay(d)}
              type="button"
              onClick={() => openNew(d)}
              className={cn("min-h-[104px] rounded-lg border p-1.5 text-left align-top transition-colors hover:border-primary/50",
                out ? "border-border/40 bg-muted/20" : "border-border bg-card",
                today && "border-primary ring-1 ring-primary")}
            >
              <div className={cn("mb-1 text-[12px] font-semibold tabular-nums", out && "text-muted-foreground")}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e) => eventPill(e))}
                {evs.length > 3 && <span className="block px-1.5 text-[10.5px] text-muted-foreground">+{evs.length - 3} daha</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    return (
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const evs = dayEvents(d);
          const today = sameDay(d, new Date());
          return (
            <button
              key={isoDay(d)}
              type="button"
              onClick={() => openNew(d)}
              className={cn("min-h-[260px] rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-primary/50", today && "border-primary ring-1 ring-primary")}
            >
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                {DOWS[(d.getDay() + 6) % 7]} <span className="text-foreground tabular-nums">{d.getDate()}</span>
              </div>
              <div className="space-y-1">{evs.length ? evs.map((e) => eventPill(e)) : <span className="px-1 text-[11px] text-muted-foreground">—</span>}</div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderDay() {
    const evs = dayEvents(from);
    if (!evs.length) return emptyBox("Bu günde etkinlik yok", "Gün üzerinde \"Etkinlik ekle\" ile plan oluşturun.");
    return <div className="space-y-2">{evs.map((e) => eventRow(e))}</div>;
  }

  function renderAgenda() {
    const groups = new Map<string, CalEvent[]>();
    shown.slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1)).forEach((e) => {
      const k = isoDay(new Date(e.startAt));
      groups.set(k, [...(groups.get(k) || []), e]);
    });
    if (!groups.size) return emptyBox("Yaklaşan etkinlik yok", "Önümüzdeki 30 günde planlanmış bir şey görünmüyor.");
    return (
      <div className="space-y-4">
        {[...groups.entries()].map(([k, evs]) => (
          <div key={k}>
            <h3 className="mb-1.5 text-[12.5px] font-semibold text-muted-foreground">{longDate(new Date(k + "T12:00"))}</h3>
            <div className="space-y-2">{evs.map((e) => eventRow(e))}</div>
          </div>
        ))}
      </div>
    );
  }

  function eventRow(e: CalEvent) {
    const t = evType(e.type);
    const done = e.status === "TAMAMLANDI";
    const mine = e.attendees.find((a) => a.userId === me);
    return (
      <div key={e.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", t.dot)} />
        <button type="button" onClick={() => setForm(toForm(e))} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold", done && "text-muted-foreground line-through")}>{e.title}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", t.chip)}>{t.name}</span>
            {e.status === "IPTAL" && <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700">İptal</span>}
            {mine?.status === "DAVETLI" && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">Yanıt bekliyor</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{e.allDay ? "Tüm gün" : hhmm(e.startAt) + (e.endAt ? "–" + hhmm(e.endAt) : "")}</span>
            {e.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{e.location}</span>}
            {e.attendees.length > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{e.attendees.length} katılımcı</span>}
            {e.projectName && <span className="inline-flex items-center gap-1"><Briefcase className="size-3.5" />{e.projectName}</span>}
            {e.myReminders.length > 0 && <span className="inline-flex items-center gap-1"><Bell className="size-3.5" />{reminderLabel(e.myReminders[0])}</span>}
          </div>
          {e.description && <p className="mt-1 line-clamp-2 text-[13px] text-foreground/70">{e.description}</p>}
        </button>
        {e.canEdit && (
          <button title={done ? "Geri al" : "Tamamlandı"} onClick={() => toggleDone(e.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-emerald-600">
            <Check className="size-4" />
          </button>
        )}
      </div>
    );
  }

  function emptyBox(t: string, s: string) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
        <CalendarDays className="mx-auto mb-2 size-8 text-muted-foreground/50" />
        <p className="text-[14px] font-medium text-foreground">{t}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{s}</p>
      </div>
    );
  }

  function renderModal() {
    const f = form!;
    const ro = f.id ? !f.canEdit : false;
    const mine = f.id && f.attendeeStatuses?.[me];
    const startLocal = toLocalInput(f.startAt);
    const endLocal = f.endAt ? toLocalInput(f.endAt) : "";
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
        <div className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h3 className="text-[15px] font-semibold">{f.id ? (ro ? "Etkinlik" : "Etkinliği düzenle") : "Yeni etkinlik"}</h3>
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setForm(null)}><X className="size-4" /></button>
          </div>

          {mine === "DAVETLI" && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <span className="font-medium">Bu etkinliğe davet edildiniz.</span>
              <Button size="sm" className="ml-auto" onClick={() => respond(f.id!, "KABUL")}>Kabul et</Button>
              <Button size="sm" variant="outline" onClick={() => respond(f.id!, "RET")}>Reddet</Button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className={LBL}>Başlık *</label>
              <input disabled={ro} value={f.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Örn. Çimsa ile fiyat görüşmesi" className={IN} />
            </div>

            <div>
              <label className={LBL}>Tür</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((t) => {
                  const on = f.type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={ro}
                      onClick={() => patch({ type: t.id as CalendarEventType })}
                      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      <span className={cn("size-2 rounded-full", on ? "bg-primary-foreground" : t.dot)} /> {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={LBL}>Öncelik</label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => {
                  const on = f.priority === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={ro}
                      onClick={() => patch({ priority: p.id as CalendarPriority })}
                      className={cn("rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" disabled={ro} checked={!!f.allDay} onChange={(e) => patch({ allDay: e.target.checked })} className="size-4 rounded border-border" />
              Tüm gün
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={LBL}>Tarih *</label>
                <input
                  type="date"
                  disabled={ro}
                  value={startLocal.slice(0, 10)}
                  onChange={(e) => {
                    const day = e.target.value;
                    if (!day) return;
                    const s = `${day}T${startLocal.slice(11)}`;
                    const dur = f.endAt ? new Date(f.endAt).getTime() - new Date(f.startAt).getTime() : 30 * 60_000;
                    const ns = new Date(s);
                    patch({ startAt: ns.toISOString(), endAt: new Date(ns.getTime() + dur).toISOString() });
                  }}
                  className={IN}
                />
              </div>
              <div>
                <label className={LBL}>Başlangıç</label>
                <input
                  type="time"
                  step={600}
                  disabled={ro || !!f.allDay}
                  value={startLocal.slice(11)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const ns = new Date(`${startLocal.slice(0, 10)}T${e.target.value}`);
                    const dur = f.endAt ? Math.max(600_000, new Date(f.endAt).getTime() - new Date(f.startAt).getTime()) : 30 * 60_000;
                    patch({ startAt: ns.toISOString(), endAt: new Date(ns.getTime() + dur).toISOString() });
                  }}
                  className={IN}
                />
              </div>
              <div>
                <label className={LBL}>Bitiş</label>
                <input
                  type="time"
                  step={600}
                  disabled={ro || !!f.allDay}
                  value={(endLocal || startLocal).slice(11)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    patch({ endAt: new Date(`${startLocal.slice(0, 10)}T${e.target.value}`).toISOString() });
                  }}
                  className={IN}
                />
              </div>
            </div>

            {!f.allDay && (
              <DayTimeGrid
                dayISO={startLocal.slice(0, 10)}
                startISO={f.startAt}
                endISO={f.endAt || null}
                disabled={ro}
                onChange={(s, e) => patch({ startAt: s, endAt: e })}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LBL}>Konum</label>
                <input disabled={ro} value={f.location || ""} onChange={(e) => patch({ location: e.target.value })} placeholder="Ofis / Online / Saha" className={IN} />
              </div>
              <div>
                <label className={LBL}>İlgili teklif / proje</label>
                <select disabled={ro} value={f.projectId || ""} onChange={(e) => patch({ projectId: e.target.value || null })} className={IN}>
                  <option value="">— Yok —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={LBL}>Açıklama</label>
              <textarea disabled={ro} value={f.description || ""} onChange={(e) => patch({ description: e.target.value })} rows={3} className={cn(IN, "resize-y")} />
            </div>

            <div className="rounded-lg border border-border p-3">
              <label className={cn(LBL, "flex items-center gap-1.5")}><Users className="size-3.5" /> Katılımcılar</label>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = (f.attendeeIds || []).includes(m.id);
                  const st = f.attendeeStatuses?.[m.id];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={ro}
                      onClick={() => patch({ attendeeIds: on ? (f.attendeeIds || []).filter((x) => x !== m.id) : [...(f.attendeeIds || []), m.id] })}
                      className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      {m.name}
                      {on && st && st !== "DAVETLI" && <span className="ml-1 opacity-80">· {ATTENDEE_STATUSES.find((a) => a.id === st)?.name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <label className={cn(LBL, "flex items-center gap-1.5")}><Bell className="size-3.5" /> Hatırlatma (sadece sizin için)</label>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_OPTIONS.map((r) => {
                  const on = (f.reminders || []).includes(r.minutes);
                  return (
                    <button
                      key={r.minutes}
                      type="button"
                      onClick={() => patch({ reminders: on ? (f.reminders || []).filter((x) => x !== r.minutes) : [...(f.reminders || []), r.minutes] })}
                      className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                        on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Zamanı gelince üstteki zil ikonunda ve Bildirimler sayfasında görünür.</p>
            </div>

            <div>
              <label className={LBL}>Görünürlük</label>
              <div className="flex flex-wrap gap-1.5">
                {VISIBILITIES.map((v) => {
                  const on = f.visibility === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={ro}
                      title={v.hint}
                      onClick={() => patch({ visibility: v.id as CalendarVisibility })}
                      className={cn("rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">{VISIBILITIES.find((v) => v.id === f.visibility)?.hint}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {f.id && f.canDelete && <Button variant="ghost" className="text-rose-600" disabled={busy} onClick={remove}><Trash2 className="size-4" /> Sil</Button>}
            <Button variant="outline" className="ml-auto" onClick={() => setForm(null)}>Kapat</Button>
            {!ro && <Button disabled={busy} onClick={save}>{busy ? "Kaydediliyor…" : f.id ? "Güncelle" : "Oluştur"}</Button>}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- ana ---------- */
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-[19px] font-semibold"><CalendarDays className="size-5 text-primary" /> Takvim</h1>
          <p className="text-[12.5px] text-muted-foreground">Ekip etkinlikleri, görevler ve hatırlatmalar</p>
        </div>
        <Button className="ml-auto" onClick={() => openNew(view === "month" ? undefined : from)}><Plus className="size-4" /> Etkinlik</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /></button>
          <button onClick={() => move(1)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground"><ChevronRight className="size-4" /></button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Bugün</Button>
        </div>
        <h2 className="text-[15px] font-semibold capitalize">{title}</h2>
        {loading && <span className="text-[12px] text-muted-foreground">yükleniyor…</span>}
        <div className="ml-auto flex gap-1 rounded-lg border border-border bg-card p-0.5">
          {([["month", "Ay"], ["week", "Hafta"], ["day", "Gün"], ["agenda", "Ajanda"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setTypeF("")} className={cn("rounded-lg border px-2.5 py-1 text-[12px] font-medium", !typeF ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card text-muted-foreground hover:bg-muted")}>Tümü</button>
        {EVENT_TYPES.map((t) => (
          <button key={t.id} onClick={() => setTypeF(typeF === t.id ? "" : t.id)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium", typeF === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card text-muted-foreground hover:bg-muted")}>
            <span className={cn("size-1.5 rounded-full", t.dot)} /> {t.name}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="size-4 rounded border-border" /> Sadece benimkiler
        </label>
        <select value={memberF} onChange={(e) => setMemberF(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-muted-foreground outline-none">
          <option value="">Tüm ekip</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {view === "month" && renderMonth()}
      {view === "week" && renderWeek()}
      {view === "day" && renderDay()}
      {view === "agenda" && renderAgenda()}

      {form && renderModal()}
    </div>
  );
}
