import { requireShareTab } from "../_components/share-guard";
import { ShareDocFrame } from "@/components/shared/share-doc-frame";
import { buildKesifPrintHtml } from "@/lib/share-print/kesif";
import { getGrpTot } from "@/lib/ges-engine";
import { resolveBrand } from "@/lib/pdf-brand";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareKesifAPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "kesif-a");
  const groups = ctx.detail.kesifA as unknown as KesifGroup[];
  const settings = ctx.detail.settings as unknown as GesSettings;
  const grandTotal = groups.reduce((s, g) => s + getGrpTot(g, settings), 0);
  const html = buildKesifPrintHtml({
    title: "Keşif-A — Doğrudan Maliyetler",
    groups,
    settings,
    grandTotal,
    brand: resolveBrand(ctx.brand),
    firmName: ctx.firmName,
    userEmail: "",
  });
  return <ShareDocFrame html={html} title="Keşif-A" />;
}
