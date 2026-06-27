import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteOutput } from "@/components/ges/quote-output";
import { parseQuoteItems, parseQuoteMeta } from "@/lib/quote";
import { parseBrandSettings } from "@/lib/pdf-brand";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuotePdfPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { projectDetail: { select: { quoteItems: true, settings: true } } },
  });
  if (!project) notFound();
  if (project.quoteKind !== "MATERIAL_SERVICE") {
    redirect(`/projects/${id}/detail`);
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true, brandSettings: true },
  });

  return (
    <QuoteOutput
      projectId={id}
      quoteTitle={project.name || "Teklif"}
      customer={{
        name: project.customerName,
        email: project.customerEmail,
        phone: project.customerPhone,
        address: project.customerAddress,
        location: project.projectLocation,
      }}
      items={parseQuoteItems(project.projectDetail?.quoteItems)}
      meta={parseQuoteMeta(project.projectDetail?.settings)}
      brand={parseBrandSettings(org?.brandSettings)}
      firmName={org?.name ?? "Firma"}
      userEmail={user.email ?? ""}
    />
  );
}
