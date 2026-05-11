import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ACTION_LABELS } from "@/lib/audit-log";
import { AuditClient } from "./client";

interface Props {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    resource?: string;
  }>;
}

export default async function AuditPage({ searchParams }: Props) {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const params = await searchParams;
  const where: {
    organizationId: string;
    actorId?: string;
    action?: string;
    resourceType?: string;
  } = { organizationId: user.organizationId };
  if (params.actor) where.actorId = params.actor;
  if (params.action) where.action = params.action;
  if (params.resource) where.resourceType = params.resource;

  const [logs, members] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const rows = logs.map((l) => ({
    id: l.id,
    actorId: l.actorId,
    actorEmail: l.actorEmail,
    actorName: l.actorName,
    action: l.action,
    actionLabel: ACTION_LABELS[l.action] ?? l.action,
    resourceType: l.resourceType,
    resourceId: l.resourceId,
    resourceName: l.resourceName,
    details: l.details as Record<string, unknown>,
    createdAt: l.createdAt.toISOString(),
  }));

  const actorOptions = members.map((m) => ({
    id: m.userId,
    label: m.user.fullName ?? m.user.email ?? "—",
  }));

  const actionOptions = Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <AuditClient
      logs={rows}
      actors={actorOptions}
      actions={actionOptions}
      filters={{
        actor: params.actor ?? "",
        action: params.action ?? "",
        resource: params.resource ?? "",
      }}
      organizationName={user.organization.name}
    />
  );
}
