import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VendorsClient } from "@/components/cost-control/vendors-client";
import { lineNetTL } from "@/lib/cost-control";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const user = await requireAuth();
  const vendors = await prisma.costVendor.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    include: {
      lines: {
        select: {
          quantity: true,
          unitPrice: true,
          exchangeRate: true,
          costProject: { select: { id: true, name: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  });

  const rows = vendors.map((v) => {
    let net = 0;
    let paid = 0;
    const projectIds = new Set<string>();
    for (const l of v.lines) {
      net += lineNetTL(l);
      paid += l.payments.reduce((s, p) => s + p.amount, 0);
      if (l.costProject) projectIds.add(l.costProject.id);
    }
    return {
      id: v.id,
      name: v.name,
      email: v.email ?? "",
      phone: v.phone ?? "",
      taxNo: v.taxNo ?? "",
      defaultInvoiced: v.defaultInvoiced,
      payAccountName: v.payAccountName ?? "",
      payIban: v.payIban ?? "",
      bank: v.bank ?? "",
      notes: v.notes ?? "",
      lineCount: v.lines.length,
      projectCount: projectIds.size,
      totalNetTL: net,
      totalPaidTL: paid,
    };
  });

  return <VendorsClient vendors={rows} canEdit={user.platformRole !== "viewer"} />;
}
