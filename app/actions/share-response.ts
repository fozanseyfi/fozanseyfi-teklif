"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendCustomerResponseEmail, type CustomerResponseKind } from "@/lib/email";
import { recordActivity, setPipelineStage } from "@/lib/project-activity";
import { logAudit } from "@/lib/audit-log";
import type { ActivityType, PipelineStage } from "@prisma/client";

const KIND_TO_ACTIVITY: Record<CustomerResponseKind, ActivityType> = {
  accept: "CUSTOMER_ACCEPTED",
  revision: "CUSTOMER_REVISION",
  question: "CUSTOMER_QUESTION",
};

const KIND_TO_STAGE: Record<CustomerResponseKind, PipelineStage | null> = {
  accept: "WON",
  revision: "REVISED",
  question: null, // soru sorma stage'i değiştirmez (zaten UNDER_REVIEW'da olur)
};

const KIND_TO_AUDIT_ACTION: Record<CustomerResponseKind, string> = {
  accept: "customer_accepted",
  revision: "customer_revision_request",
  question: "customer_question",
};

function getAppUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://teklif.fozanseyfi.com";
  return base.replace(/\/+$/, "");
}

/**
 * Public müşteri paylaşım sayfasından gelen yanıtları işler.
 * - Token'ı validate eder
 * - ProjectActivity satırı atar
 * - Pipeline stage'i otomatik günceller (accept→WON, revision→REVISED)
 * - Proje sahibine mail bildirimi gönderir
 * - Audit log girer (actor = müşteri snapshot'ı; internal user değil)
 *
 * Auth gerektirmez — token paylaşım sayfasının kendi izinidir.
 */
export async function submitShareResponse(
  token: string,
  kind: CustomerResponseKind,
  fd: FormData,
): Promise<{ success?: string; error?: string }> {
  if (!token || typeof token !== "string") {
    return { error: "Geçersiz bağlantı" };
  }
  if (!["accept", "revision", "question"].includes(kind)) {
    return { error: "Geçersiz yanıt tipi" };
  }

  const name = ((fd.get("name") as string) ?? "").trim().slice(0, 120);
  const email = ((fd.get("email") as string) ?? "").trim().slice(0, 160);
  const phone = ((fd.get("phone") as string) ?? "").trim().slice(0, 40);
  const message = ((fd.get("message") as string) ?? "").trim().slice(0, 4000);

  if (!name) {
    return { error: "Ad Soyad zorunludur" };
  }
  // Revizyon ve soru için mesaj zorunlu — kabul için opsiyonel.
  if (kind !== "accept" && !message) {
    return { error: "Mesaj alanı zorunludur" };
  }

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          createdById: true,
          createdBy: { select: { email: true, fullName: true } },
          organization: { select: { name: true } },
        },
      },
    },
  });
  if (!link) return { error: "Bağlantı bulunamadı" };
  if (link.revokedAt) return { error: "Bağlantı iptal edilmiş" };
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return { error: "Bağlantının süresi dolmuş" };
  }

  const project = link.project;

  // 1) Activity yaz — phone details içine yazılır (snapshot için)
  await recordActivity({
    projectId: project.id,
    organizationId: project.organizationId,
    type: KIND_TO_ACTIVITY[kind],
    message: message || null,
    customer: { name, email: email || null },
    shareLinkId: link.id,
    details: {
      customerLabel: link.customerLabel ?? null,
      customerPhone: phone || null,
    },
  });

  // 2) Pipeline stage'i güncelle (varsa)
  const targetStage = KIND_TO_STAGE[kind];
  if (targetStage) {
    await setPipelineStage({
      projectId: project.id,
      organizationId: project.organizationId,
      newStage: targetStage,
      customer: { name, email: email || null },
      shareLinkId: link.id,
      reason: kind === "accept" ? "Müşteri kabul etti" : "Müşteri revizyon istedi",
    });
  }

  // 3) Audit log (müşteri snapshot'ı ile — internal actor değil)
  await logAuditAsCustomer(
    project.organizationId,
    name,
    KIND_TO_AUDIT_ACTION[kind],
    project.id,
    project.name,
    {
      shareLinkId: link.id,
      customerName: name,
      customerEmail: email || null,
      customerPhone: phone || null,
      hasMessage: Boolean(message),
    },
  );

  // 4) Proje sahibine mail (varsa)
  if (project.createdBy?.email) {
    await sendCustomerResponseEmail({
      to: project.createdBy.email,
      firmName: project.organization.name,
      projectName: project.name || "Proje",
      customerLabel: link.customerLabel,
      responseKind: kind,
      customerName: name,
      customerEmail: email || null,
      customerPhone: phone || null,
      message: message || null,
      projectUrl: `${getAppUrl()}/projects/${project.id}/detail`,
    });
  }

  const successLabels: Record<CustomerResponseKind, string> = {
    accept: "Teşekkürler! Onayınız iletildi.",
    revision: "Revizyon talebiniz iletildi. Sizinle iletişime geçilecek.",
    question: "Sorunuz iletildi. En kısa sürede yanıtlanacak.",
  };

  return { success: successLabels[kind] };
}

