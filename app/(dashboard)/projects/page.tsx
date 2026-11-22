import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FolderOpen, Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProjectVisible } from "@/lib/project-status";
import { parseQuoteItems, parseQuoteMeta, computeQuoteTotals } from "@/lib/quote";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { DeleteProjectButton } from "@/components/project/delete-project-button";
import { CopyProjectButton } from "@/components/project/copy-project-button";
import { StageSelect } from "@/components/projects/stage-select";
import { effectiveStage } from "@/lib/pipeline-labels";
import { StageFilters, countStages, matchesStage, parseStage } from "@/components/projects/stage-filters";

// Satır başındaki aşama noktası rengi.
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
  const { q, stage: rawStage } = await searchParams;
  const stage = parseStage(rawStage);
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
    },
    include: {
      pricingSnapshot: true,
      projectDetail: { select: { kesifA: true, kesifB: true, settings: true, quoteItems: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Yarim kalmis projeleri (Proje + Teknik tamamlanmadan terkedilenler)
  // listeden gizle. DB'de durur, kullanici icin yokmus gibi davranir.
  // Aşama filtresi bellekte uygulanır; çiplerdeki sayılar filtre öncesi listeden hesaplanır.
  const visibleProjects = allProjects.filter(isProjectVisible);
  const stageCounts = countStages(visibleProjects);
  const projects = visibleProjects.filter((p) => matchesStage(p, stage));

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

  // Malzeme & Hizmet teklifi: KDV hariç toplam (seçilen para biriminde).
  function getQuoteExVat(p: (typeof projects)[number]) {
    const items = parseQuoteItems(p.projectDetail?.quoteItems);
    if (!items.length) return null;
    const t = computeQuoteTotals(items, parseQuoteMeta(p.projectDetail?.settings));
    return { value: t.subtotal, symbol: t.symbol };
  }


  // Fiyat hücresi — tek satır: ana tutar + soluk ikinci bilgi ($/kWp veya KDV hariç)
  function price(project: (typeof projects)[number]): { main: string; sub?: string } | null {
    if (project.quoteKind === "MATERIAL_SERVICE") {
      const m = getQuoteExVat(project);
      return m ? { main: `${m.symbol}${m.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`, sub: "KDV hariç" } : null;
    }
    const epc = getEpcPrice(project);
    if (epc) {
      return {
        main: `$${epc.salePriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        sub: `$${Math.round(epc.perKwUsd).toLocaleString("en-US")}/kWp`,
      };
    }
    if (project.pricingSnapshot) return { main: formatCurrency(project.pricingSnapshot.finalSalePrice) };
    return null;
  }

  const TH = "px-3 py-2.5 font-medium whitespace-nowrap";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teklifler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projects.length} teklif{stage || q ? " listeleniyor" : ""}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="size-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* Filtreler — her çipte o aşamadaki teklif sayısı */}
      <StageFilters basePath="/projects" active={stage} counts={stageCounts} total={visibleProjects.length} params={{ q }} />

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FolderOpen className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {stage || q ? "Bu filtrede teklif yok." : "İlk projenizi oluşturarak başlayın."}
            </p>
            {!stage && !q && (
              <Button asChild size="sm" className="mt-4">
                <Link href="/projects/new">
                  <Plus className="size-4" /> Yeni Proje
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-left text-xs text-muted-foreground">
                  <th className={cn(TH, "pl-5")}>Proje</th>
                  <th className={cn(TH, "hidden 2xl:table-cell")}>Tip</th>
                  <th className={cn(TH, "hidden md:table-cell")}>Müşteri</th>
                  <th className={cn(TH, "hidden text-right lg:table-cell")}>Güç</th>
                  <th className={cn(TH, "hidden text-right sm:table-cell")}>Fiyat</th>
                  <th className={TH}>Aşama</th>
                  <th className={cn(TH, "hidden text-right xl:table-cell")}>Güncellendi</th>
                  <th className={cn(TH, "pr-5")} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => {
                  const pr = price(project);
                  const kind =
                    project.quoteKind === "MATERIAL_SERVICE"
                      ? "Malzeme & Hizmet"
                      : project.installationType === "ROOFTOP"
                        ? "Çatı"
                        : "Arazi";
                  return (
                    <tr key={project.id} className="whitespace-nowrap hover:bg-secondary/30">
                      <td className="max-w-[250px] py-2.5 pl-5 pr-3 2xl:max-w-[380px]">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              PIPELINE_BAR_COLOR[effectiveStage(project.pipelineStage)] ?? "bg-muted-foreground/40",
                            )}
                          />
                          <Link
                            href={`/projects/${project.id}/detail`}
                            className="truncate font-medium text-foreground hover:text-primary hover:underline"
                            title={project.name}
                            data-no-i18n
                          >
                            {project.name}
                          </Link>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 text-xs text-muted-foreground 2xl:table-cell">{kind}</td>
                      <td className="hidden max-w-[200px] px-3 py-2.5 md:table-cell">
                        <span className="block truncate text-muted-foreground" title={project.customerName ?? undefined} data-no-i18n>
                          {project.customerName || "—"}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground lg:table-cell">
                        {project.totalPowerKw > 0
                          ? project.totalPowerKw >= 1000
                            ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
                            : `${project.totalPowerKw.toFixed(1)} kWp`
                          : "—"}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">
                        {pr ? (
                          <>
                            <span className="font-medium text-foreground">{pr.main}</span>
                            {pr.sub && <span className="ml-1.5 hidden text-xs text-muted-foreground 2xl:inline">{pr.sub}</span>}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StageSelect
                          projectId={project.id}
                          stage={project.pipelineStage}
                          lostReason={project.lostReason}
                          competitorName={project.competitorName}
                        />
                      </td>
                      <td className="hidden px-3 py-2.5 text-right text-xs text-muted-foreground xl:table-cell">
                        {formatDate(project.updatedAt)}
                      </td>
                      <td className="py-2 pl-3 pr-5">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" asChild title="Salt-okunur olarak görüntüle">
                            <Link href={`/projects/${project.id}/detail?view=1`} aria-label="Görüntüle">
                              <Eye className="size-3.5" />
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild title="Düzenle">
                            <Link href={`/projects/${project.id}/detail`} aria-label="Düzenle">
                              <Pencil className="size-3.5" />
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
        </Card>
      )}
    </div>
  );
}
