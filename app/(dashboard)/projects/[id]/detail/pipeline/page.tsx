import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PipelineClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PipelinePage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      customerName: true,
      pipelineStage: true,
      lostReason: true,
      competitorName: true,
      createdAt: true,
    },
  });
  if (!project) notFound();

  const activities = await prisma.projectActivity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      shareLink: { select: { token: true, customerLabel: true } },
    },
  });

  const activityRows = activities.map((a) => ({
    id: a.id,
    type: a.type,
    message: a.message,
    actorName: a.actorName,
    actorEmail: a.actorEmail,
    shareLinkToken: a.shareLink?.token ?? null,
    shareLinkLabel: a.shareLink?.customerLabel ?? null,
    details: a.details as Record<string, unknown>,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <PipelineClient
      project={{
        id: project.id,
        name: project.name,
        customerName: project.customerName,
        pipelineStage: project.pipelineStage,
        lostReason: project.lostReason,
        competitorName: project.competitorName,
        createdAt: project.createdAt.toISOString(),
      }}
      activities={activityRows}
    />
  );
}
