import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { DorEditor } from "@/components/ges/dor-editor";
import { parseBrandSettings } from "@/lib/pdf-brand";
import type { DorGroup } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DorPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const [project, org] = await Promise.all([
    prisma.project.findFirst({ where: { id, organizationId: user.organizationId } }),
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
  ]);
  if (!project) notFound();

  const detail = await getOrCreateProjectDetail(id);

  return (
    <DorEditor
      projectId={id}
      projectName={project.name || "İsimsiz Proje"}
      data={detail.dor as unknown as DorGroup[]}
      firmName={org?.name ?? "Firma"}
      brand={parseBrandSettings(org?.brandSettings)}
      userEmail={user.email ?? ""}
    />
  );
}
