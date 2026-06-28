import { requireShareTab } from "../_components/share-guard";
import { ShareDocFrame } from "@/components/shared/share-doc-frame";
import { buildPricedBoqDetailedHtml } from "@/lib/share-print/priced-boq";
import { resolveBrand } from "@/lib/pdf-brand";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharePricedBoqDetailedPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "priced-boq-detailed");
  const html = buildPricedBoqDetailedHtml({
    project: ctx.project,
    projectName: ctx.project.name || "İsimsiz Proje",
    kesifA: ctx.detail.kesifA as unknown as KesifGroup[],
    kesifB: ctx.detail.kesifB as unknown as KesifGroup[],
    settings: ctx.detail.settings as unknown as GesSettings,
    brand: resolveBrand(ctx.brand),
    firmName: ctx.firmName,
    userEmail: "",
  });
  return <ShareDocFrame html={html} title="Detaylı Teklif (P-BoQ)" />;
}
