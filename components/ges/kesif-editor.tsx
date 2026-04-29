"use client";

import { useState, useCallback, useMemo } from "react";
import { saveKesifA, saveKesifB } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toUSD, getGrpTot } from "@/lib/ges-engine";
import type { KesifGroup, KesifItem, GesSettings } from "@/lib/ges-defaults";
import { Save, ChevronDown, ChevronRight, Search, FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
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

function printKesif(title: string, groups: KesifGroup[], settings: GesSettings, grandTotal: number) {
  const isA = title.includes("A");
  const accentColor = isA ? "#d97706" : "#7c3aed";
  const accentLight = isA ? "#fef3c7" : "#ede9fe";
  const accentBorder = isA ? "#fbbf24" : "#a78bfa";

  const rows = groups.map((g) => {
    const grpTotal = getGrpTot(g, settings);
    const itemRows = g.items.map((it) => {
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
    }).join("");
    return `<tr class="group-row">
      <td colspan="2"><strong>${g.code} — ${g.name}</strong></td>
      <td colspan="4"></td>
      <td></td>
      <td style="text-align:right;font-weight:800;color:${accentColor}">$${fmt(grpTotal)}</td>
      <td style="text-align:right" class="dim">₺${fmt(grpTotal * settings.usd)}</td>
    </tr>${itemRows}`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;font-size:9.5px;color:#111;padding:0}
    .header{background:linear-gradient(135deg,#071120 0%,#0c1e3c 50%,#122448 100%);color:#fff;padding:16px 20px 14px;display:flex;justify-content:space-between;align-items:flex-end}
    .header h1{font-size:17px;font-weight:800;letter-spacing:-0.02em;color:#fff}
    .header .sub{font-size:9px;color:rgba(255,255,255,0.5);margin-top:3px}
    .header .total-badge{text-align:right}
    .header .total-badge .label{font-size:8px;color:rgba(251,191,36,0.6);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px}
    .header .total-badge .amount{font-size:22px;font-weight:900;color:#fbbf24;letter-spacing:-0.02em}
    .accent-bar{height:3px;background:linear-gradient(90deg,${accentColor},${accentBorder},transparent)}
    .content{padding:14px 20px 20px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:8.5px;font-weight:700;white-space:nowrap}
    td{padding:3.5px 7px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .group-row td{background:#f8fafc;border-top:2px solid #e2e8f0;border-bottom:1px solid #cbd5e1;font-size:10px;color:#1e293b;padding:5px 7px}
    .item-row:nth-child(even) td{background:#fcfcfd}
    .item-row:hover td{background:#fafafa}
    .code-cell{color:#94a3b8;font-family:monospace;font-size:8px;width:52px}
    .dim{color:#64748b}
    .num{color:#334155;font-variant-numeric:tabular-nums}
    .total-row td{background:${accentLight};font-weight:800;font-size:10px;border-top:3px double ${accentBorder}}
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
  setTimeout(() => { w.print(); }, 300);
}

export function KesifEditor({ projectId, type, data, settings }: Props) {
  const [groups, setGroups] = useState<KesifGroup[]>(data);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.map((g) => [g.code, true]))
  );
  const [search, setSearch] = useState("");

  const title = type === "A" ? "Kesif-A — Doğrudan Maliyetler" : "Kesif-B — Dolaylı Maliyetler";

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
    [settings]
  );

  function addItem(gi: number) {
    setGroups((prev) => {
      const g = prev[gi];
      return prev.map((grp, i) =>
        i !== gi ? grp : { ...grp, items: [...grp.items, newItem(grp.code, grp.items.length)] }
      );
    });
  }

  function removeItem(gi: number, ii: number) {
    setGroups((prev) =>
      prev.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter((_, idx) => idx !== ii) })
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (type === "A") await saveKesifA(projectId, groups as never);
      else await saveKesifB(projectId, groups as never);
      toast.success("Kaydedildi");
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
    return groups.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.tanim.toLowerCase().includes(q) ||
          (it.tip || "").toLowerCase().includes(q) ||
          (it.marka || "").toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [groups, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            Toplam: <span className="font-semibold text-slate-800">${fmt(grandTotal)}</span>
            {" / "}<span className="text-slate-500">₺{fmt(grandTotal * settings.usd)}</span>
            {dcWp > 0 && <span className="text-amber-600 ml-2 font-medium">${(grandTotal / dcWp).toFixed(4)}/Wp</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              className="pl-8 h-8 text-sm w-44"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => printKesif(title, groups, settings, grandTotal)}>
            <FileDown className="w-4 h-4" />
            PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="w-4 h-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      {filteredGroups.map((group, gi) => {
        const realGi = groups.findIndex((g) => g.code === group.code);
        const grpTotal = getGrpTot(group, settings);
        const isCollapsed = collapsed[group.code];
        const isAutoGroup = type === "B" && group.code === "B.6";

        return (
          <Card key={group.code} className={`overflow-hidden ${isAutoGroup ? "border-blue-200" : ""}`}>
            <CardHeader
              className="py-3 cursor-pointer select-none"
              onClick={() => setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                  <Badge variant="outline" className="text-xs font-mono">{group.code}</Badge>
                  <CardTitle className="text-sm font-semibold">{group.name}</CardTitle>
                  <span className="text-xs text-slate-400">({group.items.length} kalem)</span>
                  {isAutoGroup && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Cash Flow Otomatik</span>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-600">${fmt(grpTotal)}</span>
                    <span className="text-xs text-slate-400 ml-1.5">₺{fmt(grpTotal * settings.usd)}</span>
                    {dcWp > 0 && <span className="text-xs text-blue-500 ml-1.5">${(grpTotal / dcWp).toFixed(4)}/Wp</span>}
                  </div>
                  {!isAutoGroup && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); addItem(realGi); }}
                      className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-600"
                      title="Kalem ekle"
                    >
                      <Plus className="w-3.5 h-3.5" />
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
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-left text-slate-500 font-medium w-16">Kod</th>
                        <th className="px-2 py-2 text-left text-slate-500 font-medium min-w-[140px]">Tanım</th>
                        <th className="px-2 py-2 text-left text-slate-500 font-medium min-w-[120px]">Tip/Model</th>
                        <th className="px-2 py-2 text-left text-slate-500 font-medium min-w-[100px]">Marka</th>
                        <th className="px-2 py-2 text-left text-slate-500 font-medium w-14">Birim</th>
                        <th className="px-2 py-2 text-right text-slate-500 font-medium w-24">Miktar</th>
                        <th className="px-2 py-2 text-center text-slate-500 font-medium w-16">Para</th>
                        <th className="px-2 py-2 text-right text-slate-500 font-medium w-24">Birim Fiyat</th>
                        <th className="px-2 py-2 text-right text-slate-500 font-medium w-28">Toplam USD</th>
                        <th className="px-2 py-2 text-right text-slate-500 font-medium w-24">$/Wp</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item, ii) => {
                        const realGrpItems = groups[realGi]?.items;
                        const realIi = realGrpItems?.findIndex((it) => it.code === item.code) ?? ii;
                        const totalUsd = item.miktar * toUSD(item.rawFiyat, item.fiyatCur, settings);
                        const perWp = dcWp > 0 ? totalUsd / dcWp : 0;
                        const isReadOnly = type === "B" && group.code === "B.6";
                        return (
                          <tr key={item.code} className={`transition-colors ${isReadOnly ? "bg-blue-50/40" : "hover:bg-slate-50"}`}>
                            <td className="px-2 py-1.5 font-mono text-slate-400 text-xs">{item.code}</td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-slate-700 px-1">{item.tanim}</span>
                                : <Input className="h-7 text-xs border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 min-w-[130px]" value={item.tanim} onChange={(e) => updateItem(realGi, realIi, "tanim", e.target.value)} />
                              }
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-slate-500 px-1">{item.tip || "—"}</span>
                                : <Input className="h-7 text-xs border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 min-w-[110px]" value={item.tip || ""} onChange={(e) => updateItem(realGi, realIi, "tip", e.target.value)} />
                              }
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-slate-500 px-1">{item.marka || "—"}</span>
                                : <Input className="h-7 text-xs border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 min-w-[90px]" value={item.marka || ""} onChange={(e) => updateItem(realGi, realIi, "marka", e.target.value)} />
                              }
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-slate-500 px-1">{item.birim}</span>
                                : <Input className="h-7 text-xs border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 w-12" value={item.birim} onChange={(e) => updateItem(realGi, realIi, "birim", e.target.value)} />
                              }
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-right block text-slate-500 px-1">{fmt(item.miktar, 0)}</span>
                                : <Input className="h-7 text-xs text-right border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 w-22" type="number" value={item.miktar} onChange={(e) => updateItem(realGi, realIi, "miktar", parseFloat(e.target.value) || 0)} />
                              }
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-slate-500 px-1">{item.fiyatCur}</span>
                                : <select className="h-7 text-xs border border-slate-200 rounded bg-white px-1 w-full" value={item.fiyatCur} onChange={(e) => updateItem(realGi, realIi, "fiyatCur", e.target.value)}>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="TRY">TRY</option>
                                  </select>
                              }
                            </td>
                            <td className="px-2 py-1.5">
                              {isReadOnly
                                ? <span className="text-xs text-right block font-semibold text-blue-600 px-1">${fmt(item.rawFiyat)}</span>
                                : <Input className="h-7 text-xs text-right border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 w-22" type="number" step="0.001" value={item.rawFiyat} onChange={(e) => updateItem(realGi, realIi, "rawFiyat", parseFloat(e.target.value) || 0)} />
                              }
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                              ${fmt(totalUsd)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-blue-500 text-xs">
                              {perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {isReadOnly
                                ? <span className="text-[9px] text-blue-400 font-semibold px-1">CF Auto</span>
                                : <button type="button" onClick={() => removeItem(realGi, realIi)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-50 border-t border-amber-200">
                        <td colSpan={8} className="px-3 py-2 text-right font-bold text-amber-800 text-xs">
                          {group.code} Toplam:
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-amber-700">
                          ${fmt(grpTotal)}
                        </td>
                        <td className="px-2 py-2 text-right text-blue-500 text-xs font-medium">
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
      <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "2px solid #fbbf24" }}>
        <div className="flex items-center justify-between px-5 py-3">
          <span className="font-extrabold text-amber-800 text-sm">
            {type === "A" ? "KESİF-A" : "KESİF-B"} GENEL TOPLAM
          </span>
          <div className="text-right">
            <span className="font-extrabold text-amber-700 text-base">${fmt(grandTotal)}</span>
            <span className="text-amber-600 text-sm ml-3">₺{fmt(grandTotal * settings.usd)}</span>
            {dcWp > 0 && <span className="text-blue-500 text-xs ml-3">${(grandTotal / dcWp).toFixed(4)}/Wp</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
