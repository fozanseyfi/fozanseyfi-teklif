import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, PROJECT_STATUS_LABELS } from "@/lib/utils";
import { FolderOpen, Plus, TrendingUp, CheckCircle, ArrowUpRight, Zap, BarChart3, DollarSign } from "lucide-react";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { DeleteProjectButton } from "@/components/project/delete-project-button";
import { TurkeyMap } from "@/components/dashboard/turkey-map";

export default async function DashboardPage() {
  const user = await requireAuth();

  const [projects, allProjects, allForMap] = await Promise.all([
    prisma.project.findMany({
      where: { firmId: user.firmId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        pricingSnapshot: true,
        projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
      },
    }),
    prisma.project.findMany({
      where: { firmId: user.firmId, totalPowerKw: { gt: 0 } },
      select: {
        totalPowerKw: true,
        projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
      },
    }),
    prisma.project.findMany({
      where: { firmId: user.firmId },
      select: { projectDetail: { select: { settings: true } } },
    }),
  ]);

  function getEpcPrice(p: { projectDetail?: { kesifA: unknown; kesifB: unknown; settings: unknown } | null; totalPowerKw: number }) {
    if (!p.projectDetail) return null;
    try {
      const r = calc(
        p.projectDetail.kesifA as unknown as KesifGroup[],
        p.projectDetail.kesifB as unknown as KesifGroup[],
        p.projectDetail.settings as unknown as GesSettings
      );
      if (r.salePriceUsd < 100) return null;
      return r;
    } catch { return null; }
  }

  const totalCount = await prisma.project.count({ where: { firmId: user.firmId } });
  const inProgressCount = projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "DRAFT").length;
  const closeWinCount = projects.filter((p) => p.status === "CLOSE_WIN").length;

  const allWithPrice = allProjects
    .filter((p) => p.totalPowerKw > 0)
    .map((p) => ({ kw: p.totalPowerKw, epc: getEpcPrice(p) }));
  const totalMWp = allWithPrice.reduce((s, p) => s + p.kw / 1000, 0);
  const avgMWp = allWithPrice.length > 0 ? totalMWp / allWithPrice.length : 0;
  const priced = allWithPrice.filter((p) => p.epc);
  const avgUsdPerKwp = priced.length > 0
    ? priced.reduce((s, p) => s + p.epc!.salePriceUsd / p.kw, 0) / priced.length
    : 0;

  const provinceCounts: Record<string, number> = {};
  for (const p of allForMap) {
    const il = (p.projectDetail?.settings as GesSettings | null)?.il;
    if (il) provinceCounts[il] = (provinceCounts[il] ?? 0) + 1;
  }

  const statusVariant: Record<string, "default" | "secondary" | "success" | "warning"> = {
    DRAFT: "secondary",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    SENT: "default",
    CLOSE_WIN: "success",
    CLOSE_LOST: "secondary",
    CANCELLED: "secondary",
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Merhaba, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">İşte projelerinizin genel durumu</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="w-4 h-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* MWp Stats — gradient cards */}
      {totalMWp > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 8px 24px rgba(245,158,11,0.35)" }}>
            <div className="absolute right-4 top-4 opacity-20">
              <Zap className="w-12 h-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2">Toplam Kurulu Güç</p>
            <p className="text-3xl font-bold">{totalMWp.toFixed(2)}</p>
            <p className="text-sm font-medium opacity-75 mt-0.5">MWp kurulu kapasite</p>
          </div>
          <div className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", boxShadow: "0 8px 24px rgba(59,130,246,0.3)" }}>
            <div className="absolute right-4 top-4 opacity-20">
              <BarChart3 className="w-12 h-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2">Ortalama Proje Gücü</p>
            <p className="text-3xl font-bold">{avgMWp.toFixed(2)}</p>
            <p className="text-sm font-medium opacity-75 mt-0.5">MWp / proje</p>
          </div>
          {avgUsdPerKwp > 0 ? (
            <div className="rounded-2xl p-5 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
              <div className="absolute right-4 top-4 opacity-20">
                <DollarSign className="w-12 h-12" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2">Ort. EPC Birim Fiyatı</p>
              <p className="text-3xl font-bold">{avgUsdPerKwp.toFixed(3)}</p>
              <p className="text-sm font-medium opacity-75 mt-0.5">$/kWp ortalama</p>
            </div>
          ) : (
            <div className="rounded-2xl p-5 relative overflow-hidden bg-white border border-slate-200/70 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">EPC Birim Fiyatı</p>
              <p className="text-3xl font-bold text-slate-300">—</p>
              <p className="text-sm text-slate-400 mt-0.5">Henüz hesaplanmadı</p>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md shadow-slate-200/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)", boxShadow: "0 4px 12px rgba(15,31,61,0.25)" }}>
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Tüm Projeler</span>
            </div>
            <p className="text-4xl font-bold text-slate-900">{totalCount}</p>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">toplam proje</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-slate-200/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">Devam Eden</span>
            </div>
            <p className="text-4xl font-bold text-slate-900">{inProgressCount}</p>
            <p className="text-xs text-indigo-500 mt-1.5 font-semibold">taslak / süreçte</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-slate-200/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Close Win</span>
            </div>
            <p className="text-4xl font-bold text-slate-900">{closeWinCount}</p>
            <p className="text-xs text-emerald-500 mt-1.5 font-semibold">kazanılan proje</p>
          </CardContent>
        </Card>
      </div>

      {/* Son Projeler */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">Son Projeler</CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl">
            <Link href="/projects" className="flex items-center gap-1">
              Tümünü Gör <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)" }}>
                <FolderOpen className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold">Henüz proje yok</p>
              <p className="text-slate-400 text-sm mt-1">İlk projeyi oluşturarak başlayın</p>
              <Button asChild className="mt-5">
                <Link href="/projects/new"><Plus className="w-4 h-4" />İlk Projeyi Oluştur</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {projects.map((project) => {
                const epc = getEpcPrice(project);
                return (
                  <div key={project.id} className="flex items-center px-6 py-4 hover:bg-slate-50/80 transition-colors group">
                    {/* Color bar */}
                    <div className="w-1 h-10 rounded-full mr-4 flex-shrink-0"
                      style={{
                        background: project.status === "COMPLETED"
                          ? "linear-gradient(180deg,#10b981,#059669)"
                          : project.status === "IN_PROGRESS"
                          ? "linear-gradient(180deg,#f59e0b,#ea580c)"
                          : project.status === "SENT"
                          ? "linear-gradient(180deg,#3b82f6,#6366f1)"
                          : "linear-gradient(180deg,#94a3b8,#64748b)"
                      }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-slate-900">
                        {project.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {project.customerName} · {formatDate(project.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {project.totalPowerKw > 0 && (
                        <p className="text-sm text-slate-500 hidden sm:block font-semibold">
                          {project.totalPowerKw >= 1000
                            ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
                            : `${project.totalPowerKw.toFixed(1)} kWp`}
                        </p>
                      )}
                      {epc ? (
                        <div className="hidden md:block text-right">
                          <p className="text-sm font-bold text-amber-600">${epc.salePriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-slate-400">{epc.perKwUsd.toFixed(3)} $/kWp</p>
                        </div>
                      ) : project.pricingSnapshot ? (
                        <p className="text-sm font-bold text-slate-700 hidden md:block">
                          {formatCurrency(project.pricingSnapshot.finalSalePrice)}
                        </p>
                      ) : null}
                      <Badge variant={statusVariant[project.status] ?? "secondary"}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </Badge>
                      <Button variant="outline" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                        <Link href={`/projects/${project.id}/detail`}>Düzenle</Link>
                      </Button>
                      <DeleteProjectButton projectId={project.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Turkey Map */}
      {Object.keys(provinceCounts).length > 0 && (
        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <CardHeader className="py-4 px-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)" }}>
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">Proje Dağılımı</CardTitle>
              </div>
              <p className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                Kaydır: yakınlaştır · Sürükle: taşı
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0" style={{ background: "#f8fafc" }}>
            <TurkeyMap provinceCounts={provinceCounts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
