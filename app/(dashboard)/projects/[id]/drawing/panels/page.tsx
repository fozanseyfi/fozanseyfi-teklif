import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import type { GesSettings } from "@/lib/ges-defaults";
import { PanelPhaseLoader } from "@/components/ges/panel-phase-loader";

export default async function DrawingPanelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id, firmId: user.firmId } });
  if (!project) notFound();

  const detail = await prisma.projectDetail.findUnique({ where: { projectId: id } });
  const settings = (detail?.settings || {}) as unknown as GesSettings;

  if (!settings.haritaRoofs?.length) {
    redirect(`/projects/${id}/drawing`);
  }

  return (
    <div className="fixed inset-0 left-64 z-50 overflow-hidden">
      <PanelPhaseLoader projectId={id} settings={settings} />
    </div>
  );
}
