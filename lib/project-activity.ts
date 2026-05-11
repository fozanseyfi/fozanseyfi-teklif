import "server-only";
import { prisma } from "@/lib/prisma";
import type { ActivityType, PipelineStage } from "@prisma/client";

interface RecordActivityArgs {
  projectId: string;
  organizationId: string;
  type: ActivityType;
  message?: string | null;
  // Internal kullanıcı tarafından tetiklendiyse:
  actor?: { id: string; email: string | null; fullName: string | null };
  // Public müşteri tarafından tetiklendiyse:
  customer?: { name?: string | null; email?: string | null };
  shareLinkId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * ProjectActivity satırı ekler. Hata durumunda sessizce yutar (audit-log
 * deseni gibi) — ana akışı bozmasın diye.
 */
export async function recordActivity(args: RecordActivityArgs): Promise<void> {
  try {
    await prisma.projectActivity.create({
      data: {
        projectId: args.projectId,
        organizationId: args.organizationId,
        type: args.type,
        message: args.message ?? null,
        actorId: args.actor?.id ?? null,
        actorEmail: args.actor?.email ?? args.customer?.email ?? null,
        actorName: args.actor?.fullName ?? args.customer?.name ?? null,
        shareLinkId: args.shareLinkId ?? null,
        details: (args.details ?? {}) as never,
      },
    });
  } catch (err) {
    console.warn("[project-activity] failed to record:", err);
  }
}

/**
 * Pipeline stage'i değiştirir + STAGE_CHANGE activity'si yazar.
 * Aynı stage'e set etmeye çalışılırsa no-op.
 */
export async function setPipelineStage(args: {
  projectId: string;
  organizationId: string;
  newStage: PipelineStage;
  actor?: { id: string; email: string | null; fullName: string | null };
  customer?: { name?: string | null; email?: string | null };
  shareLinkId?: string | null;
  reason?: string;
}): Promise<{ changed: boolean; previousStage: PipelineStage | null }> {
  const current = await prisma.project.findUnique({
    where: { id: args.projectId },
    select: { pipelineStage: true },
  });
  if (!current) return { changed: false, previousStage: null };
  if (current.pipelineStage === args.newStage) {
    return { changed: false, previousStage: current.pipelineStage };
  }

  await prisma.project.update({
    where: { id: args.projectId },
    data: { pipelineStage: args.newStage },
  });

  await recordActivity({
    projectId: args.projectId,
    organizationId: args.organizationId,
    type: "STAGE_CHANGE",
    actor: args.actor,
    customer: args.customer,
    shareLinkId: args.shareLinkId ?? null,
    details: {
      from: current.pipelineStage,
      to: args.newStage,
      reason: args.reason ?? null,
    },
  });

  return { changed: true, previousStage: current.pipelineStage };
}

/**
 * Pipeline aşama etiketleri (UI için).
 */
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  SENT: "Gönderildi",
  UNDER_REVIEW: "İnceleniyor",
  REVISED: "Revizyon İstendi",
  WON: "Kazanıldı",
  LOST: "Kaybedildi",
};

/**
 * Stage badge için renk tonları (Tailwind class'ları).
 */
export const PIPELINE_STAGE_TONE: Record<PipelineStage, string> = {
  SENT: "border-sky-200 bg-sky-50 text-sky-700",
  UNDER_REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  REVISED: "border-violet-200 bg-violet-50 text-violet-700",
  WON: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LOST: "border-rose-200 bg-rose-50 text-rose-700",
};

/**
 * Activity tipi etiketleri (timeline UI için).
 */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CUSTOMER_VIEWED: "Müşteri paylaşımı görüntüledi",
  CUSTOMER_ACCEPTED: "Müşteri kabul etti",
  CUSTOMER_REVISION: "Müşteri revizyon istedi",
  CUSTOMER_QUESTION: "Müşteri soru sordu",
  INTERNAL_NOTE: "İç not",
  PHONE_CALL: "Telefon görüşmesi",
  EMAIL_SENT: "Mail gönderildi",
  STAGE_CHANGE: "Aşama değişti",
};

export const LOST_REASON_LABELS: Record<string, string> = {
  PRICE: "Fiyat",
  TECHNICAL: "Teknik",
  REFERENCE: "Referans",
  TIMING: "Zamanlama",
  RELATIONSHIP: "Müşteri ilişkisi",
  OTHER: "Diğer",
};
