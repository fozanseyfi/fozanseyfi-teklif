"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit-log";
import { sendShareLinkEmail } from "@/lib/email";
import { setPipelineStage } from "@/lib/project-activity";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import {
  SHARE_TABS,
  VALID_TAB_IDS,
  PRESET_DAYS,
  isDocTabId,
  extractDocId,
  type SharePreset,
} from "@/lib/share-tabs";
import { parseBrandSettings } from "@/lib/pdf-brand";

function generateToken(): string {
  // 32 char base62 → ~190 bit entropy. URL-safe, predict edilemez.
  return randomBytes(24).toString("base64url");
}

function getAppUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://teklif.fozanseyfi.com";
  return base.replace(/\/+$/, "");
}

function tabLabelsFor(tabIds: string[]): string[] {
  return tabIds
    .map((id) => SHARE_TABS.find((t) => t.id === id)?.label)
    .filter((l): l is string => Boolean(l));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createShareLink(fd: FormData): Promise<{
  success?: string;
  error?: string;
  url?: string;
  emailSent?: boolean;
  emailError?: string;
}> {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Yetkin yok" };

  const projectId = (fd.get("projectId") as string)?.trim();
  const customerLabel = ((fd.get("customerLabel") as string) ?? "").trim();
  const recipientEmail = ((fd.get("recipientEmail") as string) ?? "").trim();
  const preset = (fd.get("preset") as SharePreset) ?? "7d";
  const tabsRaw = fd.getAll("tabs") as string[];

  if (!projectId) return { error: "Proje seçilmedi" };
  if (!(preset in PRESET_DAYS)) return { error: "Süre geçersiz" };
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    return { error: "E-posta adresi geçersiz" };
  }
  // Tab id'leri: sabit + ek belge "doc:xxx" entry'leri. İkisi de validate
  // edilir; geçerli olmayanlar atılır.
  const orgForDocs = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { brandSettings: true },
  });
  const brandForDocs = parseBrandSettings(orgForDocs?.brandSettings);
  const validDocIds = new Set((brandForDocs.customDocuments ?? []).map((d) => d.id));
  const sabitTabs = tabsRaw.filter((t) => !isDocTabId(t) && VALID_TAB_IDS.has(t));
  const docTabs = tabsRaw
    .filter((t) => isDocTabId(t))
    .filter((t) => {
      const docId = extractDocId(t);
      return docId !== null && validDocIds.has(docId);
    });
  const tabs = [...sabitTabs, ...docTabs];
  if (tabs.length === 0) return { error: "En az bir bölüm veya belge seçmelisin" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    select: { id: true, name: true, pipelineStage: true },
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
      recipientEmail: recipientEmail || null,
      includedTabs: tabs as never,
      expiresAt,
    },
  });

  // Pipeline aşaması: henüz pipeline'a girmemişse SENT'e at. Daha ileri
  // bir aşamadaysa (UNDER_REVIEW, REVISED, WON, LOST) dokunma.
  if (project.pipelineStage === null) {
    await setPipelineStage({
      projectId: project.id,
      organizationId: user.organizationId,
      newStage: "SENT",
      actor: { id: user.id, email: user.email, fullName: user.fullName },
      shareLinkId: link.id,
      reason: "Paylaşım linki oluşturuldu",
    });
  }

  await logAudit(user, "create_share_link", "project", project.id, project.name, {
    shareLinkId: link.id,
    customerLabel: customerLabel || null,
    recipientEmail: recipientEmail || null,
    tabs,
    preset,
    expiresAt: expiresAt?.toISOString() ?? null,
  });

  // E-posta atılır (kullanıcı email girdiyse). Hata durumunda toast'la bilgi
  // ver, link yine de oluşturulmuş olur (mail asenkron yan iş).
  let emailSent = false;
  let emailError: string | undefined;
  if (recipientEmail) {
    // Gmail SMTP quota koruma: kullanıcı başına saatte N mail.
    const rate = await checkRateLimit("mail-send", user.id);
    if (!rate.success) {
      return {
        success: "Paylaşım linki oluşturuldu (mail saatlik limite ulaştı)",
        url: link.token,
        emailSent: false,
        emailError: "Saatlik mail limiti aşıldı, sonra 'Tekrar Mail At' deneyin",
      };
    }
    const result = await sendShareLinkEmail({
      to: recipientEmail,
      firmName: user.organization.name,
      projectName: project.name || "Proje",
      customerLabel: customerLabel || null,
      shareUrl: `${getAppUrl()}/share/${link.token}`,
      expiresAt,
      includedTabLabels: tabLabelsFor(tabs),
    });
    emailSent = result.sent;
    emailError = result.error;

    if (emailSent) {
      await logAudit(user, "send_share_email", "project", project.id, project.name, {
        shareLinkId: link.id,
        recipientEmail,
      });
    }
  }

  revalidatePath("/admin/share-links");

  return {
    success: "Paylaşım linki oluşturuldu",
    url: link.token,
    emailSent,
    emailError,
  };
}

export async function resendShareLinkEmail(
  id: string,
): Promise<{ success?: string; error?: string }> {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Yetkin yok" };

  const link = await prisma.shareLink.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!link) return { error: "Link bulunamadı" };
  if (link.revokedAt) return { error: "İptal edilmiş linkin maili gönderilemez" };
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return { error: "Süresi dolmuş linkin maili gönderilemez" };
  }
  if (!link.recipientEmail) {
    return { error: "Bu linkte kayıtlı bir e-posta adresi yok" };
  }

  const tabs = Array.isArray(link.includedTabs)
    ? (link.includedTabs as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

  const result = await sendShareLinkEmail({
    to: link.recipientEmail,
    firmName: user.organization.name,
    projectName: link.project.name || "Proje",
    customerLabel: link.customerLabel,
    shareUrl: `${getAppUrl()}/share/${link.token}`,
    expiresAt: link.expiresAt,
    includedTabLabels: tabLabelsFor(tabs),
  });

  if (!result.sent) {
    return { error: result.error ?? "Mail gönderilemedi" };
  }

  await logAudit(user, "send_share_email", "project", link.project.id, link.project.name, {
    shareLinkId: link.id,
    recipientEmail: link.recipientEmail,
    resend: true,
  });

  return { success: `Mail ${link.recipientEmail} adresine gönderildi` };
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
