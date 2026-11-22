import "server-only";
import { prisma } from "@/lib/prisma";

/** Vakti gelmis hatirlatmalari uygulama-ici bildirime cevirir (idempotent).
 *  Zamanlayici (cron) gerektirmez: kullanici uygulamadayken zil her yenilendiginde
 *  calisir ve gecmis hatirlatmalari da yakalar. sent_at damgasi tekrar gondermeyi onler.
 *  userId cagiran tarafta dogrulanmis olmali (server action / route handler). */
export async function flushDueRemindersFor(userId: string): Promise<number> {
  const due = await prisma.calendarReminder.findMany({
    where: { userId, sentAt: null, remindAt: { lte: new Date() } },
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
          userId,
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
export async function unreadCountFor(userId: string): Promise<number> {
  await flushDueRemindersFor(userId);
  return prisma.notification.count({ where: { userId, readAt: null } });
}
