import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { TeklifEditor } from "@/components/ges/teklif-editor";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TeklifPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id, firmId: user.firmId } });
  if (!project) notFound();
  const detail = await getOrCreateProjectDetail(id);
  return (
    <TeklifEditor
      projectId={id}
      projectName={project.name}
      customerName={project.customerName}
      kesifA={detail.kesifA as unknown as KesifGroup[]}
      kesifB={detail.kesifB as unknown as KesifGroup[]}
      settings={detail.settings as unknown as GesSettings}
      status={project.status}
    />
  );
}
