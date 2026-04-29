import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { AnalizDashboard } from "@/components/ges/analiz-dashboard";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnalizPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id, firmId: user.firmId } });
  if (!project) notFound();
  const detail = await getOrCreateProjectDetail(id);
  return (
    <AnalizDashboard
      projectId={id}
      project={project}
      kesifA={detail.kesifA as unknown as KesifGroup[]}
      kesifB={detail.kesifB as unknown as KesifGroup[]}
      settings={detail.settings as unknown as GesSettings}
      timeline={detail.timeline as unknown as TimelineData}
    />
  );
}
