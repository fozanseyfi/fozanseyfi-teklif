import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { GesSettingsEditor } from "@/components/ges/ges-settings-editor";
import type { GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GesSettingsPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!project) notFound();

  const detail = await getOrCreateProjectDetail(id);

  return (
    <GesSettingsEditor
      projectId={id}
      data={detail.settings as unknown as GesSettings}
    />
  );
}
