import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { KesifEditor } from "@/components/ges/kesif-editor";
import { parseBrandSettings } from "@/lib/pdf-brand";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KesifBPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const [project, org] = await Promise.all([
    prisma.project.findFirst({ where: { id, organizationId: user.organizationId } }),
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
  ]);
  if (!project) notFound();

  const detail = await getOrCreateProjectDetail(id);

  return (
    <KesifEditor
      projectId={id}
      projectName={project.name || "İsimsiz Proje"}
      type="B"
      data={detail.kesifB as unknown as KesifGroup[]}
      settings={detail.settings as unknown as GesSettings}
      firmName={org?.name ?? "Firma"}
      brand={parseBrandSettings(org?.brandSettings)}
      userEmail={user.email ?? ""}
    />
  );
}
