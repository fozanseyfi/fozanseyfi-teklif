"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { flushDueRemindersFor, unreadCountFor } from "@/lib/notifications-server";
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

/** Vakti gelmis hatirlatmalari bildirime cevirir — bkz. lib/notifications-server. */
export async function flushDueReminders(): Promise<number> {
  const user = await requireAuth();
  return flushDueRemindersFor(user.id);
}

/** Okunmamis bildirim sayisi. Zil rozeti artik GET /api/notifications/unread kullanir
 *  (server action istemci kuyrugunu mesgul etmesin diye); bu action geriye uyumluluk icin. */
export async function getUnreadCount(): Promise<number> {
  const user = await requireAuth();
  return unreadCountFor(user.id);
}

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const user = await requireAuth();
  await flushDueRemindersFor(user.id);
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
