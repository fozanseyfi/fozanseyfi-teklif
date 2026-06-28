import { requireShareTab } from "../_components/share-guard";
import { ShareDocFrame } from "@/components/shared/share-doc-frame";
import { buildPricedBoqSummaryHtml } from "@/lib/share-print/priced-boq";
import { resolveBrand } from "@/lib/pdf-brand";
import { CUSTOMER_TAB_INFO } from "@/lib/share-tabs";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharePricedBoqSummaryPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "priced-boq-summary");
  const html = buildPricedBoqSummaryHtml({
    project: ctx.project,
    projectName: ctx.project.name || "İsimsiz Proje",
    kesifA: ctx.detail.kesifA as unknown as KesifGroup[],
    kesifB: ctx.detail.kesifB as unknown as KesifGroup[],
    settings: ctx.detail.settings as unknown as GesSettings,
    brand: resolveBrand(ctx.brand),
    firmName: ctx.firmName,
    userEmail: "",
  });
  return (
    <ShareDocFrame
      html={html}
      title={CUSTOMER_TAB_INFO["priced-boq-summary"].label}
      desc={CUSTOMER_TAB_INFO["priced-boq-summary"].desc}
    />
  );
}
