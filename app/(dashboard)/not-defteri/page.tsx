import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBrandSettings } from "@/lib/pdf-brand";
import { getNotebook } from "@/app/actions/notebook";
import { NotebookApp } from "@/components/notebook/notebook-app";
import type { PrintBrand } from "@/lib/notebook/util";

export const metadata = { title: "Not Defteri" };

export default async function NotDefteriPage() {
  const user = await requireAuth();
  const [data, org] = await Promise.all([
    getNotebook(),
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
  ]);
  const b = parseBrandSettings(org?.brandSettings);
  const brand: PrintBrand = {
    firm: b.payCompanyName || org?.name || "Firma",
    accent: b.colorEnabled && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(b.color || "") ? (b.color as string) : "#059669",
    logoUrl: b.logoEnabled && b.logoUrl ? b.logoUrl : undefined,
  };
  return <NotebookApp initial={data} brand={brand} />;
}
