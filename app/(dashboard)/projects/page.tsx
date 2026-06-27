import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCurrency,
  formatDate,
  INSTALLATION_TYPE_LABELS,
} from "@/lib/utils";
import { Plus, FolderOpen, Eye, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProjectVisible } from "@/lib/project-status";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { DeleteProjectButton } from "@/components/project/delete-project-button";
import { CopyProjectButton } from "@/components/project/copy-project-button";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_TONE } from "@/lib/pipeline-labels";
import type { PipelineStage } from "@prisma/client";

// Sol kenar renk şeridi — pipeline aşamasına göre.
const PIPELINE_BAR_COLOR: Record<string, string> = {
  DRAFT: "bg-muted-foreground/40",
  SENT: "bg-info",
  REVISED: "bg-violet-500",
  WON: "bg-success",
  LOST: "bg-rose-500",
  CANCELLED: "bg-muted-foreground/40",
};

interface Props {
  searchParams: Promise<{ q?: string; stage?: string }>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { q, stage } = await searchParams;
  const user = await requireAuth();

  // Admin disindaki kullanicilar icin gizli proje + gizli musteri ID'lerini al.
  // Gizli musteri => o musteriye bagli projeler de listede cikmaz.
  const hiddenProjectIds = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "project");
  const hiddenCustomerNames = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "customer");

  const allProjects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      isTemplate: false,
      ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
      ...(hiddenCustomerNames.length
        ? { customerName: { notIn: hiddenCustomerNames } }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      // Pipeline aşaması filtresi. "DRAFT" hem yeni enum DRAFT'ı hem de
      // henüz pipeline'a girmemiş eski projeleri (null) kapsar.
      ...(stage
        ? stage === "DRAFT"
          ? { AND: [{ OR: [{ pipelineStage: "DRAFT" as const }, { pipelineStage: null }] }] }
          : { pipelineStage: stage as PipelineStage }
        : {}),
    },
    include: {
      pricingSnapshot: true,
      projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Yarim kalmis projeleri (Proje + Teknik tamamlanmadan terkedilenler)
  // listeden gizle. DB'de durur, kullanici icin yokmus gibi davranir.
  const projects = allProjects.filter(isProjectVisible);

  // GES engine ile gercek satis fiyati. Esik kaldirildi — fiyat 0'dan buyukse
  // ne kadar dusuk olursa olsun goster (kullanici yarim-doldurulmus projede
  // bile birim fiyatini gormek istiyor).
  function getEpcPrice(p: (typeof projects)[number]) {
    if (!p.projectDetail) return null;
    try {
      const r = calc(
        p.projectDetail.kesifA as unknown as KesifGroup[],
        p.projectDetail.kesifB as unknown as KesifGroup[],
        p.projectDetail.settings as unknown as GesSettings,
      );
      if (r.salePriceUsd <= 0) return null;
      return r;
    } catch {
      return null;
    }
  }

  const filters = [
    { value: undefined, label: "Tümü" },
    { value: "DRAFT", label: PIPELINE_STAGE_LABELS.DRAFT },
    { value: "SENT", label: PIPELINE_STAGE_LABELS.SENT },
    { value: "REVISED", label: PIPELINE_STAGE_LABELS.REVISED },
    { value: "WON", label: PIPELINE_STAGE_LABELS.WON },
    { value: "LOST", label: PIPELINE_STAGE_LABELS.LOST },
    { value: "CANCELLED", label: PIPELINE_STAGE_LABELS.CANCELLED },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projeler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projects.length} proje bulundu
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* Ctrl+K kısayol ipucu — her sayfadan açılan global arama */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-600">
        <Search className="size-3.5 shrink-0 text-emerald-600" />
        <span>
          Hızlı arama için her sayfada{" "}
          <kbd className="mx-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            Ctrl
          </kbd>
          <span className="text-slate-400">+</span>
          <kbd className="mx-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            K
          </kbd>{" "}
          tuşlarına basabilir veya üst bardaki büyüteç ikonunu kullanabilirsin —
          proje adı, müşteri, lokasyon veya{" "}
          <strong className="text-slate-700">kalem</strong> ("Solar Panel" gibi)
          ile arama yapar. Sadece görüntüleme — hangi projede ne fiyat, kaç MWp
          olduğunu hızlıca görmek için.
        </span>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const isActive = stage === f.value || (!stage && !f.value);
          return (
            <Link
              key={f.value ?? "all"}
              href={f.value ? `/projects?stage=${f.value}` : "/projects"}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary">
              <FolderOpen className="size-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Proje bulunamadı</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Yeni bir proje oluşturarak başlayın
            </p>
            <Button asChild className="mt-5">
              <Link href="/projects/new">
                <Plus className="size-4" />
                İlk Projeyi Oluştur
              </Link>
            </Button>
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
                      Proje
                    </th>
                    <th className="hidden px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      Müşteri
                    </th>
                    <th className="hidden px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                      Güç
                    </th>
                    <th className="hidden px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                      Fiyat
                    </th>
                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Aşama
                    </th>
                    <th className="hidden px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Tarih
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projects.map((project) => {
                    const epc = getEpcPrice(project);
                    return (
                      <tr
                        key={project.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-8 w-1 shrink-0 rounded-full",
                                PIPELINE_BAR_COLOR[project.pipelineStage ?? "DRAFT"] ??
                                  "bg-muted-foreground/40"
                              )}
                            />
                            <div>
                              <p className="font-medium text-foreground">{project.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {project.quoteKind === "MATERIAL_SERVICE"
                                  ? "Malzeme & Hizmet"
                                  : INSTALLATION_TYPE_LABELS[project.installationType]}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-6 py-4 font-medium text-muted-foreground md:table-cell">
                          {project.customerName}
                        </td>
                        <td className="hidden px-6 py-4 text-right font-medium text-muted-foreground lg:table-cell">
                          {project.totalPowerKw > 0
                            ? project.totalPowerKw >= 1000
                              ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
                              : `${project.totalPowerKw.toFixed(1)} kWp`
                            : "—"}
                        </td>
                        <td className="hidden px-6 py-4 text-right lg:table-cell">
                          {epc ? (
                            <div>
                              <p className="font-semibold text-foreground">
                                ${epc.salePriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                ${Math.round(epc.perKwUsd).toLocaleString("en-US")}/kWp
                              </p>
                            </div>
                          ) : project.pricingSnapshot ? (
                            <span className="font-semibold text-foreground">
                              {formatCurrency(project.pricingSnapshot.finalSalePrice)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              PIPELINE_STAGE_TONE[project.pipelineStage ?? "DRAFT"],
                            )}
                            title="Pipeline aşaması — projenin satış sürecindeki yeri"
                          >
                            {PIPELINE_STAGE_LABELS[project.pipelineStage ?? "DRAFT"]}
                          </span>
                        </td>
                        <td className="hidden px-6 py-4 text-right text-xs text-muted-foreground sm:table-cell">
                          {formatDate(project.updatedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" asChild title="Salt-okunur olarak görüntüle">
                              <Link href={`/projects/${project.id}/detail?view=1`}>
                                <Eye className="size-3.5" />
                                Görüntüle
                              </Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/projects/${project.id}/detail`}>
                                Düzenle
                              </Link>
                            </Button>
                            <CopyProjectButton projectId={project.id} />
                            <DeleteProjectButton projectId={project.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
