"use client";

import { useState, useMemo } from "react";
import { saveGesSettings, saveKesifA, saveKesifB } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calc, getGrpTot, toUSD } from "@/lib/ges-engine";
import type { KesifGroup, KesifItem, GesSettings, TimelineData } from "@/lib/ges-defaults";
import type { Project } from "@prisma/client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  ComposedChart, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Area, ReferenceLine, Legend,
} from "recharts";
import {
  DollarSign, Zap, FileDown, Save, Plus, X,
  TrendingUp, ChevronRight, Edit2, BarChart2,
} from "lucide-react";
import { toast } from "sonner";

const PIE_COLORS = [
  "#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4",
  "#f97316","#84cc16","#ec4899","#6366f1","#14b8a6","#a855f7",
];

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  projectId: string;
  project: Project;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  timeline: TimelineData;
}

export function AnalizDashboard({ projectId, project, kesifA: kesifAInit, kesifB: kesifBInit, settings, timeline }: Props) {
  const [s, setS] = useState<GesSettings>(settings);
  const [localKesifA, setLocalKesifA] = useState<KesifGroup[]>(kesifAInit);
  const [localKesifB, setLocalKesifB] = useState<KesifGroup[]>(kesifBInit);
  const [saving, setSaving] = useState(false);
  const [marginDirty, setMarginDirty] = useState(false);
  const [hiddenItemKeys, setHiddenItemKeys] = useState<Set<string>>(new Set());

  // Alt modal
  const [addAltOpen, setAddAltOpen] = useState<"panel" | "konstr" | "inv" | null>(null);
  const [newAltName, setNewAltName] = useState("");
  const [newAltPrice, setNewAltPrice] = useState("");

  // Group editor modal
  const [editGrp, setEditGrp] = useState<{ grp: KesifGroup; isA: boolean } | null>(null);
  const [editItems, setEditItems] = useState<KesifItem[]>([]);

  // Derived panel count
  const panelAdetCalc = s.dcGuc > 0 && s.panelGuc > 0
    ? Math.round((s.dcGuc * 1_000_000) / s.panelGuc)
    : (s.panelAdet || 0);

  // Apply alt selections on top of localKesifA
  const modifiedKesifA = useMemo(() => {
    return localKesifA.map((g) => {
      if (g.code === "A.1") {
        const alt = s.panelAlts[s.selPanel];
        if (!alt) return g;
        return { ...g, items: g.items.map((it) => it.code === "A.1.1" ? { ...it, birimFiyat: alt.price, rawFiyat: alt.price, fiyatCur: "USD" as const } : it) };
      }
      if (g.code === "A.3") {
        const alt = s.konstrAlts[s.selKonstr];
        if (!alt) return g;
        return { ...g, items: g.items.map((it) => it.code === "A.3.1" ? { ...it, birimFiyat: alt.price, rawFiyat: alt.price, fiyatCur: "USD" as const } : it) };
      }
      if (g.code === "A.2") {
        const alt = s.invAlts[s.selInv];
        if (!alt || alt.price === 0) return g;
        return { ...g, items: g.items.map((it) => it.code === "A.2.1" ? { ...it, birimFiyat: alt.price, rawFiyat: alt.price, fiyatCur: "USD" as const } : it) };
      }
      return g;
    });
  }, [localKesifA, s]);

  const result = useMemo(() => calc(modifiedKesifA, localKesifB, s), [modifiedKesifA, localKesifB, s]);
  const dcWp = s.dcGuc * 1_000_000;

  // ── Derived analytics ───────────────────────────────────────────────────────
  const sensitivityRates = [-0.20, -0.10, 0, 0.10, 0.20].map((delta) => ({
    label: delta === 0 ? "Güncel" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
    rate: s.usd * (1 + delta),
    tryAmt: result.salePriceUsd * s.usd * (1 + delta),
    isBase: delta === 0,
  }));

  // Pie data — group level
  const allPieItems = useMemo(() => {
    const items: { key: string; name: string; value: number }[] = [];
    for (const g of [...modifiedKesifA, ...localKesifB]) {
      const val = getGrpTot(g, s);
      if (val > 0) items.push({ key: g.code, name: `${g.code} ${g.name}`, value: val });
    }
    return items;
  }, [modifiedKesifA, localKesifB, s]);

  const pieData = useMemo(() => allPieItems.filter((d) => !hiddenItemKeys.has(d.key)), [allPieItems, hiddenItemKeys]);
  const totalPieValue = pieData.reduce((a, b) => a + b.value, 0);

  function togglePieItem(key: string) {
    setHiddenItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Cash flow mini chart
  const cfData = useMemo(() => {
    if (!timeline?.rows?.length) return [];
    const MONTHS_TR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    let cum = 0;
    return Array.from({ length: timeline.months }, (_, m) => {
      let inflow = 0, outflow = 0;
      for (const row of timeline.rows) {
        const pct = row.values[m] / 100;
        if (!pct) continue;
        if (row.type === "inflow") {
          inflow += pct * result.salePriceUsd;
        } else {
          const grp = [...modifiedKesifA, ...localKesifB].find((g) => row.name.startsWith(g.code));
          if (grp) outflow += pct * getGrpTot(grp, s);
        }
      }
      const net = inflow - outflow;
      cum += net;
      const creditInterest = cum < 0 ? Math.abs(cum) * (s.krediFaiz / 100 / 12) : 0;
      const depositInterest = cum > 0 ? cum * ((s.mevduat ?? 0) / 100 / 12) : 0;
      const finalCum = cum - creditInterest + depositInterest;
      cum = finalCum;
      const offset = m + (timeline.startMonth ?? 0);
      const label = `${MONTHS_TR[offset % 12]} ${timeline.startYear + Math.floor(offset / 12)}`;
      return { label, Giriş: inflow / 1000, Çıkış: -outflow / 1000, Kümülatif: finalCum / 1000 };
    });
  }, [timeline, result, modifiedKesifA, localKesifB, s]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleAltChange(field: "selPanel" | "selKonstr" | "selInv", idx: number) {
    const newS = { ...s, [field]: idx };
    setS(newS);
    setSaving(true);
    try {
      await saveGesSettings(projectId, { [field]: idx } as never);
      toast.success("Malzeme seçimi güncellendi");
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  async function handleSaveMargins() {
    setSaving(true);
    try {
      await saveGesSettings(projectId, { contingency: s.contingency, genelGider: s.genelGider, netKar: s.netKar } as never);
      setMarginDirty(false);
      toast.success("Marjlar kaydedildi");
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  function updateMargin(field: "contingency" | "genelGider" | "netKar", val: string) {
    setS((p) => ({ ...p, [field]: parseFloat(val) || 0 }));
    setMarginDirty(true);
  }

  async function handleAddAlt() {
    if (!addAltOpen || !newAltName.trim() || !newAltPrice) return;
    const price = parseFloat(newAltPrice);
    if (isNaN(price) || price <= 0) { toast.error("Geçerli bir fiyat girin"); return; }
    const newEntry = { name: newAltName.trim(), price };
    let newS: GesSettings;
    if (addAltOpen === "panel") newS = { ...s, panelAlts: [...s.panelAlts, newEntry] };
    else if (addAltOpen === "konstr") newS = { ...s, konstrAlts: [...s.konstrAlts, newEntry] };
    else newS = { ...s, invAlts: [...s.invAlts, newEntry] };
    setS(newS);
    setSaving(true);
    try {
      await saveGesSettings(projectId, { panelAlts: newS.panelAlts, konstrAlts: newS.konstrAlts, invAlts: newS.invAlts } as never);
      toast.success("Alternatif eklendi");
      setAddAltOpen(null); setNewAltName(""); setNewAltPrice("");
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  async function handleRemoveAlt(category: "panel" | "konstr" | "inv", idx: number) {
    let newS: GesSettings;
    if (category === "panel") newS = { ...s, panelAlts: s.panelAlts.filter((_, i) => i !== idx), selPanel: Math.min(s.selPanel, s.panelAlts.length - 2) };
    else if (category === "konstr") newS = { ...s, konstrAlts: s.konstrAlts.filter((_, i) => i !== idx), selKonstr: Math.min(s.selKonstr, s.konstrAlts.length - 2) };
    else newS = { ...s, invAlts: s.invAlts.filter((_, i) => i !== idx), selInv: Math.min(s.selInv, s.invAlts.length - 2) };
    setS(newS);
    setSaving(true);
    try {
      await saveGesSettings(projectId, { panelAlts: newS.panelAlts, konstrAlts: newS.konstrAlts, invAlts: newS.invAlts } as never);
      toast.success("Alternatif silindi");
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  function openGroupEditor(grp: KesifGroup, isA: boolean) {
    setEditGrp({ grp, isA });
    setEditItems(grp.items.map((it) => ({ ...it })));
  }

  async function handleSaveGroup() {
    if (!editGrp) return;
    const updated = editGrp.isA
      ? localKesifA.map((g) => g.code === editGrp.grp.code ? { ...g, items: editItems } : g)
      : localKesifB.map((g) => g.code === editGrp.grp.code ? { ...g, items: editItems } : g);
    setSaving(true);
    try {
      if (editGrp.isA) {
        setLocalKesifA(updated);
        await saveKesifA(projectId, updated);
      } else {
        setLocalKesifB(updated);
        await saveKesifB(projectId, updated);
      }
      toast.success("Kaydedildi");
      setEditGrp(null);
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  function updateEditItem(idx: number, field: keyof KesifItem, val: string | number) {
    setEditItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: val };
      if (field === "rawFiyat" || field === "fiyatCur") {
        updated.birimFiyat = toUSD(
          field === "rawFiyat" ? Number(val) : it.rawFiyat,
          field === "fiyatCur" ? String(val) : it.fiyatCur,
          s
        );
      }
      return updated;
    }));
  }

  const altModalConfig = {
    panel: { title: "Panel Alternatifi Ekle", placeholder: "Örn: LONGi Hi-MO 6", pricePlaceholder: "0.185", priceUnit: "USD/Wp" },
    konstr: { title: "Konstrüksiyon Alternatifi Ekle", placeholder: "Örn: Tek Eksen İzleyici", pricePlaceholder: "85000", priceUnit: "$/MW" },
    inv: { title: "İnverter Alternatifi Ekle", placeholder: "Örn: Huawei SUN2000", pricePlaceholder: "4200", priceUnit: "$/adet" },
  };

  return (
    <div className="space-y-3">

      {/* ── Alt Ekleme Modal ── */}
      {addAltOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-slate-800 text-sm">{altModalConfig[addAltOpen].title}</h2>
              </div>
              <button onClick={() => setAddAltOpen(null)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Malzeme / Model Adı</Label>
                <Input value={newAltName} onChange={(e) => setNewAltName(e.target.value)} placeholder={altModalConfig[addAltOpen].placeholder} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Birim Fiyat ({altModalConfig[addAltOpen].priceUnit})</Label>
                <Input type="number" step="0.001" value={newAltPrice} onChange={(e) => setNewAltPrice(e.target.value)} placeholder={altModalConfig[addAltOpen].pricePlaceholder} />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-5 py-3.5 border-t border-slate-100">
              <button onClick={() => setAddAltOpen(null)} className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Vazgeç</button>
              <button onClick={handleAddAlt} disabled={saving || !newAltName.trim() || !newAltPrice}
                className="h-9 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grup Düzenleme Modal ── */}
      {editGrp && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center">
                  <Edit2 className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">{editGrp.grp.code} — {editGrp.grp.name}</h2>
                  <p className="text-xs text-slate-400">{editGrp.isA ? "Kesif-A" : "Kesif-B"} · Değişiklikler kaydedince Kesife yansır</p>
                </div>
              </div>
              <button onClick={() => setEditGrp(null)} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-slate-500 font-semibold w-16">Kod</th>
                    <th className="px-4 py-2.5 text-left text-slate-500 font-semibold">Tanım</th>
                    <th className="px-4 py-2.5 text-center text-slate-500 font-semibold min-w-[90px]">Birim</th>
                    <th className="px-4 py-2.5 text-center text-slate-500 font-semibold w-24">Miktar</th>
                    <th className="px-4 py-2.5 text-center text-slate-500 font-semibold w-28">Birim Fiyat</th>
                    <th className="px-4 py-2.5 text-center text-slate-500 font-semibold w-20">Para</th>
                    <th className="px-4 py-2.5 text-right text-slate-500 font-semibold w-28">Toplam USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editItems.map((it, i) => {
                    const totalUsd = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s);
                    return (
                      <tr key={it.code} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-400">{it.code}</td>
                        <td className="px-4 py-2 text-slate-700">{it.tanim}</td>
                        <td className="px-4 py-2 text-center text-slate-500 whitespace-nowrap">{it.birim}</td>
                        <td className="px-4 py-2">
                          <Input type="number" step="any" value={it.miktar || ""}
                            onChange={(e) => updateEditItem(i, "miktar", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs text-center w-full" />
                        </td>
                        <td className="px-4 py-2">
                          <Input type="number" step="any" value={it.rawFiyat || ""}
                            onChange={(e) => updateEditItem(i, "rawFiyat", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs text-center w-full" />
                        </td>
                        <td className="px-4 py-2">
                          <select value={it.fiyatCur}
                            onChange={(e) => updateEditItem(i, "fiyatCur", e.target.value)}
                            className="h-7 w-full text-xs border border-slate-200 rounded-md px-1 bg-white">
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="TRY">TRY</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-800">${fmt(totalUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td colSpan={6} className="px-4 py-2.5 font-bold text-slate-700">Grup Toplam</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-700">
                      ${fmt(editItems.reduce((sum, it) => sum + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex gap-3 justify-end px-6 py-3.5 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setEditGrp(null)} className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Vazgeç</button>
              <button onClick={handleSaveGroup} disabled={saving}
                className="h-9 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #0f1f3d, #1e3a5f)" }}>
                <Save className="w-4 h-4" /> Kaydet &amp; Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl p-4 text-white relative overflow-hidden col-span-1" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 8px 24px rgba(245,158,11,0.35)" }}>
          <div className="absolute right-3 top-3 opacity-20"><DollarSign className="w-10 h-10" /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1.5">EPC Satış Fiyatı</p>
          <p className="text-xl font-bold">${fmt(result.salePriceUsd)}</p>
          <p className="text-xs opacity-70 mt-0.5">₺{fmt(result.salePriceTry)}</p>
        </div>
        <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", boxShadow: "0 8px 24px rgba(59,130,246,0.3)" }}>
          <div className="absolute right-3 top-3 opacity-20"><Zap className="w-10 h-10" /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1.5">Özgül Maliyet</p>
          <p className="text-xl font-bold">{result.perKwUsd.toFixed(3)}</p>
          <p className="text-xs opacity-70 mt-0.5">USD/kWp</p>
        </div>
        <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
          <div className="absolute right-3 top-3 opacity-20"><Zap className="w-10 h-10" /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1.5">DC / AC Güç</p>
          <p className="text-xl font-bold">{s.dcGuc.toFixed(2)} MW</p>
          <p className="text-xs opacity-75 mt-0.5">{(s.dcGuc * 1000).toFixed(0)} kWp · AC: {s.acGuc.toFixed(2)} MW · Oran: {s.dcGuc > 0 && s.acGuc > 0 ? (s.dcGuc / s.acGuc).toFixed(2) : "—"}</p>
        </div>
        <div className="rounded-2xl p-4 bg-white border-0 shadow-md shadow-slate-200/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Maliyet Yapısı</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-baseline gap-1">
              <span className="text-slate-500">Kesif A+B</span>
              <div className="text-right"><span className="font-semibold text-slate-700">${fmt(result.directCost)}</span>{dcWp > 0 && <span className="text-slate-400 text-[10px] ml-1">/{(result.directCost/dcWp).toFixed(3)}$/Wp</span>}</div>
            </div>
            <div className="flex justify-between items-baseline gap-1">
              <span className="text-slate-500">Cont. %{s.contingency}</span>
              <div className="text-right"><span className="text-slate-600 font-medium">${fmt(result.contingencyAmt)}</span>{dcWp > 0 && <span className="text-slate-400 text-[10px] ml-1">/{(result.contingencyAmt/dcWp).toFixed(3)}$/Wp</span>}</div>
            </div>
            <div className="flex justify-between items-baseline gap-1 pt-0.5 border-t border-slate-100">
              <span className="text-slate-800 font-bold">Maliyet</span>
              <div className="text-right"><span className="font-bold text-slate-900">${fmt(result.totalCost)}</span>{dcWp > 0 && <span className="text-slate-400 text-[10px] ml-1">/{(result.totalCost/dcWp).toFixed(3)}$/Wp</span>}</div>
            </div>
            <div className="flex justify-between items-baseline gap-1 pt-0.5 border-t border-slate-100">
              <span className="text-blue-600">OHC %{s.genelGider}</span>
              <div className="text-right"><span className="text-blue-700 font-medium">${fmt(result.genelGiderAmt)}</span>{dcWp > 0 && <span className="text-slate-400 text-[10px] ml-1">/{(result.genelGiderAmt/dcWp).toFixed(3)}$/Wp</span>}</div>
            </div>
            <div className="flex justify-between items-baseline gap-1">
              <span className="text-emerald-600">Kar %{s.netKar}</span>
              <div className="text-right"><span className="text-emerald-700 font-medium">${fmt(result.netKarAmt)}</span>{dcWp > 0 && <span className="text-slate-400 text-[10px] ml-1">/{(result.netKarAmt/dcWp).toFixed(3)}$/Wp</span>}</div>
            </div>
            <div className="flex justify-between items-baseline gap-1 pt-0.5 border-t border-slate-100">
              <span className="text-emerald-700 font-bold">Brüt Kar</span>
              <div className="text-right"><span className="font-bold text-emerald-800">${fmt(result.brutKar)}</span>{dcWp > 0 && <span className="text-slate-400 text-[10px] ml-1">/{(result.brutKar/dcWp).toFixed(3)}$/Wp</span>}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 bg-white border-0 shadow-md shadow-slate-200/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Panel &amp; İnverter</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-600">Panel Sayısı</span><span className="font-bold text-slate-800">{fmt(panelAdetCalc)} adet</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Panel Gücü</span><span className="text-slate-600 font-medium">{s.panelGuc} Wp</span></div>
            <div className="flex justify-between pt-1 border-t border-slate-100"><span className="text-slate-600">İnverter Sayısı</span><span className="font-bold text-slate-800">{s.invAdet ?? "—"} adet</span></div>
            <div className="flex justify-between"><span className="text-slate-500">İnverter Gücü</span><span className="text-slate-600 font-medium">{s.invGuc} kVA</span></div>
          </div>
        </div>
      </div>

      {/* ── Marjlar ── */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
              <DollarSign className="w-3 h-3 text-white" />
            </div>
            <h3 className="font-bold text-slate-700 text-xs">Maliyet Marjları</h3>
          </div>
          <div className="flex gap-1.5">
            {marginDirty && (
              <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleSaveMargins} disabled={saving}>
                <Save className="w-3 h-3" />Kaydet
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => window.print()}>
              <FileDown className="w-3 h-3" />Analiz Yazdır
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Contingency (%)", field: "contingency" as const, val: s.contingency, amt: result.contingencyAmt, color: "text-slate-600" },
              { label: "Overhead Cost (%)", field: "genelGider" as const, val: s.genelGider, amt: result.genelGiderAmt, color: "text-blue-600" },
              { label: "Net Kar (%)", field: "netKar" as const, val: s.netKar, amt: result.netKarAmt, color: "text-emerald-600" },
            ].map((m) => (
              <div key={m.field} className="space-y-1.5">
                <Label className="text-sm">{m.label}</Label>
                <Input type="number" step="0.5" value={m.val} onChange={(e) => updateMargin(m.field, e.target.value)} />
                <p className={`text-xs font-medium ${m.color}`}>${fmt(m.amt)} · ₺{fmt(m.amt * s.usd)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Kritik Malzeme Seçimi ── */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Zap className="w-3 h-3 text-white" />
            </div>
            <h3 className="font-bold text-slate-700 text-xs">Kritik Malzeme Seçimi — KPI Etkisi</h3>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([
              {
                label: "Panel", category: "panel" as const, field: "selPanel" as const,
                alts: s.panelAlts, selIdx: s.selPanel,
                makeTestKesif: (alt: { price: number }) => localKesifA.map((g) => g.code === "A.1" ? { ...g, items: g.items.map((it) => it.code === "A.1.1" ? { ...it, rawFiyat: alt.price } : it) } : g),
                priceLabel: (p: number) => `$${p}/Wp`,
              },
              {
                label: "Konstrüksiyon", category: "konstr" as const, field: "selKonstr" as const,
                alts: s.konstrAlts, selIdx: s.selKonstr,
                makeTestKesif: (alt: { price: number }) => localKesifA.map((g) => g.code === "A.3" ? { ...g, items: g.items.map((it) => it.code === "A.3.1" ? { ...it, rawFiyat: alt.price } : it) } : g),
                priceLabel: (p: number) => `$${fmt(p)}/MW`,
              },
              {
                label: "İnverter", category: "inv" as const, field: "selInv" as const,
                alts: s.invAlts.filter((a) => a.price > 0), selIdx: s.selInv,
                makeTestKesif: (alt: { price: number }) => localKesifA.map((g) => g.code === "A.2" ? { ...g, items: g.items.map((it) => it.code === "A.2.1" ? { ...it, rawFiyat: alt.price } : it) } : g),
                priceLabel: (p: number) => `$${fmt(p)}/adet`,
              },
            ] as const).map(({ label, category, field, alts, selIdx, makeTestKesif, priceLabel }) => (
              <div key={field} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                  <button type="button"
                    onClick={() => { setAddAltOpen(category); setNewAltName(""); setNewAltPrice(""); }}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-all">
                    <Plus className="w-3 h-3" /> Ekle
                  </button>
                </div>
                {alts.map((alt, i) => {
                  const testResult = calc(makeTestKesif(alt), localKesifB, s);
                  const actualIdx = field === "selInv" ? s.invAlts.findIndex((a) => a.name === alt.name) : i;
                  const isSel = (field === "selInv" ? s.selInv : selIdx) === actualIdx;
                  return (
                    <div key={i} className="relative group">
                      <button type="button" onClick={() => handleAltChange(field, actualIdx)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${isSel ? "shadow-md shadow-amber-500/20" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                        style={isSel ? { background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "#fbbf24" } : {}}>
                        <div className="flex items-center justify-between mb-1 pr-5">
                          <span className="font-semibold text-slate-800 text-xs">{alt.name}</span>
                          {isSel && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">✓ Seçili</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="font-medium text-amber-600">{priceLabel(alt.price)}</span>
                          {" · "}Toplam: <span className="font-semibold text-slate-700">${fmt(testResult.salePriceUsd)}</span>
                        </div>
                      </button>
                      {alts.length > 1 && (
                        <button type="button" onClick={() => handleRemoveAlt(category, actualIdx)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-all" title="Kaldır">
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Maliyet Dağılımı (Donut) ── */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Maliyet Dağılımı (USD)</h3>
          </div>
          {hiddenItemKeys.size > 0 && (
            <button onClick={() => setHiddenItemKeys(new Set())} className="text-xs text-amber-600 hover:underline font-semibold">Tümünü göster</button>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-5 items-center">
            <div className="w-full lg:w-[360px] flex-shrink-0">
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={135} innerRadius={72} paddingAngle={1.5} dataKey="value" labelLine={false}
                    onClick={(d) => { const key = (d as { key?: string | null }).key; if (key) togglePieItem(key); }}
                    style={{ cursor: "pointer" }}>
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={PIE_COLORS[allPieItems.findIndex((x) => x.key === d.key) % PIE_COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-10" fontSize={10} fill="#94a3b8" fontWeight={600}>TOPLAM</tspan>
                    <tspan x="50%" dy="24" fontSize={17} fill="#0f172a" fontWeight={800}>${fmt(totalPieValue)}</tspan>
                  </text>
                  <Tooltip formatter={(v) => `$${fmt(Number(v))}`}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[340px] overflow-y-auto pr-1">
              {allPieItems.map((d, i) => {
                const hidden = hiddenItemKeys.has(d.key);
                const pct = totalPieValue > 0 && !hidden ? (d.value / totalPieValue * 100).toFixed(1) : "—";
                return (
                  <button key={d.key} type="button" onClick={() => togglePieItem(d.key)}
                    className={`flex items-start gap-2.5 text-xs text-left rounded-xl px-3 py-2 transition-all border ${hidden ? "opacity-35 border-slate-100" : "hover:bg-slate-50 border-transparent"}`}>
                    <div className="w-3.5 h-3.5 rounded flex-shrink-0 mt-0.5" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-600 leading-tight block truncate">{d.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-slate-400 font-semibold">{pct}%</span>
                        <span className="text-slate-500 font-medium">{!hidden ? `$${fmt(d.value)}` : "—"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Maliyet Kırılımı + Grup Dağılımı ── */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f1f3d, #1e3a5f)" }}>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Maliyet Kırılımı</h3>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-medium">Kesif-A</td>
                  <td className="px-5 py-2.5 text-right font-bold text-amber-600">${fmt(result.kaTotal)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-400 text-xs">{dcWp > 0 ? `$${(result.kaTotal/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-medium">Kesif-B</td>
                  <td className="px-5 py-2.5 text-right font-bold text-purple-600">${fmt(result.kbTotal)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-400 text-xs">{dcWp > 0 ? `$${(result.kbTotal/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-medium">Contingency (%{s.contingency})</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-slate-600">${fmt(result.contingencyAmt)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-400 text-xs">{dcWp > 0 ? `$${(result.contingencyAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr className="bg-slate-100 border-y-2 border-slate-300">
                  <td className="px-5 py-2.5 font-extrabold text-slate-900">Maliyet</td>
                  <td className="px-5 py-2.5 text-right font-extrabold text-slate-900">${fmt(result.totalCost)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-500 text-xs font-semibold">{dcWp > 0 ? `$${(result.totalCost/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-medium">Overhead Cost (%{s.genelGider})</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-blue-600">${fmt(result.genelGiderAmt)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-400 text-xs">{dcWp > 0 ? `$${(result.genelGiderAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-medium">Net Kar (%{s.netKar})</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-emerald-600">${fmt(result.netKarAmt)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-400 text-xs">{dcWp > 0 ? `$${(result.netKarAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr className="bg-emerald-50 border-y-2 border-emerald-300">
                  <td className="px-5 py-2.5 font-extrabold text-emerald-900">Brüt Kar</td>
                  <td className="px-5 py-2.5 text-right font-extrabold text-emerald-700">${fmt(result.brutKar)}</td>
                  <td className="px-5 py-2.5 text-right text-blue-500 text-xs font-semibold">{dcWp > 0 ? `$${(result.brutKar/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderTop: "2px solid #fbbf24" }}>
                  <td className="px-5 py-3 font-extrabold text-amber-800 text-sm">EPC SATIŞ FİYATI</td>
                  <td className="px-5 py-3 text-right font-extrabold text-amber-700 text-base">${fmt(result.salePriceUsd)}</td>
                  <td className="px-5 py-3 text-right text-blue-500 text-xs font-semibold">{dcWp > 0 ? `$${(result.salePriceUsd/dcWp).toFixed(4)}/Wp` : ""}</td>
                </tr>
                <tr style={{ background: "#fffbeb" }}>
                  <td className="px-5 py-1.5 text-xs font-medium text-amber-600">TL Karşılığı</td>
                  <td className="px-5 py-1.5 text-right text-sm font-bold text-amber-600">₺{fmt(result.salePriceTry)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Grup Dağılımı ($000)</h3>
          </div>
          <CardContent className="px-4 pb-4 pt-3">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={[...modifiedKesifA, ...localKesifB].map((g) => ({ name: g.code, usd: Math.round(getGrpTot(g, s) / 1000) })).filter((d) => d.usd > 0)} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`$${v}k`, "Toplam"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "12px" }} />
                <Bar dataKey="usd" radius={[5, 5, 0, 0]}>
                  {[...modifiedKesifA, ...localKesifB].filter((g) => Math.round(getGrpTot(g, s) / 1000) > 0).map((g, i) => (
                    <Cell key={g.code} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Döviz Duyarlılığı + Kârlılık Analizi ── */}
      <div className="grid lg:grid-cols-2 gap-3">
        {/* Döviz Duyarlılığı */}
        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0891b2, #0e7490)" }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Döviz Duyarlılığı</h3>
              <p className="text-xs text-slate-400">USD/TRY kur senaryolarına göre TL satış</p>
            </div>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2 text-left text-slate-500 font-semibold">Senaryo</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-semibold">USD/TRY</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-semibold">TL Satış</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-semibold">Fark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sensitivityRates.map((r) => (
                  <tr key={r.label} className={r.isBase ? "bg-amber-50 font-semibold" : "hover:bg-slate-50"}>
                    <td className={`px-4 py-2 ${r.isBase ? "text-amber-800" : "text-slate-600"}`}>{r.label}</td>
                    <td className={`px-4 py-2 text-right ${r.isBase ? "text-amber-700" : "text-slate-500"}`}>{fmt(r.rate, 2)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${r.isBase ? "text-amber-700" : "text-slate-800"}`}>₺{fmt(r.tryAmt)}</td>
                    <td className={`px-4 py-2 text-right text-xs ${r.isBase ? "text-slate-400" : r.tryAmt > result.salePriceTry ? "text-emerald-600" : "text-red-500"}`}>
                      {r.isBase ? "—" : `${r.tryAmt > result.salePriceTry ? "+" : ""}₺${fmt(r.tryAmt - result.salePriceTry)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Kârlılık Analizi — Direktör Görünümü */}
        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Kârlılık Analizi</h3>
              <p className="text-xs text-slate-400">Satış fiyatı üzerinden marj dağılımı</p>
            </div>
          </div>
          <CardContent className="p-4 space-y-4">
            {/* Maliyet yapısı stacked bar */}
            {result.salePriceUsd > 0 && (() => {
              const kaPct = result.kaTotal / result.salePriceUsd * 100;
              const kbPct = result.kbTotal / result.salePriceUsd * 100;
              const contPct = result.contingencyAmt / result.salePriceUsd * 100;
              const ohcPct = result.genelGiderAmt / result.salePriceUsd * 100;
              const karPct = result.netKarAmt / result.salePriceUsd * 100;
              return (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Satış Fiyatı Bileşimi</p>
                  <div className="flex h-8 rounded-xl overflow-hidden w-full gap-px">
                    <div className="flex items-center justify-center text-[9px] font-bold text-white overflow-hidden" style={{ width: `${kaPct}%`, background: "#f59e0b" }} title={`Kesif-A ${kaPct.toFixed(1)}%`}>A</div>
                    <div className="flex items-center justify-center text-[9px] font-bold text-white overflow-hidden" style={{ width: `${kbPct}%`, background: "#8b5cf6" }} title={`Kesif-B ${kbPct.toFixed(1)}%`}>B</div>
                    <div className="flex items-center justify-center text-[9px] font-bold text-white overflow-hidden" style={{ width: `${contPct}%`, background: "#64748b" }} title={`Contingency ${contPct.toFixed(1)}%`}>C</div>
                    <div className="flex items-center justify-center text-[9px] font-bold text-white overflow-hidden" style={{ width: `${ohcPct}%`, background: "#3b82f6" }} title={`OHC ${ohcPct.toFixed(1)}%`}>O</div>
                    <div className="flex items-center justify-center text-[9px] font-bold text-white overflow-hidden" style={{ width: `${karPct}%`, background: "#10b981" }} title={`Net Kar ${karPct.toFixed(1)}%`}>K</div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {[
                      { label: "Kesif-A", pct: kaPct, color: "#f59e0b" },
                      { label: "Kesif-B", pct: kbPct, color: "#8b5cf6" },
                      { label: "Contingency", pct: contPct, color: "#64748b" },
                      { label: "OHC", pct: ohcPct, color: "#3b82f6" },
                      { label: "Net Kar", pct: karPct, color: "#10b981" },
                    ].map((s) => (
                      <span key={s.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: s.color }} />
                        {s.label} <span className="font-semibold text-slate-700">{s.pct.toFixed(1)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 4 KPI metrikleri */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Brüt Kar Marjı",
                  value: result.salePriceUsd > 0 ? `${(result.brutKar / result.salePriceUsd * 100).toFixed(1)}%` : "—",
                  sub: `$${fmt(result.brutKar)}`,
                  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100",
                },
                {
                  label: "Net Kar Marjı",
                  value: result.salePriceUsd > 0 ? `${(result.netKarAmt / result.salePriceUsd * 100).toFixed(1)}%` : "—",
                  sub: `$${fmt(result.netKarAmt)}`,
                  color: "text-blue-700", bg: "bg-blue-50 border-blue-100",
                },
                {
                  label: "Kesif-A / Toplam",
                  value: result.directCost > 0 ? `${(result.kaTotal / result.directCost * 100).toFixed(1)}%` : "—",
                  sub: `$${fmt(result.kaTotal)}`,
                  color: "text-amber-700", bg: "bg-amber-50 border-amber-100",
                },
                {
                  label: "Markup Oranı",
                  value: result.totalCost > 0 ? `${((result.salePriceUsd / result.totalCost - 1) * 100).toFixed(1)}%` : "—",
                  sub: "Satış / Maliyet − 1",
                  color: "text-violet-700", bg: "bg-violet-50 border-violet-100",
                },
              ].map((m) => (
                <div key={m.label} className={`rounded-xl p-3 border ${m.bg}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{m.label}</p>
                  <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-slate-400">{m.sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tüm Kalemler Özet ── */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Tüm Kalemler Özet</CardTitle>
            <p className="text-xs text-slate-400">Bir gruba tıklayarak düzenleyebilirsiniz</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Kod</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Grup</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">Toplam USD</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">$/Wp</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">Pay %</th>
                  <th className="px-3 py-2 text-right text-emerald-600 font-medium">% Satış</th>
                  <th className="px-3 py-2 text-center text-slate-400 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modifiedKesifA.map((g) => {
                  const total = getGrpTot(g, s);
                  const pct = result.directCost > 0 ? (total / result.directCost) * 100 : 0;
                  const perWp = dcWp > 0 ? total / dcWp : 0;
                  return (
                    <tr key={g.code} className="hover:bg-violet-50/40 cursor-pointer transition-colors group"
                      onClick={() => openGroupEditor(localKesifA.find((x) => x.code === g.code) ?? g, true)}>
                      <td className="px-3 py-2 font-mono text-slate-400">{g.code}</td>
                      <td className="px-3 py-2 text-slate-700">{g.name}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">${fmt(total)}</td>
                      <td className="px-3 py-2 text-right text-blue-500">{perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-14 bg-slate-100 rounded-full h-1"><div className="h-1 bg-amber-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                          <span className="text-slate-500 w-8">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">{result.salePriceUsd > 0 ? `${(total/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-2 text-center"><ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 transition-colors" /></td>
                    </tr>
                  );
                })}
                <tr className="bg-amber-50 border-y-2 border-amber-200">
                  <td colSpan={2} className="px-3 py-2 font-bold text-amber-800">Kesif-A Ara Toplam</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">${fmt(result.kaTotal)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-500">{dcWp > 0 ? `$${(result.kaTotal/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-600">{result.directCost > 0 ? (result.kaTotal/result.directCost*100).toFixed(1) : "0"}%</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{result.salePriceUsd > 0 ? `${(result.kaTotal/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                  <td />
                </tr>
                {localKesifB.map((g) => {
                  const total = getGrpTot(g, s);
                  const pct = result.directCost > 0 ? (total / result.directCost) * 100 : 0;
                  const perWp = dcWp > 0 ? total / dcWp : 0;
                  return (
                    <tr key={g.code} className="hover:bg-violet-50/40 cursor-pointer transition-colors group"
                      onClick={() => openGroupEditor(g, false)}>
                      <td className="px-3 py-2 font-mono text-slate-400">{g.code}</td>
                      <td className="px-3 py-2 text-slate-700">{g.name}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">${fmt(total)}</td>
                      <td className="px-3 py-2 text-right text-blue-500">{perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-14 bg-slate-100 rounded-full h-1"><div className="h-1 bg-purple-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                          <span className="text-slate-500 w-8">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">{result.salePriceUsd > 0 ? `${(total/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-2 text-center"><ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 transition-colors" /></td>
                    </tr>
                  );
                })}
                <tr className="bg-purple-50 border-y-2 border-purple-200">
                  <td colSpan={2} className="px-3 py-2 font-bold text-purple-800">Kesif-B Ara Toplam</td>
                  <td className="px-3 py-2 text-right font-bold text-purple-700">${fmt(result.kbTotal)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-500">{dcWp > 0 ? `$${(result.kbTotal/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td className="px-3 py-2 text-right font-bold text-purple-600">{result.directCost > 0 ? (result.kbTotal/result.directCost*100).toFixed(1) : "0"}%</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{result.salePriceUsd > 0 ? `${(result.kbTotal/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                  <td />
                </tr>
              </tbody>
              <tfoot className="border-t-2 border-slate-300">
                <tr className="bg-slate-50 text-slate-600">
                  <td colSpan={2} className="px-3 py-2">Contingency (%{s.contingency})</td>
                  <td className="px-3 py-2 text-right font-semibold">${fmt(result.contingencyAmt)}</td>
                  <td className="px-3 py-2 text-right text-blue-400">{dcWp > 0 ? `$${(result.contingencyAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td />
                  <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{result.salePriceUsd > 0 ? `${(result.contingencyAmt/result.salePriceUsd*100).toFixed(1)}%` : ""}</td>
                  <td />
                </tr>
                <tr className="bg-slate-100 border-y-2 border-slate-300 font-bold text-slate-900">
                  <td colSpan={2} className="px-3 py-2">Maliyet</td>
                  <td className="px-3 py-2 text-right">${fmt(result.totalCost)}</td>
                  <td className="px-3 py-2 text-right text-blue-500 text-xs font-semibold">{dcWp > 0 ? `$${(result.totalCost/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td />
                  <td className="px-3 py-2 text-right text-emerald-600">{result.salePriceUsd > 0 ? `${(result.totalCost/result.salePriceUsd*100).toFixed(1)}%` : ""}</td>
                  <td />
                </tr>
                <tr className="bg-slate-50 text-blue-600">
                  <td colSpan={2} className="px-3 py-2">Overhead Cost (%{s.genelGider})</td>
                  <td className="px-3 py-2 text-right font-semibold">${fmt(result.genelGiderAmt)}</td>
                  <td className="px-3 py-2 text-right text-blue-400">{dcWp > 0 ? `$${(result.genelGiderAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td />
                  <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{result.salePriceUsd > 0 ? `${(result.genelGiderAmt/result.salePriceUsd*100).toFixed(1)}%` : ""}</td>
                  <td />
                </tr>
                <tr className="bg-slate-50 text-green-600 font-semibold">
                  <td colSpan={2} className="px-3 py-2">Net Kar (%{s.netKar})</td>
                  <td className="px-3 py-2 text-right">${fmt(result.netKarAmt)}</td>
                  <td className="px-3 py-2 text-right text-blue-400">{dcWp > 0 ? `$${(result.netKarAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td />
                  <td className="px-3 py-2 text-right text-emerald-600">{result.salePriceUsd > 0 ? `${(result.netKarAmt/result.salePriceUsd*100).toFixed(1)}%` : ""}</td>
                  <td />
                </tr>
                <tr className="bg-emerald-50 border-y-2 border-emerald-300 font-bold text-emerald-800">
                  <td colSpan={2} className="px-3 py-2">Brüt Kar</td>
                  <td className="px-3 py-2 text-right">${fmt(result.brutKar)}</td>
                  <td className="px-3 py-2 text-right text-blue-500 text-xs font-semibold">{dcWp > 0 ? `$${(result.brutKar/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td />
                  <td className="px-3 py-2 text-right text-emerald-700">{result.salePriceUsd > 0 ? `${(result.brutKar/result.salePriceUsd*100).toFixed(1)}%` : ""}</td>
                  <td />
                </tr>
                <tr className="bg-amber-50 border-t-2 border-amber-300">
                  <td colSpan={2} className="px-3 py-3 font-bold text-amber-800">EPC SATIŞ FİYATI</td>
                  <td className="px-3 py-3 text-right font-bold text-amber-700 text-sm">${fmt(result.salePriceUsd)}</td>
                  <td className="px-3 py-3 text-right text-blue-500 font-medium text-xs">{dcWp > 0 ? `$${(result.salePriceUsd/dcWp).toFixed(4)}/Wp` : ""}</td>
                  <td />
                  <td className="px-3 py-3 text-right font-bold text-emerald-700">100%</td>
                  <td />
                </tr>
                <tr className="bg-amber-50">
                  <td colSpan={2} className="px-3 py-1.5 text-xs text-amber-600">TL Karşılığı</td>
                  <td className="px-3 py-1.5 text-right text-xs text-amber-600">₺{fmt(result.salePriceTry)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Cash Flow Chart (combined) ── */}
      {cfData.length > 0 && (
        <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Aylık Nakit Akışı ve Kümülatif Pozisyon</h3>
          </div>
          <CardContent className="px-4 pb-4 pt-3">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={cfData} barGap={2} margin={{ top: 5, right: 40, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cfGirisGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="cfCikisGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="cumGradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="bars" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="cum" orientation="right" tick={{ fontSize: 10, fill: "#f59e0b" }} axisLine={false} tickLine={false} />
                <ReferenceLine yAxisId="bars" y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                <ReferenceLine yAxisId="cum" y={0} stroke="#fbbf2440" strokeWidth={1} strokeDasharray="4 2" />
                <Tooltip formatter={(v, name) => [`$${Number(v).toFixed(1)}k`, name]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar yAxisId="bars" dataKey="Giriş" fill="url(#cfGirisGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="bars" dataKey="Çıkış" fill="url(#cfCikisGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Area yAxisId="cum" type="monotone" dataKey="Kümülatif" stroke="#f59e0b" strokeWidth={2.5} fill="url(#cumGradPos)" dot={false}
                  activeDot={{ r: 5, fill: "#f59e0b", stroke: "white", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Notlar / Riskler / Müşteri Öngörüleri ── */}
      {((s.notes?.length ?? 0) > 0 || (s.risks?.length ?? 0) > 0 || (s.customerInsights?.length ?? 0) > 0) && (
        <div className="grid md:grid-cols-3 gap-3">
          {s.notes && s.notes.length > 0 && (
            <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
                  <FileDown className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Teklif Notları</h3>
              </div>
              <CardContent className="p-4">
                <ul className="space-y-1.5">
                  {s.notes.map((n, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-amber-600 text-xs font-bold">•</span></span>
                      {n}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {s.risks && s.risks.length > 0 && (
            <Card className="border-0 shadow-md shadow-red-100/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-red-50 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500"><span className="text-white text-xs font-bold">!</span></div>
                <h3 className="font-bold text-red-700 text-sm">Riskler</h3>
              </div>
              <CardContent className="p-4">
                <ul className="space-y-1.5">
                  {s.risks.map((r, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-red-500 text-xs">⚠</span></span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {s.customerInsights && s.customerInsights.length > 0 && (
            <Card className="border-0 shadow-md shadow-blue-100/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-50 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500"><span className="text-white text-xs font-bold">→</span></div>
                <h3 className="font-bold text-blue-700 text-sm">Müşteri Öngörüleri</h3>
              </div>
              <CardContent className="p-4">
                <ul className="space-y-1.5">
                  {s.customerInsights.map((c, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-2 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-blue-500 text-xs font-bold">→</span></span>
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
