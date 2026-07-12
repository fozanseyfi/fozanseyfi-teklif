"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { AttendeeStatus, CalendarEventStatus, CalendarEventType, CalendarPriority, CalendarVisibility, Prisma } from "@prisma/client";

export interface CalMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
  priority: CalendarPriority;
  status: CalendarEventStatus;
  visibility: CalendarVisibility;
  projectId: string | null;
  projectName: string | null;
  createdById: string;
  createdByName: string;
  attendees: { userId: string; name: string; status: AttendeeStatus }[];
  /** Yalnizca istegi yapan kullanicinin hatirlatmalari (dakika cinsinden). */
  myReminders: number[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface CalEventInput {
  id?: string;
  title: string;
  description?: string;
  type: CalendarEventType;
  startAt: string; // ISO
  endAt?: string | null;
  allDay?: boolean;
  location?: string;
  priority?: CalendarPriority;
  status?: CalendarEventStatus;
  visibility?: CalendarVisibility;
  projectId?: string | null;
  attendeeIds?: string[];
  reminders?: number[]; // dakika-once listesi (istegi yapan kullanici icin)
}

const nameOf = (p: { fullName: string | null; email: string | null } | null | undefined) =>
  p?.fullName?.trim() || p?.email || "—";

/** Org uyeleri — katilimci secici icin. */
export async function getCalendarMembers(): Promise<CalMember[]> {
  const user = await requireAuth();
  const rows = await prisma.organizationMember.findMany({
    where: { organizationId: user.organizationId },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });
  return rows.map((m) => ({ id: m.userId, name: nameOf(m.user), email: m.user.email || "", role: m.role }));
}

/** Teklif/proje baglantisi icin kisa proje listesi. */
export async function getCalendarProjects(): Promise<{ id: string; name: string }[]> {
  const user = await requireAuth();
  const rows = await prisma.project.findMany({
    where: { organizationId: user.organizationId, isTemplate: false },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows;
}

/** Verilen tarih araligindaki, kullanicinin gorebilecegi etkinlikler.
 *  Gorunurluk: ORG (tum ekip) · KATILIMCILAR (sahibi + davetliler) · OZEL (sadece sahibi). */
export async function listCalendarEvents(fromISO: string, toISO: string): Promise<CalEvent[]> {
  const user = await requireAuth();
  const where: Prisma.CalendarEventWhereInput = {
    organizationId: user.organizationId,
    startAt: { gte: new Date(fromISO), lt: new Date(toISO) },
    OR: [
      { visibility: "ORG" },
      { createdById: user.id },
      { attendees: { some: { userId: user.id } } },
    ],
  };
  const rows = await prisma.calendarEvent.findMany({
    where,
    include: {
      attendees: true,
      reminders: { where: { userId: user.id } },
      project: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  // Isim cozumleme icin org uyeleri (tek sorgu).
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: user.organizationId },
    include: { user: true },
  });
  const names = new Map(members.map((m) => [m.userId, nameOf(m.user)]));
  const isAdmin = user.platformRole === "admin";

  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    type: e.type,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt ? e.endAt.toISOString() : null,
    allDay: e.allDay,
    location: e.location,
    priority: e.priority,
    status: e.status,
    visibility: e.visibility,
    projectId: e.projectId,
    projectName: e.project?.name ?? null,
    createdById: e.createdById,
    createdByName: names.get(e.createdById) || "—",
    attendees: e.attendees.map((a) => ({ userId: a.userId, name: names.get(a.userId) || "—", status: a.status })),
    myReminders: e.reminders.map((r) => r.minutesBefore).sort((a, b) => a - b),
    canEdit: user.platformRole !== "viewer" && (isAdmin || e.createdById === user.id),
    canDelete: isAdmin || e.createdById === user.id,
  }));
}

/** Hatirlatmalari (etkinlik + kullanici) yeniden kurar. */
async function syncReminders(eventId: string, userId: string, startAt: Date, minutes: number[]) {
  await prisma.calendarReminder.deleteMany({ where: { eventId, userId } });
  if (!minutes.length) return;
  await prisma.calendarReminder.createMany({
    data: [...new Set(minutes)].map((m) => ({
      eventId,
      userId,
      minutesBefore: m,
      remindAt: new Date(startAt.getTime() - m * 60_000),
    })),
  });
}

