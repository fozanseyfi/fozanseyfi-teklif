import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FirmSettingsForm } from "@/components/shared/firm-settings-form";

export default async function ProfilePage() {
  const user = await requireAuth();

  const [firm, membership] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
    prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      },
    }),
  ]);
  if (!firm) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl">
      <FirmSettingsForm
        firm={firm}
        profile={user}
        platformRole={user.platformRole}
        joinedAt={membership?.joinedAt ?? new Date()}
      />
    </div>
  );
}
