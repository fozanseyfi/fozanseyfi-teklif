import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, PROJECT_STATUS_LABELS, INSTALLATION_TYPE_LABELS } from "@/lib/utils";
import { Plus, FolderOpen } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  SENT: "default",
};

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const user = await requireAuth();

  const projects = await prisma.project.findMany({
    where: {
      firmId: user.firmId,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { pricingSnapshot: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projeler</h1>
          <p className="text-slate-500 text-sm mt-0.5">{projects.length} proje bulundu</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="w-4 h-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 flex-wrap">
        {[undefined, "DRAFT", "IN_PROGRESS", "COMPLETED", "SENT"].map((s) => {
          const isActive = status === s || (!status && !s);
          return (
            <Link
              key={s ?? "all"}
              href={s ? `/projects?status=${s}` : "/projects"}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? "text-white shadow-md shadow-amber-500/25"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              style={isActive ? { background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)" } : {}}
            >
              {s ? PROJECT_STATUS_LABELS[s] : "Tümü"}
            </Link>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Proje bulunamadı</p>
            <p className="text-slate-400 text-sm mt-1">Yeni bir proje oluşturarak başlayın</p>
            <Button asChild className="mt-5">
              <Link href="/projects/new">
                <Plus className="w-4 h-4" />
                İlk Projeyi Oluştur
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100" style={{ background: "#f8fafc" }}>
                    <th className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-widest">Proje</th>
                    <th className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-widest hidden md:table-cell">Müşteri</th>
                    <th className="text-right px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-widest hidden lg:table-cell">Güç</th>
                    <th className="text-right px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-widest hidden lg:table-cell">Fiyat</th>
                    <th className="text-center px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-widest">Durum</th>
                    <th className="text-right px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-widest hidden sm:table-cell">Tarih</th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 rounded-full flex-shrink-0"
                            style={{
                              background: project.status === "COMPLETED"
                                ? "linear-gradient(180deg,#10b981,#059669)"
                                : project.status === "IN_PROGRESS"
                                ? "linear-gradient(180deg,#f59e0b,#ea580c)"
                                : project.status === "SENT"
                                ? "linear-gradient(180deg,#3b82f6,#6366f1)"
                                : "linear-gradient(180deg,#cbd5e1,#94a3b8)"
                            }} />
                          <div>
                            <p className="font-semibold text-slate-800 group-hover:text-slate-900">{project.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{INSTALLATION_TYPE_LABELS[project.installationType]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 hidden md:table-cell font-medium">
                        {project.customerName}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 hidden lg:table-cell font-semibold">
                        {project.totalPowerKw > 0 ? `${project.totalPowerKw.toFixed(1)} kWp` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-amber-600 hidden lg:table-cell">
                        {project.pricingSnapshot
                          ? formatCurrency(project.pricingSnapshot.finalSalePrice)
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={STATUS_VARIANT[project.status]}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-400 text-xs hidden sm:table-cell">
                        {formatDate(project.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild className="rounded-xl">
                            <Link href={`/projects/${project.id}/detail`}>Düzenle</Link>
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
