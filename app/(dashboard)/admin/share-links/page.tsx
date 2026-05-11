import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ShareLinksClient } from "./client";

export default async function ShareLinksPage() {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const [projects, links] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: user.organizationId, isTemplate: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, customerName: true },
    }),
    prisma.shareLink.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
      take: 100,
    }),
  ]);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name || "İsimsiz Proje",
    customerName: p.customerName,
  }));

  const linkRows = links.map((l) => ({
    id: l.id,
    token: l.token,
    projectId: l.projectId,
    projectName: l.project.name || "İsimsiz Proje",
    customerLabel: l.customerLabel,
    recipientEmail: l.recipientEmail,
    includedTabs: Array.isArray(l.includedTabs)
      ? (l.includedTabs as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    expiresAt: l.expiresAt?.toISOString() ?? null,
    viewCount: l.viewCount,
    lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
    revokedAt: l.revokedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <ShareLinksClient
      projects={projectOptions}
      links={linkRows}
      organizationName={user.organization.name}
    />
  );
}