/** Etkinlik olusturur veya gunceller (id verilirse). */
export async function saveCalendarEvent(input: CalEventInput): Promise<{ id?: string; error?: string }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Görüntüleyici rolünde etkinlik oluşturamazsınız" };
  if (!input.title?.trim()) return { error: "Başlık zorunlu" };
  if (!input.startAt) return { error: "Başlangıç tarihi zorunlu" };

  const startAt = new Date(input.startAt);
  const endAt = input.endAt ? new Date(input.endAt) : null;
  if (endAt && endAt < startAt) return { error: "Bitiş, başlangıçtan önce olamaz" };

  const data = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    type: input.type,
    startAt,
    endAt,
    allDay: !!input.allDay,
    location: input.location?.trim() || null,
    priority: input.priority || ("NORMAL" as CalendarPriority),
    status: input.status || ("PLANLANDI" as CalendarEventStatus),
    visibility: input.visibility || ("ORG" as CalendarVisibility),
    projectId: input.projectId || null,
  };

  const attendeeIds = [...new Set(input.attendeeIds || [])];
  let eventId = input.id;

  if (eventId) {
    const cur = await prisma.calendarEvent.findFirst({
      where: { id: eventId, organizationId: user.organizationId },
      include: { attendees: true },
    });
    if (!cur) return { error: "Etkinlik bulunamadı" };
    if (user.platformRole !== "admin" && cur.createdById !== user.id)
      return { error: "Bu etkinliği yalnızca sahibi veya yönetici düzenleyebilir" };

    await prisma.calendarEvent.update({ where: { id: eventId }, data });
    await prisma.calendarAttendee.deleteMany({ where: { eventId, userId: { notIn: attendeeIds.length ? attendeeIds : ["-"] } } });
    const existing = new Set(cur.attendees.map((a) => a.userId));
    const fresh = attendeeIds.filter((id) => !existing.has(id));
    if (fresh.length)
      await prisma.calendarAttendee.createMany({ data: fresh.map((userId) => ({ eventId: eventId!, userId })), skipDuplicates: true });

    // Tarih degistiyse tum katilimcilarin hatirlatma zamanlari kaymalidir.
    const rems = await prisma.calendarReminder.findMany({ where: { eventId } });
    await Promise.all(
      rems.map((r) =>
        prisma.calendarReminder.update({
          where: { id: r.id },
          data: { remindAt: new Date(startAt.getTime() - r.minutesBefore * 60_000), sentAt: null },
        }),
      ),
    );
    // Yeni davetlilere bildirim.
    await notifyUsers(user.organizationId, fresh, "calendar_invite", `Yeni davet: ${data.title}`, fmtWhen(startAt, data.allDay), `/takvim?event=${eventId}`);
  } else {
    const created = await prisma.calendarEvent.create({
      data: { ...data, organizationId: user.organizationId, createdById: user.id },
    });
    eventId = created.id;
    if (attendeeIds.length)
      await prisma.calendarAttendee.createMany({ data: attendeeIds.map((userId) => ({ eventId: eventId!, userId })), skipDuplicates: true });
    await notifyUsers(
      user.organizationId,
      attendeeIds.filter((id) => id !== user.id),
      "calendar_invite",
      `Yeni davet: ${data.title}`,
      fmtWhen(startAt, data.allDay),
      `/takvim?event=${eventId}`,
    );
  }

  await syncReminders(eventId!, user.id, startAt, input.reminders || []);
  revalidatePath("/takvim");
  return { id: eventId };
}

/** Etkinligi siler — yalnizca sahibi veya yonetici. */
export async function deleteCalendarEvent(id: string): Promise<{ error?: string }> {
  const user = await requireAuth();
  const ev = await prisma.calendarEvent.findFirst({ where: { id, organizationId: user.organizationId }, include: { attendees: true } });
  if (!ev) return { error: "Etkinlik bulunamadı" };
  if (user.platformRole !== "admin" && ev.createdById !== user.id)
    return { error: "Bu etkinliği yalnızca sahibi veya yönetici silebilir" };

  await notifyUsers(
    user.organizationId,
    ev.attendees.map((a) => a.userId).filter((u) => u !== user.id),
    "calendar_cancel",
    `İptal edildi: ${ev.title}`,
    fmtWhen(ev.startAt, ev.allDay),
    "/takvim",
  );
  await prisma.calendarEvent.delete({ where: { id } });
  revalidatePath("/takvim");
  return {};
}

/** Etkinligi tamamlandi/planlandi arasinda cevirir. */
export async function toggleCalendarEventDone(id: string): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Görüntüleyici rolünde değişiklik yapamazsınız" };
  const ev = await prisma.calendarEvent.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!ev) return { error: "Etkinlik bulunamadı" };
  const next = ev.status === "TAMAMLANDI" ? "PLANLANDI" : "TAMAMLANDI";
  await prisma.calendarEvent.update({ where: { id }, data: { status: next as CalendarEventStatus } });
  revalidatePath("/takvim");
  return {};
}

/** Davete katilim yaniti (kabul/ret). */
export async function respondToEvent(eventId: string, status: AttendeeStatus): Promise<{ error?: string }> {
  const user = await requireAuth();
  const at = await prisma.calendarAttendee.findFirst({ where: { eventId, userId: user.id } });
  if (!at) return { error: "Bu etkinliğin katılımcısı değilsiniz" };
  await prisma.calendarAttendee.update({ where: { id: at.id }, data: { status } });
  revalidatePath("/takvim");
  return {};
}

/** Kullanicinin bu etkinlik icin hatirlatmalarini gunceller. */
export async function setEventReminders(eventId: string, minutes: number[]): Promise<{ error?: string }> {
  const user = await requireAuth();
  const ev = await prisma.calendarEvent.findFirst({ where: { id: eventId, organizationId: user.organizationId } });
  if (!ev) return { error: "Etkinlik bulunamadı" };
  await syncReminders(eventId, user.id, ev.startAt, minutes);
  revalidatePath("/takvim");
  return {};
}

/* -------------------------------------------------------------------------- */

function fmtWhen(d: Date, allDay: boolean): string {
  const date = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  if (allDay) return date;
  return `${date} · ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Coklu kullaniciya uygulama-ici bildirim yazar. */
async function notifyUsers(orgId: string, userIds: string[], type: string, title: string, body: string, link: string) {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ organizationId: orgId, userId, type, title, body, link })),
  });
}
