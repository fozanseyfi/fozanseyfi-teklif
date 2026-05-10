import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { BoQView } from "@/components/ges/boq-view";
import { parseBrandSettings } from "@/lib/pdf-brand";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BoQPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const [project, org] = await Promise.all([
    prisma.project.findFirst({ where: { id, organizationId: user.organizationId } }),
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
  ]);
  if (!project) notFound();

  const detail = await getOrCreateProjectDetail(id);

  return (
    <BoQView
      projectId={id}
      projectName={project.name || "İsimsiz Proje"}
      project={project}
      kesifA={detail.kesifA as unknown as KesifGroup[]}
      kesifB={detail.kesifB as unknown as KesifGroup[]}
      settings={detail.settings as unknown as GesSettings}
      firmName={org?.name ?? "Firma"}
      brand={parseBrandSettings(org?.brandSettings)}
      userEmail={user.email ?? ""}
    />
  );
}
