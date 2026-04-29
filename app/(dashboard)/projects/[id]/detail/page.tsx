import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { ProjeBilgileriForm } from "@/components/ges/proje-bilgileri-form";
import type { GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjeDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, firmId: user.firmId },
  });
  if (!project) notFound();

  const detail = await getOrCreateProjectDetail(id);
  const settings = detail.settings as unknown as GesSettings;

  // Derive unique customers from all projects of this firm
  const projectsWithCustomers = await prisma.project.findMany({
    where: { firmId: user.firmId, customerName: { not: "" } },
    orderBy: { updatedAt: "desc" },
    select: { customerName: true, customerEmail: true, customerPhone: true, customerAddress: true },
  });

  const customerMap = new Map<string, { name: string; email: string | null; phone: string | null; address: string | null }>();
  for (const p of projectsWithCustomers) {
    if (p.customerName && !customerMap.has(p.customerName)) {
      customerMap.set(p.customerName, {
        name: p.customerName,
        email: p.customerEmail ?? null,
        phone: p.customerPhone ?? null,
        address: p.customerAddress ?? null,
      });
    }
  }
  const customers = Array.from(customerMap.values());

  return (
    <ProjeBilgileriForm
      projectId={id}
      project={project}
      il={settings.il || ""}
      ilce={settings.ilce || ""}
      settings={settings}
      customers={customers}
    />
  );
}
