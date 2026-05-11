import { DorEditor } from "@/components/ges/dor-editor";
import { requireShareTab } from "../_components/share-guard";
import type { DorGroup } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareDorPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "dor");

  return (
    <DorEditor
      projectId={ctx.project.id}
      projectName={ctx.project.name || "İsimsiz Proje"}
      data={ctx.detail.dor as unknown as DorGroup[]}
      firmName={ctx.firmName}
      brand={ctx.brand}
      userEmail=""
    />
  );
}
