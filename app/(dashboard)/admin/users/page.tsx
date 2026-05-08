import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { PLATFORM_KEY } from "@/lib/platform";
import { redirect } from "next/navigation";
import { AdminUsersClient } from "./client";

export default async function AdminUsersPage() {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const [members, invitations] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId, platform: PLATFORM_KEY },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        organizationId: user.organizationId,
        platform: PLATFORM_KEY,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const users = members.map((m) => ({
    id: m.userId,
    name: m.user.fullName ?? m.user.email ?? "—",
    email: m.user.email ?? "",
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  const pendingInvites = invitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    token: i.token,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));

  return (
    <AdminUsersClient
      users={users}
      invitations={pendingInvites}
      currentUserId={user.id}
      organizationName={user.organization.name}
    />
  );
}
