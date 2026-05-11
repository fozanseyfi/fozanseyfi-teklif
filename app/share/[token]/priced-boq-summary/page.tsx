import { PricedBoQ } from "@/components/ges/priced-boq";
import { requireShareTab } from "../_components/share-guard";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharePricedBoqSummaryPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "priced-boq-summary");

  return (
    <PricedBoQ
      projectId={ctx.project.id}
      projectName={ctx.project.name || "İsimsiz Proje"}
      project={ctx.project}
      kesifA={ctx.detail.kesifA as unknown as KesifGroup[]}
      kesifB={ctx.detail.kesifB as unknown as KesifGroup[]}
      settings={ctx.detail.settings as unknown as GesSettings}
      firmName={ctx.firmName}
      brand={ctx.brand}
      userEmail=""
      mode="summary"
    />
  );
}
