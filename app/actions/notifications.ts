"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** Vakti gelmis hatirlatmalari uygulama-ici bildirime cevirir (idempotent).
 *  Zamanlayici (cron) gerektirmez: kullanici uygulamadayken zil her yenilendiginde
 *  calisir ve gecmis hatirlatmalari da yakalar. sent_at damgasi tekrar gondermeyi onler. */
export async function flushDueReminders(): Promise<number> {
  const user = await requireAuth();
  const due = await prisma.calendarReminder.findMany({
    where: { userId: user.id, sentAt: null, remindAt: { lte: new Date() } },
    include: { event: { select: { id: true, title: true, startAt: true, allDay: true, status: true, organizationId: true } } },
    take: 50,
  });
  if (!due.length) return 0;

  const live = due.filter((r) => r.event && r.event.status !== "IPTAL");
  if (live.length) {
    await prisma.notification.createMany({
      data: live.map((r) => {
        const d = r.event.startAt;
        const when = r.event.allDay
          ? d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
          : `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} · ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
        return {
          organizationId: r.event.organizationId,
          userId: user.id,
          type: "calendar_reminder",
          title: `Hatırlatma: ${r.event.title}`,
          body: when,
          link: `/takvim?event=${r.event.id}`,
        };
      }),
    });
  }
  await prisma.calendarReminder.updateMany({
    where: { id: { in: due.map((r) => r.id) } },
    data: { sentAt: new Date() },
  });
  return live.length;
}

/** Okunmamis bildirim sayisi (zil rozeti). Once vakti gelen hatirlatmalari isler. */
export async function getUnreadCount(): Promise<number> {
  const user = await requireAuth();
  await flushDueReminders();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const user = await requireAuth();
  await flushDueReminders();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function deleteNotification(id: string): Promise<void> {
  const user = await requireAuth();
  await prisma.notification.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/notifications");
}
