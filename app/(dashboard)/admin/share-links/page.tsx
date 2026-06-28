import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { isProjectVisible } from "@/lib/project-status";
import { parseBrandSettings } from "@/lib/pdf-brand";
import { redirect } from "next/navigation";
import { ShareLinksClient } from "./client";

export default async function ShareLinksPage() {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const [projectsRaw, links, org] = await Promise.all([
    // Adı boş olan / yarim kalmis (gesStep < 2) projeler paylaşım dropdown'una
    // dusmesin — kullanici "isimsiz proje" gormesin. Filtre Projeler sayfasi
    // ile ayni (isProjectVisible).
    prisma.project.findMany({
      where: {
        organizationId: user.organizationId,
        isTemplate: false,
        name: { not: "" },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        customerName: true,
        status: true,
        quoteKind: true,
        projectDetail: { select: { settings: true } },
      },
    }),
    prisma.shareLink.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
      take: 100,
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { brandSettings: true },
    }),
  ]);

  const projects = projectsRaw.filter(isProjectVisible);
  const brand = parseBrandSettings(org?.brandSettings);
  const customDocuments = (brand.customDocuments ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
  }));

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    customerName: p.customerName,
    quoteKind: p.quoteKind,
  }));

  const linkRows = links.map((l) => ({
    id: l.id,
    token: l.token,
    projectId: l.projectId,
    projectName: l.project.name || "(Adsız proje)",
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
      customDocuments={customDocuments}
    />
  );
}
