import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus, Phone, Mail, MapPin, Lightbulb } from "lucide-react";
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
      email: latest.customerEmail,
      phone: latest.customerPhone,
      address: latest.customerAddress,
      insights,
      projectCount: projs.length,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
        <div className="space-y-3">
          {customers.map((c) => (
            <Card key={c.name} className="card-lift">
              <CardContent className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-base font-semibold">{c.name}</p>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {c.projectCount} proje
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {c.phone && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-info-soft">
                            <Phone className="size-3 text-info-soft-foreground" />
                          </div>
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary-soft">
                            <Mail className="size-3 text-primary-soft-foreground" />
                          </div>
                          {c.email}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary">
                            <MapPin className="size-3 text-muted-foreground" />
                          </div>
                          {c.address}
                        </span>
                      )}
                    </div>

                    {c.insights.length > 0 && (
                      <div className="mt-3.5 rounded-lg border border-info-soft bg-info-soft/40 p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <Lightbulb className="size-3.5 text-info-soft-foreground" />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-info-soft-foreground">
                            Müşteri Öngörüleri
                          </p>
                        </div>
                        <div className="space-y-1">
                          {c.insights.map((ins, i) => (
                            <p
                              key={i}
                              className="flex gap-1.5 text-xs text-info-soft-foreground"
                            >
                              <span className="shrink-0 font-semibold opacity-60">→</span>
                              {ins}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
