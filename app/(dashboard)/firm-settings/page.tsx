import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { FirmSettingsForm } from "@/components/shared/firm-settings-form";

export default async function FirmSettingsPage() {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const [firm, members] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
    prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  if (!firm) return null;

  // Eski API ile uyumlu shape — FirmSettingsForm `users` props bekliyor.
  const users = members.map((m) => ({
    id: m.userId,
    name: m.user.fullName ?? m.user.email ?? "—",
    email: m.user.email ?? "",
    role: m.role,
    isActive: true,
    createdAt: m.joinedAt,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Firma Ayarları</h1>
      <FirmSettingsForm firm={firm} users={users} currentUserId={user.id} />
    </div>
  );
}
