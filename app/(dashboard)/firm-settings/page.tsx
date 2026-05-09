import { requireAuth, getUserOrganizations } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FirmSettingsForm } from "@/components/shared/firm-settings-form";

export default async function ProfilePage() {
  const user = await requireAuth();

  const [firm, membership, memberships] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
    prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      },
    }),
    getUserOrganizations(user.id),
  ]);
  if (!firm) redirect("/dashboard");

  // Kullanicinin uye oldugu tum paneller — kendi paneli + davet aldiklari.
  // Owner alanini da dahil et ki "Kendi panelin" rozetini gosterebilelim.
  const ownedOrgs = await prisma.organization.findMany({
    where: { id: { in: memberships.map((m) => m.organizationId) } },
    select: { id: true, ownerId: true },
  });
  const ownerMap = new Map(ownedOrgs.map((o) => [o.id, o.ownerId]));

  const panels = memberships.map((m) => ({
    id: m.organizationId,
    name: m.organization.name,
    role: m.role as "admin" | "user" | "viewer",
    isActive: m.organizationId === user.organizationId,
    isOwn: ownerMap.get(m.organizationId) === user.id,
    joinedAt: m.joinedAt,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <FirmSettingsForm
        firm={firm}
        profile={user}
        platformRole={user.platformRole}
        joinedAt={membership?.joinedAt ?? new Date()}
        panels={panels}
      />
    </div>
  );
}
