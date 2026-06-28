import { notFound } from "next/navigation";
import { loadShareContext } from "@/lib/share-loader";
import { SHARE_TABS, normalizeTabId } from "@/lib/share-tabs";
import { ShareOverview } from "@/components/shared/share-overview";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareIndexPage({ params }: Props) {
  const { token } = await params;
  const ctx = await loadShareContext(token);
  if (!ctx) notFound();

  // Paylaşıma dahil sekmeler — layout ile aynı normalize mantığı.
  const included = new Set(
    ctx.link.includedTabs
      .map((id) => normalizeTabId(id))
      .filter((id): id is NonNullable<typeof id> => id !== null),
  );
  const tabs = SHARE_TABS.filter((t) => included.has(t.id)).map((t) => ({ id: t.id, label: t.label }));

  const accent = ctx.brand.colorEnabled && ctx.brand.color ? ctx.brand.color : "#059669";

  return (
    <ShareOverview
      firmName={ctx.firmName}
      customerName={ctx.project.customerName}
      projectName={ctx.project.name}
      accent={accent}
      token={token}
      tabs={tabs}
    />
  );
}
