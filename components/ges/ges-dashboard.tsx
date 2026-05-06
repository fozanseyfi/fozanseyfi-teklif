"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calc, getGrpTot } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import type { Project } from "@prisma/client";
import { Zap, DollarSign, TrendingUp, Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUsd(n: number) {
  return `$${fmt(n, 0)}`;
}

function fmtTry(n: number) {
  return `₺${fmt(n, 0)}`;
}

interface Props {
  projectId: string;
  project: Project;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
}

export function GesDashboard({ projectId, project, kesifA, kesifB, settings }: Props) {
  const result = useMemo(() => calc(kesifA, kesifB, settings), [kesifA, kesifB, settings]);

  const kaGroups = kesifA.map((g) => ({
    code: g.code,
    name: g.name,
    totalUsd: getGrpTot(g, settings),
  }));

  const kbGroups = kesifB.map((g) => ({
    code: g.code,
    name: g.name,
    totalUsd: getGrpTot(g, settings),
  }));

  const topGroups = [...kaGroups, ...kbGroups]
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Settings bar */}
      <div className="flex items-center gap-3 rounded-xl border bg-muted p-3 text-sm text-muted-foreground">
        <Settings className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">{settings.projeAdi}</span>
        <span className="text-border">|</span>
        <span>{settings.isveren || project.customerName}</span>
        <span className="text-border">|</span>
        <span className="font-semibold text-foreground">{settings.dcGuc} MW DC</span>
        <span className="text-border">|</span>
        <span>1 USD = {settings.usd} ₺</span>
        <div className="ml-auto">
          <Link href={`/projects/${projectId}/detail/settings`}>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              Parametreler <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-primary/30 bg-primary-soft">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Teklif Satış Fiyatı</p>
                <p className="text-2xl font-bold text-primary-soft-foreground">{fmtUsd(result.salePriceUsd)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{fmtTry(result.salePriceTry)}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft">
                <DollarSign className="size-4 text-primary-soft-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">USD/kWp</p>
                <p className="text-2xl font-bold text-foreground">{result.perKwUsd.toFixed(3)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Özgül maliyet</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-info-soft">
                <Zap className="size-4 text-info-soft-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Doğrudan Maliyet</p>
                <p className="text-2xl font-bold text-foreground">{fmtUsd(result.directCost)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Kesif A+B toplamı</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Net Kar</p>
                <p className="text-2xl font-bold text-success-soft-foreground">{fmtUsd(result.netKarAmt)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">%{settings.netKar} marj</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-success-soft">
                <TrendingUp className="size-4 text-success-soft-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost breakdown summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Maliyet Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <tr className="py-2">
                  <td className="py-2 text-muted-foreground">Kesif A (Doğrudan)</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.kaTotal)}</td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">{fmtTry(result.kaTotal * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Kesif B (Dolaylı)</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.kbTotal)}</td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">{fmtTry(result.kbTotal * settings.usd)}</td>
                </tr>
                <tr className="bg-muted">
                  <td className="py-2 pl-2 font-medium text-foreground">Toplam Doğrudan</td>
                  <td className="py-2 text-right font-bold">{fmtUsd(result.directCost)}</td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">{fmtTry(result.directCost * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Contingency (%{settings.contingency})</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.contingencyAmt)}</td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">{fmtTry(result.contingencyAmt * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Genel Gider (%{settings.genelGider})</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.genelGiderAmt)}</td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">{fmtTry(result.genelGiderAmt * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Net Kar (%{settings.netKar})</td>
                  <td className="py-2 text-right font-semibold text-success-soft-foreground">{fmtUsd(result.netKarAmt)}</td>
                  <td className="py-2 pl-2 text-right text-muted-foreground">{fmtTry(result.netKarAmt * settings.usd)}</td>
                </tr>
                <tr className="border-t-2 border-primary/30 bg-primary-soft">
                  <td className="py-3 pl-2 font-semibold text-primary-soft-foreground">Satış Fiyatı</td>
                  <td className="py-3 text-right text-base font-bold text-primary-soft-foreground">{fmtUsd(result.salePriceUsd)}</td>
                  <td className="py-3 pl-2 text-right font-bold text-primary-soft-foreground">{fmtTry(result.salePriceTry)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Top groups by cost */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">En Yüksek Kalemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topGroups.map((g) => {
                const pct = result.directCost > 0 ? (g.totalUsd / result.directCost) * 100 : 0;
                return (
                  <div key={g.code}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="max-w-[200px] truncate text-muted-foreground">{g.code} — {g.name}</span>
                      <span className="ml-2 whitespace-nowrap font-semibold text-foreground">{fmtUsd(g.totalUsd)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">%{pct.toFixed(1)} toplam içinde</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project system params */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sistem Parametreleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              { label: "DC Güç", value: `${settings.dcGuc} MW` },
              { label: "AC Güç", value: `${settings.acGuc} MW` },
              { label: "Panel Gücü", value: `${settings.panelGuc} Wp` },
              { label: "Panel Adedi", value: fmt(settings.panelAdet) },
              { label: "İnverter Gücü", value: `${settings.invGuc} kW` },
              { label: "İnverter Adedi", value: `${settings.invAdet} adet` },
              { label: "Trafo Sayısı", value: `${settings.trafoSayisi} adet` },
              { label: "Çevre Telçit", value: `${settings.cevreTelcit} mt` },
            ].map((p) => (
              <div key={p.label} className="rounded-lg border bg-muted p-3">
                <p className="text-xs text-muted-foreground">{p.label}</p>
                <p className="mt-0.5 font-semibold text-foreground">{p.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick nav links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Kesif-A", sub: "Doğrudan maliyetler", href: `/projects/${projectId}/detail/kesif-a` },
          { label: "Kesif-B", sub: "Dolaylı maliyetler", href: `/projects/${projectId}/detail/kesif-b` },
          { label: "BoQ", sub: "Tüm kalemler", href: `/projects/${projectId}/detail/boq` },
          { label: "DoR", sub: "Kapsam sınırları", href: `/projects/${projectId}/detail/dor` },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "group rounded-xl border bg-card p-4 transition-colors",
              "hover:border-primary/40 hover:bg-primary-soft",
            )}
          >
            <p className="font-semibold text-foreground group-hover:text-primary-soft-foreground">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.sub}</p>
            <ArrowRight className="mt-2 size-4 text-muted-foreground group-hover:text-primary-soft-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
