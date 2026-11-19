import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectDetail } from "@/app/actions/ges";
import { QuoteOutput } from "@/components/ges/quote-output";
import { parseBrandSettings } from "@/lib/pdf-brand";
import { buildEpcQuote } from "@/lib/epc-quote";

interface Props {
  params: Promise<{ id: string }>;
}

/** Çıktılar → Teklif: anahtar teslim projenin tek kalemli ana teklifi (PDF + önizleme). */
export default async function AnaTeklifPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const [project, org] = await Promise.all([
    prisma.project.findFirst({ where: { id, organizationId: user.organizationId } }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true, brandSettings: true },
    }),
  ]);
  if (!project) notFound();
  if (project.quoteKind === "MATERIAL_SERVICE") redirect(`/projects/${id}/detail/quote-pdf`);

  const detail = await getOrCreateProjectDetail(id);
  const { items, meta } = buildEpcQuote(project, detail);

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
      revisions={[{ id: "ana", label: "Ana teklif", createdAt: new Date().toISOString(), items, meta }]}
      brand={parseBrandSettings(org?.brandSettings)}
      firmName={org?.name ?? "Firma"}
      userEmail={user.email ?? ""}
      backHref={`/projects/${id}/detail/analiz`}
      emptyHint="Satış fiyatı henüz oluşmadı. Önce Keşif ve Analiz adımlarını tamamlayın."
    />
  );
}
