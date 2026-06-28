import { requireShareTab } from "../_components/share-guard";
import { ShareDocFrame } from "@/components/shared/share-doc-frame";
import { buildDorPrintHtml } from "@/lib/share-print/dor";
import { resolveBrand } from "@/lib/pdf-brand";
import { CUSTOMER_TAB_INFO } from "@/lib/share-tabs";
import type { DorGroup } from "@/lib/ges-defaults";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareDorPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "dor");
  const html = buildDorPrintHtml({
    projectName: ctx.project.name || "İsimsiz Proje",
    groups: ctx.detail.dor as unknown as DorGroup[],
    brand: resolveBrand(ctx.brand),
    firmName: ctx.firmName,
    userEmail: "",
  });
  return (
    <ShareDocFrame
      html={html}
      title={CUSTOMER_TAB_INFO["dor"].label}
      desc={CUSTOMER_TAB_INFO["dor"].desc}
    />
  );
}
