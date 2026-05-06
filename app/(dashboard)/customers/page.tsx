import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus, ArrowRight } from "lucide-react";
import type { GesSettings } from "@/lib/ges-defaults";

export default async function CustomersPage() {
  const user = await requireAuth();

  const projects = await prisma.project.findMany({
    where: { firmId: user.firmId, customerName: { not: "" } },
    orderBy: { updatedAt: "desc" },
    include: { projectDetail: { select: { settings: true } } },
  });

  const customerMap = new Map<string, typeof projects>();
  for (const p of projects) {
    const name = p.customerName || "—";
    if (!customerMap.has(name)) customerMap.set(name, []);
    customerMap.get(name)!.push(p);
  }

  const customers = Array.from(customerMap.entries()).map(([name, projs]) => {
    const latest = projs[0];
    const settings = latest.projectDetail?.settings as GesSettings | null;
    const insights: string[] = settings?.customerInsights ?? [];
    return {
      name,
      slug: encodeURIComponent(name),
      email: latest.customerEmail,
      phone: latest.customerPhone,
      address: latest.customerAddress,
      insights,
      projectCount: projs.length,
      lastTouched: projs.reduce(
        (max, p) => (p.updatedAt > max ? p.updatedAt : max),
        projs[0].updatedAt,
      ),
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Müşteriler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {customers.length} müşteri
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            Yeni Proje / Müşteri
          </Link>
        </Button>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <Users className="size-8 text-muted-foreground" />
            </div>
            <p className="font-semibold">Henüz müşteri yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Proje oluşturarak müşteri ekleyin
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Müşteri
                    </th>
                    <th className="hidden px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      İletişim
                    </th>
                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Proje
                    </th>
                    <th className="hidden px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Öngörü
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => (
                    <tr
                      key={c.name}
                      className="group transition-colors hover:bg-muted/40"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{c.name}</p>
                            {c.address && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {c.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 md:table-cell">
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {c.phone && <p className="font-medium text-foreground">{c.phone}</p>}
                          {c.email && <p className="truncate">{c.email}</p>}
                          {!c.phone && !c.email && <span>—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {c.projectCount}
                        </span>
                      </td>
                      <td className="hidden px-6 py-4 text-center sm:table-cell">
                        {c.insights.length > 0 ? (
                          <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info-soft-foreground">
                            {c.insights.length} not
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/customers/${c.slug}`}>
                              Git <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
