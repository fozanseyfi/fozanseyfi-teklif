import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBrandSettings, resolveBrand } from "@/lib/pdf-brand";
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
  // Teklif (malzeme/hizmet) PDF'iyle aynı brand çözümü: accent + accent-light + varsa logo/slogan.
  const rb = resolveBrand(parseBrandSettings(org?.brandSettings));
  const brand: PrintBrand = {
    accent: rb.primary,
    accentLight: rb.primaryLight + "22",
    logoUrl: rb.showLogo ? rb.logoUrl : undefined,
    slogan: rb.showSlogan ? rb.slogan : undefined,
  };
  // Silme yetkisi yalnızca tam yetkili (admin) rolünde — kullanıcı/görüntüleyici silemez.
  return <NotebookApp initial={data} brand={brand} canDelete={user.platformRole === "admin"} />;
}
