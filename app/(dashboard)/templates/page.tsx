import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTemplates, useTemplate } from "@/app/actions/templates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { LayoutTemplate, Eye, Sparkles, Zap, DollarSign, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function TemplatesPage() {
  const user = await requireAuth();

  // Idempotent — eksik sablonlari yaratir, varolanlara dokunmaz
  await ensureTemplates();

  const templates = await prisma.project.findMany({
    where: { firmId: user.firmId, isTemplate: true },
    orderBy: { templateOrder: "asc" },
    include: {
      projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
    },
  });

  function getEpc(p: (typeof templates)[number]) {
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

  function fmt(n: number) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <LayoutTemplate className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Şablonlar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hazır boyut şablonları — kendi projenize en yakın olanı seçip
              kopyalayarak başlayın. Şablonun içeriğini değiştirmeden direkt kullanabilir
              ya da incelyip kendi projenize uyarlayabilirsiniz.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-info/30 bg-info-soft/40 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-info-soft-foreground" />
          <div className="text-xs text-info-soft-foreground">
            <strong>Nasıl çalışır?</strong> Her şablon kalemler, fiyatlar ve
            varsayılan oranlarla hazırdır. <strong>İncele</strong> ile içeriğini
            görüp düzenleyebilirsiniz (şablonun kendisi güncellenir).{" "}
            <strong>Bu şablonu kullan</strong> ile yeni bir proje açılır ve
            şablon o projeye kopyalanır — şablon değişmez, kopyada düzenleme
            yaparsınız.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const epc = getEpc(t);
          return (
            <Card
              key={t.id}
              className="overflow-hidden border-2 border-transparent shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-primary/30 bg-primary-soft font-mono text-[11px] font-semibold text-primary-soft-foreground",
                        )}
                      >
                        {t.templateLabel ?? t.name}
                      </Badge>
                      {t.templateLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-info-soft-foreground">
                          <Lock className="size-2.5" /> Kilitli
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-soft-foreground">
                          <Unlock className="size-2.5" /> Düzenleniyor
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-foreground">
                      {t.installationType === "ROOFTOP" ? "Çatı GES" : "Arazi GES"}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.totalPowerKw >= 1000
                        ? `${(t.totalPowerKw / 1000).toFixed(1)} MWp`
                        : `${t.totalPowerKw} kWp`}{" "}
                      {t.systemSize === "LARGE" ? "büyük ölçek" : "küçük ölçek"}
                    </p>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <Zap className="size-5" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Tahmini Satış
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 font-bold tabular-nums text-foreground">
                      <DollarSign className="size-3 text-primary" />
                      {epc ? fmt(epc.salePriceUsd) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      USD/Wp
                    </p>
                    <p className="mt-0.5 font-bold tabular-nums text-foreground">
                      {epc ? `$${epc.perKwUsd.toFixed(3)}` : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${t.id}/detail`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Eye className="size-3.5" />
                    İncele / Düzenle
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await useTemplate(t.id);
                    }}
                    className="flex-1"
                  >
                    <Button
                      type="submit"
                      size="sm"
                      className="h-auto w-full gap-1.5 py-2 text-xs"
                    >
                      <Sparkles className="size-3.5" />
                      Bu şablonu kullan
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Şablon bulunamadı. Sayfayı yenileyin.
          </p>
        </div>
      )}
    </div>
  );
}
