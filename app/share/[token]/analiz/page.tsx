import { AnalizDashboard } from "@/components/ges/analiz-dashboard";
import { requireShareTab } from "../_components/share-guard";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareAnalizPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "analiz");

  return (
    <AnalizDashboard
      projectId={ctx.project.id}
      project={ctx.project}
      kesifA={ctx.detail.kesifA as unknown as KesifGroup[]}
      kesifB={ctx.detail.kesifB as unknown as KesifGroup[]}
      settings={ctx.detail.settings as unknown as GesSettings}
      timeline={ctx.detail.timeline as unknown as TimelineData}
      firmName={ctx.firmName}
      brand={ctx.brand}
      userEmail=""
    />
  );
}
