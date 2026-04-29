import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { FizibiliteForm } from "@/components/ges/fizibilite-form";
import type { GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FizibilitePage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id, firmId: user.firmId } });
  if (!project) notFound();
  const detail = await getOrCreateProjectDetail(id);
  return (
    <FizibiliteForm
      projectId={id}
      settings={detail.settings as unknown as GesSettings}
      totalPowerKw={project.totalPowerKw}
    />
  );
}
