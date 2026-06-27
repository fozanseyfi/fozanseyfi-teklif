import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteAnaliz } from "@/components/ges/quote-analiz";
import { parseQuoteItems, parseQuoteMeta } from "@/lib/quote";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuoteAnalizPage({ params }: Props) {
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

  return (
    <QuoteAnaliz
      projectId={id}
      projectName={project.name || "Yeni Teklif"}
      initialItems={parseQuoteItems(project.projectDetail?.quoteItems)}
      initialMeta={parseQuoteMeta(project.projectDetail?.settings)}
    />
  );
}
