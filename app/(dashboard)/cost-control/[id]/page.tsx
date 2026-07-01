import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CostProjectDetail } from "@/components/cost-control/cost-project-detail";

export const dynamic = "force-dynamic";

async function getRates() {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000";
    const res = await fetch(`${base}/api/fx/latest`, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      return { usd: Number(d.usd) || 0, eur: Number(d.eur) || 0 };
    }
  } catch {
    /* fallback */
  }
  return { usd: 39.5, eur: 43.0 };
}

export default async function CostProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.costProject.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      lines: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          payments: { orderBy: { paidDate: "desc" } },
          vendor: { select: { id: true, name: true, payAccountName: true, payIban: true } },
          category: { select: { id: true, code: true, name: true } },
        },
      },
      collections: { orderBy: { collectedDate: "desc" } },
      partners: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) notFound();

  const [vendors, categories, rates] = await Promise.all([
    prisma.costVendor.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.costCategoryDef.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    getRates(),
  ]);

  // Serileştir (Date → ISO)
  const data = {
    id: project.id,
    name: project.name,
    customer: project.customer,
    salesPrice: project.salesPrice,
    salesCurrency: project.salesCurrency,
    salesVatRate: project.salesVatRate,
    status: project.status,
    startDate: project.startDate?.toISOString().slice(0, 10) ?? "",
    endDate: project.endDate?.toISOString().slice(0, 10) ?? "",
    notes: project.notes ?? "",
    sourceProjectId: project.sourceProjectId,
    lines: project.lines.map((l) => ({
      id: l.id,
      categoryId: l.categoryId,
      categoryLabel: l.category ? `${l.category.code} ${l.category.name}` : "",
      code: l.code,
      description: l.description,
      model: l.model ?? "",
      brand: l.brand ?? "",
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      currency: l.currency,
      exchangeRate: l.exchangeRate,
      vatRate: l.vatRate,
      isInvoiced: l.isInvoiced,
      vendorId: l.vendorId,
      vendorName: l.vendor?.name ?? "",
      payAccountNameOverride: l.payAccountNameOverride ?? "",
      payIbanOverride: l.payIbanOverride ?? "",
      link: l.link ?? "",
      plannedAmount: l.plannedAmount,
      payments: l.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paidDate: p.paidDate.toISOString().slice(0, 10),
        method: p.method,
        note: p.note ?? "",
      })),
    })),
    collections: project.collections.map((c) => ({
      id: c.id,
      amount: c.amount,
      collectedDate: c.collectedDate.toISOString().slice(0, 10),
      isPlanned: c.isPlanned,
      note: c.note ?? "",
    })),
    partners: project.partners.map((p) => ({ id: p.id, name: p.name, sharePercent: p.sharePercent })),
  };

  const vendorList = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    payAccountName: v.payAccountName ?? "",
    payIban: v.payIban ?? "",
    defaultInvoiced: v.defaultInvoiced,
  }));
  const categoryList = categories.map((c) => ({ id: c.id, code: c.code, name: c.name }));

  return (
    <CostProjectDetail
      data={data}
      vendors={vendorList}
      categories={categoryList}
      rates={rates}
      canEdit={user.platformRole !== "viewer"}
    />
  );
}
