"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calc, getGrpTot } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import type { Project } from "@prisma/client";
import { Zap, DollarSign, TrendingUp, Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
        <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="font-medium">{settings.projeAdi}</span>
        <span className="text-slate-300">|</span>
        <span>{settings.isveren || project.customerName}</span>
        <span className="text-slate-300">|</span>
        <span className="font-semibold text-slate-800">{settings.dcGuc} MW DC</span>
        <span className="text-slate-300">|</span>
        <span>1 USD = {settings.usd} ₺</span>
        <div className="ml-auto">
          <Link href={`/projects/${projectId}/detail/settings`}>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              Parametreler <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Teklif Satış Fiyatı</p>
                <p className="text-2xl font-bold text-amber-600">{fmtUsd(result.salePriceUsd)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{fmtTry(result.salePriceTry)}</p>
              </div>
              <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">USD/kWp</p>
                <p className="text-2xl font-bold text-slate-900">{result.perKwUsd.toFixed(3)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Özgül maliyet</p>
              </div>
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Doğrudan Maliyet</p>
                <p className="text-2xl font-bold text-slate-900">{fmtUsd(result.directCost)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Kesif A+B toplamı</p>
              </div>
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Net Kar</p>
                <p className="text-2xl font-bold text-green-600">{fmtUsd(result.netKarAmt)}</p>
                <p className="text-xs text-slate-500 mt-0.5">%{settings.netKar} marj</p>
              </div>
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cost breakdown summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Maliyet Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr className="py-2">
                  <td className="py-2 text-slate-600">Kesif A (Doğrudan)</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.kaTotal)}</td>
                  <td className="py-2 text-right text-slate-500 pl-2">{fmtTry(result.kaTotal * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-600">Kesif B (Dolaylı)</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.kbTotal)}</td>
                  <td className="py-2 text-right text-slate-500 pl-2">{fmtTry(result.kbTotal * settings.usd)}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-2 text-slate-700 font-medium pl-2">Toplam Doğrudan</td>
                  <td className="py-2 text-right font-bold">{fmtUsd(result.directCost)}</td>
                  <td className="py-2 text-right text-slate-500 pl-2">{fmtTry(result.directCost * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-600">Contingency (%{settings.contingency})</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.contingencyAmt)}</td>
                  <td className="py-2 text-right text-slate-500 pl-2">{fmtTry(result.contingencyAmt * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-600">Genel Gider (%{settings.genelGider})</td>
                  <td className="py-2 text-right font-semibold">{fmtUsd(result.genelGiderAmt)}</td>
                  <td className="py-2 text-right text-slate-500 pl-2">{fmtTry(result.genelGiderAmt * settings.usd)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-600">Net Kar (%{settings.netKar})</td>
                  <td className="py-2 text-right font-semibold text-green-600">{fmtUsd(result.netKarAmt)}</td>
                  <td className="py-2 text-right text-slate-500 pl-2">{fmtTry(result.netKarAmt * settings.usd)}</td>
                </tr>
                <tr className="bg-amber-50 border-t-2 border-amber-200">
                  <td className="py-3 font-bold text-amber-800 pl-2">Satış Fiyatı</td>
                  <td className="py-3 text-right font-bold text-amber-700 text-base">{fmtUsd(result.salePriceUsd)}</td>
                  <td className="py-3 text-right font-bold text-amber-700 pl-2">{fmtTry(result.salePriceTry)}</td>
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
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 truncate max-w-[200px]">{g.code} — {g.name}</span>
                      <span className="font-semibold text-slate-900 ml-2 whitespace-nowrap">{fmtUsd(g.totalUsd)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div
                        className="h-1.5 bg-amber-400 rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">%{pct.toFixed(1)} toplam içinde</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
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
              <div key={p.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-xs text-slate-500">{p.label}</p>
                <p className="font-semibold text-slate-900 mt-0.5">{p.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick nav links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Kesif-A", sub: "Doğrudan maliyetler", href: `/projects/${projectId}/detail/kesif-a`, color: "blue" },
          { label: "Kesif-B", sub: "Dolaylı maliyetler", href: `/projects/${projectId}/detail/kesif-b`, color: "purple" },
          { label: "BoQ", sub: "Tüm kalemler", href: `/projects/${projectId}/detail/boq`, color: "slate" },
          { label: "DoR", sub: "Kapsam sınırları", href: `/projects/${projectId}/detail/dor`, color: "green" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50 transition-colors"
          >
            <p className="font-semibold text-slate-900 group-hover:text-amber-700">{item.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 mt-2" />
          </Link>
        ))}
      </div>
    </div>
  );
}
