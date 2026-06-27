import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RevizelerClient } from "@/components/ges/revizeler-client";
import { parseQuoteItems, parseQuoteMeta, parseQuoteRevisions } from "@/lib/quote";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RevizelerPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { projectDetail: { select: { quoteItems: true, settings: true, quoteRevisions: true } } },
  });
  if (!project) notFound();
  if (project.quoteKind !== "MATERIAL_SERVICE") {
    redirect(`/projects/${id}/detail`);
  }

  const revisions = parseQuoteRevisions(
    project.projectDetail?.quoteRevisions,
    parseQuoteItems(project.projectDetail?.quoteItems),
    parseQuoteMeta(project.projectDetail?.settings),
  );

  return (
    <RevizelerClient projectId={id} projectName={project.name || "Teklif"} revisions={revisions} />
  );
}
