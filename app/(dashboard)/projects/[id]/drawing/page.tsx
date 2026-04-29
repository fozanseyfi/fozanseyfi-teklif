import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { GesSettings } from "@/lib/ges-defaults";
import { RoofPhaseLoader } from "@/components/ges/roof-phase-loader";

export default async function DrawingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id, firmId: user.firmId } });
  if (!project) notFound();

  const detail = await prisma.projectDetail.findUnique({ where: { projectId: id } });
  const settings = (detail?.settings || {}) as unknown as GesSettings;

  return (
    <div className="fixed inset-0 left-64 z-50 overflow-hidden">
      <RoofPhaseLoader projectId={id} settings={settings} />
    </div>
  );
}
