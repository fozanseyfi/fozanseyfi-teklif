import { requireShareTab } from "../_components/share-guard";
import { ShareDocFrame } from "@/components/shared/share-doc-frame";
import { buildBoqPrintHtml } from "@/lib/share-print/boq";
import { resolveBrand } from "@/lib/pdf-brand";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareBoqPricedPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "boq-priced");
  const html = buildBoqPrintHtml({
    project: ctx.project,
    projectName: ctx.project.name || "İsimsiz Proje",
    kesifA: ctx.detail.kesifA as unknown as KesifGroup[],
    kesifB: ctx.detail.kesifB as unknown as KesifGroup[],
    settings: ctx.detail.settings as unknown as GesSettings,
    brand: resolveBrand(ctx.brand),
    firmName: ctx.firmName,
    userEmail: "",
    showPrices: true,
  });
  return <ShareDocFrame html={html} title="Fiyatlı BoQ" />;
}
