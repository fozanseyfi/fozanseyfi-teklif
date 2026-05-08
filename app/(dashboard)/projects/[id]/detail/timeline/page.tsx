import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { TimelineEditor } from "@/components/ges/timeline-editor";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TimelinePage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!project) notFound();

  const detail = await getOrCreateProjectDetail(id);

  return (
    <TimelineEditor
      projectId={id}
      projectName={project.name || "İsimsiz Proje"}
      data={detail.timeline as unknown as TimelineData}
      kesifA={detail.kesifA as unknown as KesifGroup[]}
      kesifB={detail.kesifB as unknown as KesifGroup[]}
      settings={detail.settings as unknown as GesSettings}
    />
  );
}
