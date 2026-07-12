import { requireAuth } from "@/lib/auth";
import { listNotifications } from "@/app/actions/notifications";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export const metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  await requireAuth();
  // listNotifications, vakti gelen takvim hatırlatmalarını da bildirime çevirir.
  const items = await listNotifications();
  return <NotificationsClient initial={items} />;
}
