import "server-only";
import { prisma } from "@/lib/prisma";
import type { ActivityType, PipelineStage } from "@prisma/client";

// Pure label/tone sabitleri ayrı dosyada — client tarafı da kullanabilsin.
export {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_TONE,
  ACTIVITY_TYPE_LABELS,
  LOST_REASON_LABELS,
} from "@/lib/pipeline-labels";

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

