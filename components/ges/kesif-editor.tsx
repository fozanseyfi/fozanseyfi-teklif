"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { saveKesifA, saveKesifB } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toUSD, getGrpTot } from "@/lib/ges-engine";
import type { KesifGroup, KesifItem, GesSettings } from "@/lib/ges-defaults";
import {
  Save,
  ChevronDown,
  ChevronRight,
  Search,
  FileDown,
  Plus,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

interface Props {
  projectId: string;
  type: "A" | "B";
  data: KesifGroup[];
  settings: GesSettings;
}

function newItem(groupCode: string, itemCount: number): KesifItem {
  return {
    code: `${groupCode}.${itemCount + 1}`,
    tanim: "Yeni Kalem",
    tip: "",
    marka: "",
    birim: "adet",
    miktar: 0,
    birimFiyat: 0,
    fiyatCur: "USD",
    rawFiyat: 0,
    notlar: "",
  };
}

function printKesif(
  title: string,
  groups: KesifGroup[],
  settings: GesSettings,
  grandTotal: number,
) {
  const isA = title.includes("A");
  const accentColor = isA ? "#059669" : "#7c3aed";
  const accentLight = isA ? "#ecfdf5" : "#ede9fe";
  const accentBorder = isA ? "#34d399" : "#a78bfa";

  const rows = groups
    .map((g) => {
      const grpTotal = getGrpTot(g, settings);
      const itemRows = g.items
        .map((it) => {
          const total = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, settings);
          return `<tr class="item-row">
        <td class="code-cell">${it.code}</td>
        <td style="padding-left:18px">${it.tanim}</td>
        <td class="dim">${it.tip || ""}</td>
        <td class="dim">${it.marka || ""}</td>
        <td style="text-align:center" class="dim">${it.birim}</td>
        <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
        <td style="text-align:right" class="dim">${it.rawFiyat.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${it.fiyatCur}</td>
        <td style="text-align:right;font-weight:700;color:#1e293b">$${fmt(total)}</td>
        <td style="text-align:right" class="dim">₺${fmt(total * settings.usd)}</td>
      </tr>`;
        })
        .join("");
      return `<tr class="group-row">
      <td colspan="2"><strong>${g.code} — ${g.name}</strong></td>
      <td colspan="4"></td>
      <td></td>
      <td style="text-align:right;font-weight:800;color:${accentColor}">$${fmt(grpTotal)}</td>
      <td style="text-align:right" class="dim">₺${fmt(grpTotal * settings.usd)}</td>
    </tr>${itemRows}`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a;padding:0}
    .header{background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:16px 20px 14px;display:flex;justify-content:space-between;align-items:flex-end}
    .header h1{font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#fff}
    .header .sub{font-size:9px;color:rgba(255,255,255,0.5);margin-top:3px}
    .header .total-badge{text-align:right}
    .header .total-badge .label{font-size:8px;color:rgba(${isA ? "52,211,153" : "167,139,250"},0.7);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px}
    .header .total-badge .amount{font-size:22px;font-weight:800;color:${accentBorder};letter-spacing:-0.02em}
    .accent-bar{height:3px;background:linear-gradient(90deg,${accentColor},${accentBorder},transparent)}
    .content{padding:14px 20px 20px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:8.5px;font-weight:600;white-space:nowrap}
    td{padding:3.5px 7px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .group-row td{background:#f8fafc;border-top:2px solid #e2e8f0;border-bottom:1px solid #cbd5e1;font-size:10px;color:#1e293b;padding:5px 7px}
    .item-row:nth-child(even) td{background:#fcfcfd}
    .code-cell{color:#94a3b8;font-family:monospace;font-size:8px;width:52px}
    .dim{color:#64748b}
    .num{color:#334155;font-variant-numeric:tabular-nums}
    .total-row td{background:${accentLight};font-weight:700;font-size:10px;border-top:3px double ${accentBorder};color:${accentColor}}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="header">
    <div>
      <div class="header h1">${title}</div>
      <div class="sub">${new Date().toLocaleDateString("tr-TR")} · ${groups.reduce((s, g) => s + g.items.length, 0)} kalem · ${groups.length} grup</div>
    </div>
    <div class="total-badge">
      <div class="label">Genel Toplam</div>
      <div class="amount">$${fmt(grandTotal)}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="content">
    <table>
      <thead><tr>
        <th style="width:52px">Kod</th>
        <th>Tanım</th>
        <th style="width:110px">Tip/Model</th>
        <th style="width:90px">Marka</th>
        <th style="text-align:center;width:44px">Birim</th>
        <th style="text-align:right;width:60px">Miktar</th>
        <th style="text-align:right;width:110px">Birim Fiyat</th>
        <th style="text-align:right;width:90px">Toplam USD</th>
        <th style="text-align:right;width:90px">Toplam TRY</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total-row">
          <td colspan="7" style="text-align:right">GENEL TOPLAM</td>
          <td style="text-align:right">$${fmt(grandTotal)}</td>
          <td style="text-align:right">₺${fmt(grandTotal * settings.usd)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.print();
  }, 300);
}

export function KesifEditor({ projectId, type, data, settings }: Props) {
  const [groups, setGroups] = useState<KesifGroup[]>(data);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.map((g) => [g.code, true])),
  );
  const [search, setSearch] = useState("");

  const title =
    type === "A"
      ? "Keşif-A — Doğrudan Maliyetler"
      : "Keşif-B — Dolaylı Maliyetler";

  const updateItem = useCallback(
    (gi: number, ii: number, field: string, value: string | number) => {
      setGroups((prev) => {
        const next = prev.map((g, gIdx) => {
          if (gIdx !== gi) return g;
          return {
            ...g,
            items: g.items.map((it, iIdx) => {
              if (iIdx !== ii) return it;
              const updated = { ...it, [field]: value };
              if (field === "rawFiyat") {
                updated.birimFiyat = toUSD(Number(value), it.fiyatCur, settings);
              }
              if (field === "fiyatCur") {
                updated.birimFiyat = toUSD(it.rawFiyat, String(value), settings);
              }
              return updated;
            }),
          };
        });
        return next;
      });
    },
    [settings],
  );

  function addItem(gi: number) {
    setGroups((prev) =>
      prev.map((grp, i) =>
        i !== gi
          ? grp
          : { ...grp, items: [...grp.items, newItem(grp.code, grp.items.length)] },
      ),
    );
  }

  function removeItem(gi: number, ii: number) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi ? g : { ...g, items: g.items.filter((_, idx) => idx !== ii) },
      ),
    );
  }

  const router = useRouter();
  const nextHref =
    type === "A"
      ? `/projects/${projectId}/detail/kesif-b`
      : `/projects/${projectId}/detail/timeline`;
  const nextLabel = type === "A" ? "Keşif-B" : "CF Timeline";

  async function handleSave(advance = false) {
    setSaving(true);
    try {
      if (type === "A") await saveKesifA(projectId, groups as never);
      else await saveKesifB(projectId, groups as never);
      toast.success(advance ? `Kaydedildi — ${nextLabel} açıldı` : "Kaydedildi");
      if (advance) router.push(nextHref);
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  const grandTotal = groups.reduce((sum, g) => sum + getGrpTot(g, settings), 0);
  const dcWp = settings.dcGuc * 1_000_000;

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.tanim.toLowerCase().includes(q) ||
            (it.tip || "").toLowerCase().includes(q) ||
            (it.marka || "").toLowerCase().includes(q) ||
            g.name.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  const inputRowClass =
    "h-7 border-transparent bg-transparent px-1 text-xs hover:border-input focus-visible:border-ring";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Toplam:{" "}
            <span className="font-semibold text-foreground">${fmt(grandTotal)}</span>{" "}
            / <span>₺{fmt(grandTotal * settings.usd)}</span>
            {dcWp > 0 && (
              <span className="ml-2 font-medium text-primary">
                ${(grandTotal / dcWp).toFixed(4)}/Wp
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-44 pl-8 text-sm"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => printKesif(title, groups, settings, grandTotal)}
          >
            <FileDown className="size-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
            size="sm"
          >
            <Save className="size-4" />
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} size="sm">
            Kaydet &amp; {nextLabel} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      {filteredGroups.map((group) => {
        const realGi = groups.findIndex((g) => g.code === group.code);
        const grpTotal = getGrpTot(group, settings);
        const isCollapsed = collapsed[group.code];
        const isAutoGroup = type === "B" && group.code === "B.6";

        return (
          <Card
            key={group.code}
            className={cn(
              "overflow-hidden",
              isAutoGroup && "border-info/30",
            )}
          >
            <CardHeader
              className="cursor-pointer select-none py-3"
              onClick={() =>
                setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="font-mono text-xs">
                    {group.code}
                  </Badge>
                  <CardTitle className="text-sm font-semibold">
                    {group.name}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    ({group.items.length} kalem)
                  </span>
                  {isAutoGroup && (
                    <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-semibold text-info-soft-foreground">
                      Cash Flow Otomatik
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-semibold text-primary">
                      ${fmt(grpTotal)}
                    </span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ₺{fmt(grpTotal * settings.usd)}
                    </span>
                    {dcWp > 0 && (
                      <span className="ml-1.5 text-xs text-info-soft-foreground">
                        ${(grpTotal / dcWp).toFixed(4)}/Wp
                      </span>
                    )}
                  </div>
                  {!isAutoGroup && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addItem(realGi);
                      }}
                      className="rounded-md border border-primary/30 bg-primary-soft p-1.5 text-primary-soft-foreground transition-colors hover:bg-primary-soft/70"
                      title="Kalem ekle"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="w-16 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Kod
                        </th>
                        <th className="min-w-[140px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tanım
                        </th>
                        <th className="min-w-[120px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tip/Model
                        </th>
                        <th className="min-w-[100px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Marka
                        </th>
                        <th className="w-14 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Birim
                        </th>
                        <th className="w-24 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Miktar
                        </th>
                        <th className="w-16 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Para
                        </th>
                        <th className="w-24 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Birim Fiyat
                        </th>
                        <th className="w-28 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Toplam USD
                        </th>
                        <th className="w-24 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          $/Wp
                        </th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.items.map((item, ii) => {
                        const realGrpItems = groups[realGi]?.items;
                        const realIi =
                          realGrpItems?.findIndex((it) => it.code === item.code) ?? ii;
                        const totalUsd =
                          item.miktar * toUSD(item.rawFiyat, item.fiyatCur, settings);
                        const perWp = dcWp > 0 ? totalUsd / dcWp : 0;
                        const isReadOnly = type === "B" && group.code === "B.6";
                        return (
                          <tr
                            key={item.code}
                            className={cn(
                              "transition-colors",
                              isReadOnly ? "bg-info-soft/30" : "hover:bg-muted/40",
                            )}
                          >
                            <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                              {item.code}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="px-1 text-xs">{item.tanim}</span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "min-w-[130px]")}
                                  value={item.tanim}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "tanim", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.tip || "—"}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "min-w-[110px]")}
                                  value={item.tip || ""}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "tip", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.marka || "—"}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "min-w-[90px]")}
                                  value={item.marka || ""}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "marka", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.birim}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "w-12")}
                                  value={item.birim}
                                  onChange={(e) =>
                                    updateItem(realGi, realIi, "birim", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="block px-1 text-right text-xs text-muted-foreground">
                                  {fmt(item.miktar, 0)}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "w-22 text-right")}
                                  type="number"
                                  value={item.miktar}
                                  onChange={(e) =>
                                    updateItem(
                                      realGi,
                                      realIi,
                                      "miktar",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {item.fiyatCur}
                                </span>
                              ) : (
                                <select
                                  className="h-7 w-full rounded-md border bg-card px-1 text-xs"
                                  value={item.fiyatCur}
                                  onChange={(e) =>
                                    updateItem(
                                      realGi,
                                      realIi,
                                      "fiyatCur",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                  <option value="TRY">TRY</option>
                                </select>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly ? (
                                <span className="block px-1 text-right text-xs font-semibold text-info-soft-foreground">
                                  ${fmt(item.rawFiyat)}
                                </span>
                              ) : (
                                <Input
                                  className={cn(inputRowClass, "w-22 text-right")}
                                  type="number"
                                  step="0.001"
                                  value={item.rawFiyat}
                                  onChange={(e) =>
                                    updateItem(
                                      realGi,
                                      realIi,
                                      "rawFiyat",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">
                              ${fmt(totalUsd)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-xs text-info-soft-foreground">
                              {perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {isReadOnly ? (
                                <span className="px-1 text-[9px] font-semibold text-info-soft-foreground">
                                  CF Auto
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => removeItem(realGi, realIi)}
                                  className="rounded-md p-1 text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                                  aria-label="Kalemi sil"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-primary-soft/50">
                        <td
                          colSpan={8}
                          className="px-3 py-2 text-right text-xs font-semibold text-primary-soft-foreground"
                        >
                          {group.code} Toplam:
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-primary-soft-foreground">
                          ${fmt(grpTotal)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs font-medium text-info-soft-foreground">
                          {dcWp > 0 ? `$${(grpTotal / dcWp).toFixed(4)}/Wp` : ""}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Grand total */}
      <div className="overflow-hidden rounded-xl border-2 border-primary/30 bg-primary-soft">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-bold uppercase tracking-wider text-primary-soft-foreground">
            {type === "A" ? "Keşif-A" : "Keşif-B"} Genel Toplam
          </span>
          <div className="text-right">
            <span className="text-base font-bold text-primary-soft-foreground">
              ${fmt(grandTotal)}
            </span>
            <span className="ml-3 text-sm text-primary-soft-foreground/80">
              ₺{fmt(grandTotal * settings.usd)}
            </span>
            {dcWp > 0 && (
              <span className="ml-3 text-xs text-info-soft-foreground">
                ${(grandTotal / dcWp).toFixed(4)}/Wp
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
