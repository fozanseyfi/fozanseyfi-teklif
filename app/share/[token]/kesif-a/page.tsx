import { KesifEditor } from "@/components/ges/kesif-editor";
import { requireShareTab } from "../_components/share-guard";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareKesifAPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "kesif-a");

  return (
    <KesifEditor
      projectId={ctx.project.id}
      projectName={ctx.project.name || "İsimsiz Proje"}
      type="A"
      data={ctx.detail.kesifA as unknown as KesifGroup[]}
      settings={ctx.detail.settings as unknown as GesSettings}
      firmName={ctx.firmName}
      brand={ctx.brand}
      userEmail=""
    />
  );
}
