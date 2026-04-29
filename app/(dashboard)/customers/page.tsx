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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
          <p className="text-slate-500 text-sm mt-0.5">{customers.length} müşteri</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="w-4 h-4" />
            Yeni Proje / Müşteri
          </Link>
        </Button>
      </div>

      {customers.length === 0 ? (
        <Card className="border-0 shadow-md shadow-slate-200/60">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)" }}>
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Henüz müşteri yok</p>
            <p className="text-slate-400 text-sm mt-1">Proje oluşturarak müşteri ekleyin</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <Card key={c.name} className="border-0 shadow-md shadow-slate-200/50 hover:shadow-lg hover:shadow-slate-200/60 transition-shadow">
              <CardContent className="py-5 px-6">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-base"
                    style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)", boxShadow: "0 4px 12px rgba(15,31,61,0.25)" }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-bold text-slate-900 text-base">{c.name}</p>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                        {c.projectCount} proje
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {c.phone && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Phone className="w-3 h-3 text-blue-500" />
                          </div>
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-3 h-3 text-amber-500" />
                          </div>
                          {c.email}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-3 h-3 text-slate-400" />
                          </div>
                          {c.address}
                        </span>
                      )}
                    </div>

                    {c.insights.length > 0 && (
                      <div className="mt-3.5 rounded-xl p-3" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", border: "1px solid #bfdbfe" }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Lightbulb className="w-3.5 h-3.5 text-blue-500" />
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Müşteri Öngörüleri</p>
                        </div>
                        <div className="space-y-1">
                          {c.insights.map((ins, i) => (
                            <p key={i} className="text-xs text-blue-800 flex gap-1.5">
                              <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
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