/**
 * Müşteri yanıtları için audit log — actorId yok (internal user değil),
 * sadece müşteri snapshot adı tutulur.
 */
async function logAuditAsCustomer(
  organizationId: string,
  customerLabel: string,
  action: string,
  projectId: string,
  projectName: string,
  details: Record<string, unknown>,
): Promise<void> {
  // logAudit'i bypass et — ProfileWithOrg gerektiriyor. Doğrudan create.
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: null,
        actorEmail: null,
        actorName: customerLabel,
        action,
        resourceType: "project",
        resourceId: projectId,
        resourceName: projectName,
        details: details as never,
      },
    });
  } catch (err) {
    console.warn("[share-response] audit log yazilamadi:", err);
  }
}

/**
 * Dashboard tarafından çağrılan: pipeline stage manuel değiştirme.
 * Internal user erişimi gerek.
 */
export async function updatePipelineStageAction(args: {
  projectId: string;
  newStage: PipelineStage;
  lostReason?: string | null;
  competitorName?: string | null;
}): Promise<{ success?: string; error?: string }> {
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: args.projectId, organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  if (!project) return { error: "Proje bulunamadı" };

  // LOST iken lostReason zorunlu
  if (args.newStage === "LOST" && !args.lostReason) {
    return { error: "Kayıp sebebi seçmelisiniz" };
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      lostReason: args.newStage === "LOST" ? (args.lostReason as never) : null,
      competitorName:
        args.newStage === "LOST" ? args.competitorName?.trim() || null : null,
    },
  });

  const result = await setPipelineStage({
    projectId: project.id,
    organizationId: user.organizationId,
    newStage: args.newStage,
    actor: { id: user.id, email: user.email, fullName: user.fullName },
    reason: "Manuel değişiklik",
  });

  await logAudit(user, "update_pipeline_stage", "project", project.id, project.name, {
    from: result.previousStage,
    to: args.newStage,
    lostReason: args.newStage === "LOST" ? args.lostReason : null,
    competitorName: args.newStage === "LOST" ? args.competitorName : null,
  });

  return { success: "Aşama güncellendi" };
}

/**
 * Dashboard tarafından çağrılan: iç not / aktivite ekleme.
 */
export async function addProjectActivityAction(args: {
  projectId: string;
  type: "INTERNAL_NOTE" | "PHONE_CALL" | "EMAIL_SENT";
  message: string;
}): Promise<{ success?: string; error?: string }> {
  const user = await requireAuth();

  const message = args.message.trim().slice(0, 4000);
  if (!message) return { error: "Mesaj boş olamaz" };

  const project = await prisma.project.findFirst({
    where: { id: args.projectId, organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  if (!project) return { error: "Proje bulunamadı" };

  await recordActivity({
    projectId: project.id,
    organizationId: user.organizationId,
    type: args.type,
    message,
    actor: { id: user.id, email: user.email, fullName: user.fullName },
  });

  await logAudit(user, "add_project_activity", "project", project.id, project.name, {
    type: args.type,
    messageLength: message.length,
  });

  return { success: "Eklendi" };
}