import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCatalog } from "@/app/actions/quote";
import { QuoteItemsEditor } from "@/components/ges/quote-items-editor";
import { parseQuoteItems, parseQuoteMeta } from "@/lib/quote";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuoteItemsPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { projectDetail: { select: { quoteItems: true, settings: true } } },
  });
  if (!project) notFound();
  // Yanlış tip — anahtar teslim projeyse buraya gelmesin.
  if (project.quoteKind !== "MATERIAL_SERVICE") {
    redirect(`/projects/${id}/detail`);
  }

  const items = parseQuoteItems(project.projectDetail?.quoteItems);
  const meta = parseQuoteMeta(project.projectDetail?.settings);
  const catalog = await getCatalog();

  return (
    <QuoteItemsEditor
      projectId={id}
      projectName={project.name || "Yeni Teklif"}
      initialItems={items}
      initialMeta={meta}
      catalog={catalog}
    />
  );
}
