import { requireAuth } from "@/lib/auth";
import { getCalendarMembers } from "@/app/actions/calendar";
import { CalendarApp } from "@/components/calendar/calendar-app";

export const metadata = { title: "Takvim" };

export default async function TakvimPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const [user, sp] = await Promise.all([requireAuth(), searchParams]);
  const members = await getCalendarMembers();
  return (
    <CalendarApp
      members={members}
      me={user.id}
      canCreate={user.platformRole !== "viewer"}
      initialEventId={sp?.event}
    />
  );
}
