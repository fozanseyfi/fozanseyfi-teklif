import { requireAuth } from "@/lib/auth";
import { getCalendarMembers, getCalendarProjects } from "@/app/actions/calendar";
import { CalendarApp } from "@/components/calendar/calendar-app";

export const metadata = { title: "Takvim" };

export default async function TakvimPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const [user, sp] = await Promise.all([requireAuth(), searchParams]);
  const [members, projects] = await Promise.all([getCalendarMembers(), getCalendarProjects()]);
  return (
    <CalendarApp
      members={members}
      projects={projects}
      me={user.id}
      canCreate={user.platformRole !== "viewer"}
      initialEventId={sp?.event}
    />
  );
}
