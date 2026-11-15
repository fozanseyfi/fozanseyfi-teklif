import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { ArrowRight, Eye, FolderOpen, Plus } from "lucide-react";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { DisclaimerButton } from "@/components/shared/legal-disclaimer";
import { TurkeyMapLazy as TurkeyMap } from "@/components/dashboard/turkey-map-lazy";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { isProjectVisible } from "@/lib/project-status";
import { parseQuoteItems, parseQuoteMeta, computeQuoteTotals } from "@/lib/quote";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_TONE } from "@/lib/pipeline-labels";
import { CopyProjectButton } from "@/components/project/copy-project-button";

export default async function DashboardPage() {
  const user = await requireAuth();

  // Admin disindaki kullanicilar icin gizlenmis proje + musteri ID'lerini al.
  // Gizli musteri => o musteriye bagli projeler de listede cikmaz. Bu
  // /projects sayfasiyla ayni filter mantigi — dashboard'da da gecerli
  // olmaliki KPI sayilari (toplam, MWp), Son Projeler ve harita tutarli.
  const hiddenProjectIds = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "project");
  const hiddenCustomerNames = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "customer");

  // Tum gercek projeleri tek sorguda cek; sonra isProjectVisible ile yarim
  // kalmislari filtrele. Yarim kalmis projeler temizleyici tarafindan
  // genelde silinir ama race/cleanup-fail durumlarinda yine de UI'da
  // gozukmesinler.
  const allRawProjects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      isTemplate: false,
      ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
      ...(hiddenCustomerNames.length
        ? { customerName: { notIn: hiddenCustomerNames } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      pricingSnapshot: true,
      projectDetail: { select: { kesifA: true, kesifB: true, settings: true, quoteItems: true } },
    },
  });
  const allVisibleProjects = allRawProjects.filter(isProjectVisible);
  const projects = allVisibleProjects.slice(0, 10);

  function getEpcPrice(p: {
    projectDetail?: { kesifA: unknown; kesifB: unknown; settings: unknown } | null;
    totalPowerKw: number;
  }) {
    if (!p.projectDetail) return null;
    try {
      const r = calc(
        p.projectDetail.kesifA as unknown as KesifGroup[],
        p.projectDetail.kesifB as unknown as KesifGroup[],
        p.projectDetail.settings as unknown as GesSettings,
      );
      if (r.salePriceUsd < 100) return null;
      return r;
    } catch {
      return null;
    }
  }

  // Malzeme & Hizmet teklifi: KDV hariç toplam (seçilen para biriminde).
  function getQuoteExVat(p: { projectDetail?: { quoteItems?: unknown; settings?: unknown } | null }) {
    const items = parseQuoteItems(p.projectDetail?.quoteItems);
    if (!items.length) return null;
    const t = computeQuoteTotals(items, parseQuoteMeta(p.projectDetail?.settings));
    return { value: t.subtotal, symbol: t.symbol };
  }

  // Fiyat hücresi: EPC satış fiyatı ($), malzeme/hizmet teklifinde KDV hariç toplam.
  function priceLabel(p: (typeof projects)[number]): string {
    if (p.quoteKind === "MATERIAL_SERVICE") {
      const q = getQuoteExVat(p);
      return q
        ? `${q.symbol}${q.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`
        : "—";
    }
    const epc = getEpcPrice(p);
    if (epc) return `$${epc.salePriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (p.pricingSnapshot) return formatCurrency(p.pricingSnapshot.finalSalePrice);
    return "—";
  }

  // KPI'lar pipeline aşamasına göre, tüm görünür projeler üzerinden (sadece son 10 değil).
  const totalCount = allVisibleProjects.length;
  const wonCount = allVisibleProjects.filter((p) => p.pipelineStage === "WON").length;
  // "Devam Eden": kapanmamış her şey (pipeline'a hiç girmemiş taslaklar dahil).
  const ongoingCount = allVisibleProjects.filter(
    (p) =>
      p.pipelineStage !== "WON" &&
      p.pipelineStage !== "LOST" &&
      p.pipelineStage !== "CANCELLED",
  ).length;
  // Kazanma oranı = kazanılan / TÜM teklifler.
  const winRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : null;
  const totalMWp = allVisibleProjects.reduce((s, p) => s + Math.max(p.totalPowerKw, 0) / 1000, 0);

  const provinceCounts: Record<string, number> = {};
  for (const p of allVisibleProjects) {
    const il = (p.projectDetail?.settings as GesSettings | null)?.il;
    if (il) provinceCounts[il] = (provinceCounts[il] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totalCount > 0 ? `${totalCount} teklif kayıtlı` : "Henüz proje yok"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DisclaimerButton className="h-8 border-border bg-background px-3 text-xs text-foreground backdrop-blur-none hover:bg-secondary hover:text-foreground" />
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-4" /> Yeni Proje
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI — dört sade kart */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Toplam Teklif" value={String(totalCount)} />
          <Stat label="Devam Eden" value={String(ongoingCount)} />
          <Stat
            label="Kazanılan"
            value={String(wonCount)}
            hint={winRate !== null ? `kazanma oranı %${winRate}` : undefined}
            accent
          />
          <Stat
            label="Toplam Güç"
            value={totalMWp.toLocaleString("tr-TR", { maximumFractionDigits: totalMWp < 10 ? 1 : 0 })}
            unit="MWp"
          />
        </div>
      )}

      {/* Son Projeler */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FolderOpen className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">İlk projenizi oluşturarak başlayın.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/projects/new">
                <Plus className="size-4" /> Yeni Proje
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Son Projeler</h2>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Tümünü gör <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Proje</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Güç</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Tutar</th>
                  <th className="px-3 py-2.5 font-medium">Aşama</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">Tarih</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-secondary/30">
                    <td className="min-w-[160px] px-5 py-3">
                      <Link
                        href={`/projects/${project.id}/detail`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                        data-no-i18n
                      >
                        {project.name}
                      </Link>
                      {project.customerName && (
                        <p className="mt-0.5 text-xs text-muted-foreground" data-no-i18n>{project.customerName}</p>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                      {project.totalPowerKw > 0
                        ? project.totalPowerKw >= 1000
                          ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
                          : `${project.totalPowerKw.toFixed(1)} kWp`
                        : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums sm:table-cell">
                      {priceLabel(project)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          PIPELINE_STAGE_TONE[project.pipelineStage ?? "DRAFT"],
                        )}
                        title="Pipeline aşaması — sadece proje Pipeline sekmesinden değiştirilir"
                      >
                        {PIPELINE_STAGE_LABELS[project.pipelineStage ?? "DRAFT"]}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-right text-xs text-muted-foreground lg:table-cell">
                      {formatDate(project.createdAt)}
                    </td>
                    <td className="px-5 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" asChild title="Salt-okunur olarak görüntüle">
                          <Link href={`/projects/${project.id}/detail?view=1`} aria-label="Görüntüle">
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <CopyProjectButton projectId={project.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Türkiye haritası */}
      {Object.keys(provinceCounts).length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Proje Dağılımı</h2>
            <p className="text-xs text-muted-foreground">Kaydır: yakınlaştır · Sürükle: taşı</p>
          </div>
          <CardContent className="bg-muted/30 p-0">
            <TurkeyMap provinceCounts={provinceCounts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Internal components ---------- */

// Sade KPI kartı: etiket + rakam. `accent` rakamı tema yeşiliyle vurgular.
function Stat({
  label,
  value,
  unit,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
            accent && "text-primary",
          )}
        >
          {value}
          {unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
