"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { VALID_TAB_IDS, PRESET_DAYS, type SharePreset } from "@/lib/share-tabs";

function generateToken(): string {
  // 32 char base62 → ~190 bit entropy. URL-safe, predict edilemez.
  return randomBytes(24).toString("base64url");
}

export async function createShareLink(
  fd: FormData,
): Promise<{ success?: string; error?: string; url?: string }> {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Yetkin yok" };

  const projectId = (fd.get("projectId") as string)?.trim();
  const customerLabel = ((fd.get("customerLabel") as string) ?? "").trim();
  const preset = (fd.get("preset") as SharePreset) ?? "7d";
  const tabsRaw = fd.getAll("tabs") as string[];

  if (!projectId) return { error: "Proje seçilmedi" };
  if (!(preset in PRESET_DAYS)) return { error: "Süre geçersiz" };
  const tabs = tabsRaw.filter((t) => VALID_TAB_IDS.has(t));
  if (tabs.length === 0) return { error: "En az bir bölüm seçmelisin" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  if (!project) return { error: "Proje bulunamadı" };

  const days = PRESET_DAYS[preset];
  const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 3600 * 1000);

  const link = await prisma.shareLink.create({
    data: {
      token: generateToken(),
      organizationId: user.organizationId,
      projectId: project.id,
      createdById: user.id,
      customerLabel: customerLabel || null,
      includedTabs: tabs as never,
      expiresAt,
    },
  });

  await logAudit(user, "create_share_link", "project", project.id, project.name, {
    shareLinkId: link.id,
    customerLabel: customerLabel || null,
    tabs,
    preset,
    expiresAt: expiresAt?.toISOString() ?? null,
  });

  revalidatePath("/admin/share-links");

  return {
    success: "Paylaşım linki oluşturuldu",
    url: link.token,
  };
}

export async function revokeShareLink(
  id: string,
): Promise<{ success?: string; error?: string }> {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Yetkin yok" };

  const link = await prisma.shareLink.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!link) return { error: "Link bulunamadı" };
  if (link.revokedAt) return { error: "Link zaten iptal edilmiş" };

  await prisma.shareLink.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await logAudit(user, "revoke_share_link", "project", link.project.id, link.project.name, {
    shareLinkId: link.id,
    customerLabel: link.customerLabel,
  });

  revalidatePath("/admin/share-links");
  return { success: "Link iptal edildi" };
}
