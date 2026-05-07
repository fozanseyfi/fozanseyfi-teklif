import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { TeknikForm } from "@/components/ges/teknik-form";
import type { GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TeknikPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id, firmId: user.firmId } });
  if (!project) notFound();
  const detail = await getOrCreateProjectDetail(id);
  return (
    <TeknikForm
      projectId={id}
      projectName={project.name || "İsimsiz Proje"}
      settings={detail.settings as unknown as GesSettings}
    />
  );
}
