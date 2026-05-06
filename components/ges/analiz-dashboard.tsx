"use client";

import { useState, useMemo, useRef } from "react";
import { saveGesSettings, saveKesifA, saveKesifB } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  calc,
  getGrpTot,
  toUSD,
  buildGroupTotals,
  getRowAmount,
} from "@/lib/ges-engine";
import type { KesifGroup, KesifItem, GesSettings, TimelineData } from "@/lib/ges-defaults";
import type { Project } from "@prisma/client";
import {
  Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Area, AreaChart, ReferenceLine, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, Zap, FileDown, Save, Plus, X,
  TrendingUp, ChevronRight, Edit2, BarChart2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NavActions } from "@/components/ges/nav-actions";

type SectionTone = "primary" | "info" | "success" | "warning" | "destructive";

const SECTION_TONE: Record<SectionTone, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary-soft", iconText: "text-primary-soft-foreground" },
  info: { iconBg: "bg-info-soft", iconText: "text-info-soft-foreground" },
  success: { iconBg: "bg-success-soft", iconText: "text-success-soft-foreground" },
  warning: { iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground" },
  destructive: { iconBg: "bg-destructive-soft", iconText: "text-destructive-soft-foreground" },
};

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

export function AnalizDashboard({ projectId, project: _project, kesifA: kesifAInit, kesifB: kesifBInit, settings, timeline }: Props) {
  void _project;
  const [s, setS] = useState<GesSettings>(settings);
  const [localKesifA, setLocalKesifA] = useState<KesifGroup[]>(kesifAInit);
  const [localKesifB, setLocalKesifB] = useState<KesifGroup[]>(kesifBInit);
  const [saving, setSaving] = useState(false);
  const [marginDirty, setMarginDirty] = useState(false);
  const [hiddenItemKeys, setHiddenItemKeys] = useState<Set<string>>(new Set());

  // Hierarchical donut drill state
  const [drilledGroupCode, setDrilledGroupCode] = useState<string | null>(null);

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

  // Apply alt selections on top of localKesifA. Secilen alternatif sadece
  // fiyatla degil, KALEM bilgisiyle de senkronize olur.
  const modifiedKesifA = useMemo(() => {
    function applyAlt(
      g: KesifGroup,
      itemCode: string,
      alt: { name: string; price: number } | undefined,
    ): KesifGroup {
      if (!alt) return g;
      return {
        ...g,
        items: g.items.map((it) =>
          it.code === itemCode
            ? {
                ...it,
                marka: alt.name,
                tip: alt.name,
                birimFiyat: alt.price,
                rawFiyat: alt.price,
                fiyatCur: "USD" as const,
              }
            : it,
        ),
      };
    }
    return localKesifA.map((g) => {
      if (g.code === "A.1") return applyAlt(g, "A.1.1", s.panelAlts[s.selPanel]);
      if (g.code === "A.3") return applyAlt(g, "A.3.1", s.konstrAlts[s.selKonstr]);
      if (g.code === "A.2") {
        const alt = s.invAlts[s.selInv];
        if (!alt || alt.price === 0) return g;
        return applyAlt(g, "A.2.1", alt);
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

  // Cashflow data — cashflow-view ile ortak hesap
  const groupTotals = useMemo(
    () => buildGroupTotals(modifiedKesifA, localKesifB, s),
    [modifiedKesifA, localKesifB, s],
  );
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
          outflow += pct * getRowAmount(row.name, groupTotals);
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
  }, [timeline, result, groupTotals, s]);

  // Total interest cost — cashflow-view ile birebir ayni hesap
  const totalInterestCost = useMemo(() => {
    if (!timeline?.rows?.length) return 0;
    let cum = 0;
    let totalInterest = 0;
    for (let m = 0; m < timeline.months; m++) {
      let inflow = 0, outflow = 0;
      for (const row of timeline.rows) {
        const pct = row.values[m] / 100;
        if (!pct) continue;
        if (row.type === "inflow") inflow += pct * result.salePriceUsd;
        else outflow += pct * getRowAmount(row.name, groupTotals);
      }
      const net = inflow - outflow;
      cum += net;
      const creditInterest = cum < 0 ? Math.abs(cum) * (s.krediFaiz / 100 / 12) : 0;
      const depositInterest = cum > 0 ? cum * ((s.mevduat ?? 0) / 100 / 12) : 0;
      totalInterest += creditInterest;
      cum = cum - creditInterest + depositInterest;
    }
    return totalInterest;
  }, [timeline, result, groupTotals, s]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleAltChange(field: "selPanel" | "selKonstr" | "selInv", idx: number) {
    const newS = { ...s, [field]: idx };
    setS(newS);
    const alt =
      field === "selPanel"
        ? s.panelAlts[idx]
        : field === "selKonstr"
          ? s.konstrAlts[idx]
          : s.invAlts[idx];
    const groupCode = field === "selPanel" ? "A.1" : field === "selKonstr" ? "A.3" : "A.2";
    const itemCode = field === "selPanel" ? "A.1.1" : field === "selKonstr" ? "A.3.1" : "A.2.1";

    let updatedKesifA = localKesifA;
    if (alt && !(field === "selInv" && alt.price === 0)) {
      updatedKesifA = localKesifA.map((g) =>
        g.code !== groupCode
          ? g
          : {
              ...g,
              items: g.items.map((it) =>
                it.code !== itemCode
                  ? it
                  : { ...it, marka: alt.name, tip: alt.name, birimFiyat: alt.price, rawFiyat: alt.price, fiyatCur: "USD" as const },
              ),
            },
      );
      setLocalKesifA(updatedKesifA);
    }

    setSaving(true);
    try {
      await Promise.all([
        saveGesSettings(projectId, { [field]: idx } as never),
        alt && updatedKesifA !== localKesifA
          ? saveKesifA(projectId, updatedKesifA as never)
          : Promise.resolve(),
      ]);
      toast.success("Malzeme seçimi güncellendi");
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  async function handleSaveMargins() {
    setSaving(true);
    try {
      await saveGesSettings(projectId, {
        contingency: s.contingency,
        genelGider: s.genelGider,
        netKar: s.netKar,
        krediFaiz: s.krediFaiz,
      } as never);
      setMarginDirty(false);
      toast.success("Marjlar kaydedildi");
    } catch { toast.error("Kayıt hatası"); }
    finally { setSaving(false); }
  }

  function updateMargin(field: "contingency" | "genelGider" | "netKar" | "krediFaiz", val: string) {
    setS((p) => ({ ...p, [field]: parseFloat(val) || 0 }));
    setMarginDirty(true);
  }

  /**
   * Inline KPI rate edit — slider'dan gelen surekli onChange'leri 350ms
   * debounce eder; UI ise anında günceller. Boylece slider surukleyince
   * server'a 100 istek gitmez.
   */
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  function saveOneMargin(
    field: "contingency" | "genelGider" | "netKar" | "krediFaiz",
    value: number,
  ) {
    setS((p) => ({ ...p, [field]: value }));
    const existing = saveTimersRef.current[field];
    if (existing) clearTimeout(existing);
    saveTimersRef.current[field] = setTimeout(() => {
      saveGesSettings(projectId, { [field]: value } as never).catch(() => {
        toast.error("Kayıt hatası");
      });
    }, 350);
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
      if (editGrp.isA) { setLocalKesifA(updated); await saveKesifA(projectId, updated); }
      else { setLocalKesifB(updated); await saveKesifB(projectId, updated); }
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
          s,
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

  // ── Hierarchical donut data ────────────────────────────────────────────────
  const drilledGroup = useMemo(() => {
    if (!drilledGroupCode) return null;
    return [...modifiedKesifA, ...localKesifB].find((g) => g.code === drilledGroupCode) ?? null;
  }, [drilledGroupCode, modifiedKesifA, localKesifB]);

  const donutOuter = useMemo(
    () => allPieItems.map((it) => ({ ...it, isA: it.key.startsWith("A") })),
    [allPieItems],
  );
  const donutOuterTotal = donutOuter.reduce((a, b) => a + b.value, 0);

  const donutInner = useMemo(() => {
    if (!drilledGroup) return [];
    const isA = drilledGroup.code.startsWith("A");
    return drilledGroup.items
      .map((it) => ({
        key: `${drilledGroup.code}::${it.code}`,
        name: it.tanim || it.code,
        value: it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s),
        isA,
      }))
      .filter((it) => it.value > 0);
  }, [drilledGroup, s]);
  const donutInnerTotal = donutInner.reduce((a, b) => a + b.value, 0);

  // Top 5 — en pahali kalemler (item level, A+B birlikte). Maliyet halkasi
  // kartinin altinda gosterilir; donut'un yan boslugunu doldurur ve patron
  // bakislari icin "para nereye gidiyor" sorusuna anlik cevap verir.
  const top5Items = useMemo(() => {
    const all: { groupCode: string; itemCode: string; name: string; value: number; isA: boolean }[] = [];
    for (const g of [...modifiedKesifA, ...localKesifB]) {
      for (const it of g.items) {
        const v = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s);
        if (v > 0) {
          all.push({
            groupCode: g.code,
            itemCode: it.code,
            name: it.tanim || it.code,
            value: v,
            isA: g.code.startsWith("A"),
          });
        }
      }
    }
    return all.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [modifiedKesifA, localKesifB, s]);
  const top5Total = top5Items.reduce((a, b) => a + b.value, 0);

  // 5 KPI hesaplari (sketch)
  const directCostPlusCont = result.totalCost; // = direct + contingency = "Maliyet"
  const finansMaliyeti = totalInterestCost;
  const sale = result.salePriceUsd;
  const pctOf = (x: number) => (sale > 0 ? (x / sale) * 100 : 0);

  return (
    <div className="space-y-6">

      {/* ─── Modals ────────────────────────────────────────────────────────── */}
      {addAltOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-foreground/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-md w-full max-w-sm mx-4 overflow-hidden border">
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <div className="flex items-center gap-3">
                <div className={cn("size-8 rounded-xl flex items-center justify-center", SECTION_TONE.primary.iconBg)}>
                  <Plus className={cn("size-4", SECTION_TONE.primary.iconText)} />
                </div>
                <h2 className="font-semibold text-foreground text-sm">{altModalConfig[addAltOpen].title}</h2>
              </div>
              <button onClick={() => setAddAltOpen(null)} className="size-8 rounded-lg border flex items-center justify-center hover:bg-muted">
                <X className="size-4 text-muted-foreground" />
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
            <div className="flex gap-3 justify-end px-5 py-3.5 border-t">
              <button onClick={() => setAddAltOpen(null)} className="h-9 px-4 rounded-xl border text-sm font-semibold text-muted-foreground hover:bg-muted">Vazgeç</button>
              <button onClick={handleAddAlt} disabled={saving || !newAltName.trim() || !newAltPrice}
                className="h-9 px-5 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 disabled:opacity-40 bg-primary hover:bg-primary/90">
                <Plus className="size-4" /> Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {editGrp && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-md w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 bg-primary-soft">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Edit2 className="size-4 text-primary-soft-foreground" />
                </div>
                <div>
                  <h2 className="font-semibold text-primary-soft-foreground text-sm">{editGrp.grp.code} — {editGrp.grp.name}</h2>
                  <p className="text-xs text-muted-foreground">{editGrp.isA ? "Kesif-A" : "Kesif-B"} · Değişiklikler kaydedince Kesife yansır</p>
                </div>
              </div>
              <button onClick={() => setEditGrp(null)} className="size-8 rounded-lg bg-card hover:bg-muted border flex items-center justify-center">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-muted border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-muted-foreground font-semibold w-16">Kod</th>
                    <th className="px-4 py-2.5 text-left text-muted-foreground font-semibold">Tanım</th>
                    <th className="px-4 py-2.5 text-center text-muted-foreground font-semibold min-w-[90px]">Birim</th>
                    <th className="px-4 py-2.5 text-center text-muted-foreground font-semibold w-24">Miktar</th>
                    <th className="px-4 py-2.5 text-center text-muted-foreground font-semibold w-28">Birim Fiyat</th>
                    <th className="px-4 py-2.5 text-center text-muted-foreground font-semibold w-20">Para</th>
                    <th className="px-4 py-2.5 text-right text-muted-foreground font-semibold w-28">Toplam USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {editItems.map((it, i) => {
                    const totalUsd = it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s);
                    return (
                      <tr key={it.code} className="hover:bg-muted/60">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{it.code}</td>
                        <td className="px-4 py-2 text-foreground">{it.tanim}</td>
                        <td className="px-4 py-2 text-center text-muted-foreground whitespace-nowrap">{it.birim}</td>
                        <td className="px-4 py-2">
                          <Input type="number" step="any" value={it.miktar || ""} onChange={(e) => updateEditItem(i, "miktar", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-center w-full" />
                        </td>
                        <td className="px-4 py-2">
                          <Input type="number" step="any" value={it.rawFiyat || ""} onChange={(e) => updateEditItem(i, "rawFiyat", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-center w-full" />
                        </td>
                        <td className="px-4 py-2">
                          <select value={it.fiyatCur} onChange={(e) => updateEditItem(i, "fiyatCur", e.target.value)} className="h-7 w-full text-xs border rounded-md px-1 bg-card">
                            <option value="USD">USD</option><option value="EUR">EUR</option><option value="TRY">TRY</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-foreground">${fmt(totalUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted border-t-2">
                    <td colSpan={6} className="px-4 py-2.5 font-semibold text-foreground">Grup Toplam</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary-soft-foreground">
                      ${fmt(editItems.reduce((sum, it) => sum + it.miktar * toUSD(it.rawFiyat, it.fiyatCur, s), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex gap-3 justify-end px-6 py-3.5 border-t flex-shrink-0">
              <button onClick={() => setEditGrp(null)} className="h-9 px-4 rounded-xl border text-sm font-semibold text-muted-foreground hover:bg-muted">Vazgeç</button>
              <button onClick={handleSaveGroup} disabled={saving} className="h-9 px-5 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 disabled:opacity-40 bg-primary hover:bg-primary/90">
                <Save className="size-4" /> Kaydet &amp; Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ╔═══════════════════════════════════════════════════════════════════╗ */}
      {/* ║ TOP SECTION — KPIs sol sutunda yiginli, Kritik Malzeme sag tepe  ║ */}
      {/* ╚═══════════════════════════════════════════════════════════════════╝ */}
      {/* Yazdır — sekme barının en sağına portallanır */}
      <NavActions>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          title="Analizi yazdır"
        >
          <FileDown className="size-3.5" /> Yazdır
        </button>
      </NavActions>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr] lg:items-start">

        {/* SOL — Hero + 5 KPI dikey sıkıştırılmış */}
        <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Sale Price — kompakt, Brut Kar Orani vurgulu altta */}
        <Card className="relative overflow-hidden bg-primary text-primary-foreground shadow-sm">
          <CardContent className="p-4">
            <div className="absolute right-3 top-3 opacity-15"><DollarSign className="size-12" /></div>
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
              Toplam EPC Satış Fiyatı
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
              ${fmt(result.salePriceUsd)}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs opacity-85 tabular-nums">
              <span>₺{fmt(result.salePriceTry)}</span>
              <span className="size-1 rounded-full bg-primary-foreground/40" />
              <span>{result.perKwUsd.toFixed(3)} USD/kWp</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
              <TrendingUp className="size-3" />
              Brüt Kar Oranı %{pctOf(result.brutKar).toFixed(1)}
            </div>
          </CardContent>
        </Card>

        {/* System Overview — kompakt */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", SECTION_TONE.info.iconBg)}>
                <Zap className={cn("size-3.5", SECTION_TONE.info.iconText)} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Sistem Bilgileri
              </p>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <SysRow label="DC" value={`${s.dcGuc.toFixed(2)} MWp`} />
              <SysRow label="AC" value={`${s.acGuc.toFixed(2)} MWe`} />
              <SysRow label="DC/AC" value={s.dcGuc > 0 && s.acGuc > 0 ? `${(s.dcGuc / s.acGuc).toFixed(2)}` : "—"} />
              {s.trafoSayisi > 0 && <SysRow label="Trafo" value={`${s.trafoSayisi} adet`} />}
              <SysRow label="Panel" value={`${fmt(panelAdetCalc)} × ${s.panelGuc} Wp`} fullWidth />
              <SysRow label="İnverter" value={`${s.invAdet || 0} × ${s.invGuc || 0} kVA`} fullWidth />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* 5 Cost-Breakdown KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <RatioKpi
          tone="muted"
          label="Maliyet"
          value={`$${fmt(directCostPlusCont)}`}
          pct={pctOf(directCostPlusCont)}
        />
        <RatioKpi
          tone="primary"
          label="Contingency"
          value={`$${fmt(result.contingencyAmt)}`}
          pct={pctOf(result.contingencyAmt)}
          ratePct={s.contingency}
          maxRate={10}
          onRateChange={(v) => saveOneMargin("contingency", v)}
        />
        <RatioKpi
          tone="info"
          label="OHC"
          value={`$${fmt(result.genelGiderAmt)}`}
          pct={pctOf(result.genelGiderAmt)}
          ratePct={s.genelGider}
          maxRate={20}
          onRateChange={(v) => saveOneMargin("genelGider", v)}
        />
        <RatioKpi
          tone="success"
          label="Net Kar"
          value={`$${fmt(result.netKarAmt)}`}
          pct={pctOf(result.netKarAmt)}
          ratePct={s.netKar}
          maxRate={30}
          onRateChange={(v) => saveOneMargin("netKar", v)}
        />
        <RatioKpi
          tone="warning"
          label="Finans Maliyeti"
          value={`$${fmt(finansMaliyeti)}`}
          pct={pctOf(finansMaliyeti)}
          ratePct={s.krediFaiz}
          rateLabel="Faiz"
          maxRate={20}
          onRateChange={(v) => saveOneMargin("krediFaiz", v)}
        />
      </div>

        </div>{/* SOL kapanis */}

        {/* SAG — Kritik Malzeme Seçimi: max KPI seviyesinde, içte scroll */}
        <div className="lg:max-h-[400px] lg:overflow-hidden">
          <Card className="lg:flex lg:h-full lg:max-h-[400px] lg:flex-col">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <div className={cn("size-7 rounded-lg flex items-center justify-center", SECTION_TONE.primary.iconBg)}>
                  <Zap className={cn("size-3.5", SECTION_TONE.primary.iconText)} />
                </div>
                <CardTitle className="text-sm">Kritik Malzeme Seçimi</CardTitle>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Seçili olan baseline · diğerleri delta</p>
            </CardHeader>
            <CardContent className="space-y-3 p-3 lg:flex-1 lg:overflow-y-auto">
              {([
                { label: "Panel", category: "panel" as const, field: "selPanel" as const,
                  alts: s.panelAlts, selIdx: s.selPanel,
                  makeTestKesif: (alt: { price: number }) => localKesifA.map((g) => g.code === "A.1" ? { ...g, items: g.items.map((it) => it.code === "A.1.1" ? { ...it, rawFiyat: alt.price } : it) } : g),
                  priceLabel: (p: number) => `$${p}/Wp` },
                { label: "Konstrüksiyon", category: "konstr" as const, field: "selKonstr" as const,
                  alts: s.konstrAlts, selIdx: s.selKonstr,
                  makeTestKesif: (alt: { price: number }) => localKesifA.map((g) => g.code === "A.3" ? { ...g, items: g.items.map((it) => it.code === "A.3.1" ? { ...it, rawFiyat: alt.price } : it) } : g),
                  priceLabel: (p: number) => `$${fmt(p)}/MW` },
                { label: "İnverter", category: "inv" as const, field: "selInv" as const,
                  alts: s.invAlts.filter((a) => a.price > 0), selIdx: s.selInv,
                  makeTestKesif: (alt: { price: number }) => localKesifA.map((g) => g.code === "A.2" ? { ...g, items: g.items.map((it) => it.code === "A.2.1" ? { ...it, rawFiyat: alt.price } : it) } : g),
                  priceLabel: (p: number) => `$${fmt(p)}/adet` },
              ] as const).map(({ label, category, field, alts, selIdx, makeTestKesif, priceLabel }) => (
                <div key={field} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
                    <button type="button"
                      onClick={() => { setAddAltOpen(category); setNewAltName(""); setNewAltPrice(""); }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-primary-soft-foreground bg-primary-soft hover:bg-primary-soft/70 px-2 py-0.5 rounded-md transition-all">
                      <Plus className="size-2.5" /> Ekle
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {alts.map((alt, i) => {
                      const testResult = calc(makeTestKesif(alt), localKesifB, s);
                      const actualIdx = field === "selInv" ? s.invAlts.findIndex((a) => a.name === alt.name) : i;
                      const isSel = (field === "selInv" ? s.selInv : selIdx) === actualIdx;
                      const delta = testResult.salePriceUsd - result.salePriceUsd;
                      const deltaPositive = delta > 50;
                      const deltaNegative = delta < -50;
                      return (
                        <div key={i} className="group relative">
                          <button type="button" onClick={() => handleAltChange(field, actualIdx)}
                            className={cn(
                              "w-full rounded-lg border p-2 text-left transition-all",
                              isSel ? "border-primary/30 bg-primary-soft shadow-sm" : "hover:border-primary/30 hover:bg-muted/60",
                            )}>
                            <div className="mb-0.5 flex items-center justify-between gap-2 pr-4">
                              <span className="text-[11px] font-semibold text-foreground truncate">{alt.name}</span>
                              {isSel ? (
                                <span className="rounded-full border border-primary/30 bg-primary-soft px-1.5 py-0 text-[9px] font-semibold text-primary-soft-foreground whitespace-nowrap">✓ Mevcut</span>
                              ) : (
                                <span className={cn(
                                  "whitespace-nowrap rounded-full border px-1.5 py-0 text-[9px] font-semibold tabular-nums",
                                  deltaPositive && "border-destructive/30 bg-destructive-soft text-destructive-soft-foreground",
                                  deltaNegative && "border-success/30 bg-success-soft text-success-soft-foreground",
                                  !deltaPositive && !deltaNegative && "border-border bg-muted text-muted-foreground",
                                )} title={`Toplam: $${fmt(testResult.salePriceUsd)}`}>
                                  {deltaPositive ? `+$${fmt(delta)}` : deltaNegative ? `−$${fmt(Math.abs(delta))}` : "≈ aynı"}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              <span className="font-medium text-primary-soft-foreground">{priceLabel(alt.price)}</span>
                              {isSel && (<>{" · "}<span className="font-semibold text-foreground">${fmt(testResult.salePriceUsd)}</span></>)}
                            </div>
                          </button>
                          {alts.length > 1 && (
                            <button type="button" onClick={() => handleRemoveAlt(category, actualIdx)}
                              className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive-soft opacity-0 transition-all hover:bg-destructive-soft/70 group-hover:opacity-100" title="Kaldır">
                              <X className="size-2.5 text-destructive-soft-foreground" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      </div>{/* TOP SECTION grid kapanis */}

      {/* ╔═══════════════════════════════════════════════════════════════════╗ */}
      {/* ║ Tüm Kalemler Özet — full width                                    ║ */}
      {/* ╚═══════════════════════════════════════════════════════════════════╝ */}
      <div>
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Tüm Kalemler Özet</CardTitle>
              <p className="text-xs text-muted-foreground">Bir gruba tıklayarak düzenleyebilirsiniz</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Kod</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Grup</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Toplam USD</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">$/Wp</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Pay %</th>
                    <th className="px-3 py-2 text-right text-success-soft-foreground font-medium">% Satış</th>
                    <th className="px-3 py-2 text-center text-muted-foreground font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {modifiedKesifA.map((g) => {
                    const total = getGrpTot(g, s);
                    const pct = result.directCost > 0 ? (total / result.directCost) * 100 : 0;
                    const perWp = dcWp > 0 ? total / dcWp : 0;
                    return (
                      <tr key={g.code} className="hover:bg-primary-soft/40 cursor-pointer transition-colors group"
                        onClick={() => openGroupEditor(localKesifA.find((x) => x.code === g.code) ?? g, true)}>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{g.code}</td>
                        <td className="px-3 py-2 text-foreground">{g.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">${fmt(total)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-14 bg-muted rounded-full h-1"><div className="h-1 bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <span className="text-muted-foreground w-8">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-success-soft-foreground font-medium">{result.salePriceUsd > 0 ? `${(total/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-2 text-center"><ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary-soft-foreground transition-colors" /></td>
                      </tr>
                    );
                  })}
                  <tr className="bg-primary-soft border-y-2 border-primary/30">
                    <td colSpan={2} className="px-3 py-2 font-semibold text-primary-soft-foreground">Kesif-A Ara Toplam</td>
                    <td className="px-3 py-2 text-right font-semibold text-primary-soft-foreground">${fmt(result.kaTotal)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{dcWp > 0 ? `$${(result.kaTotal/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td className="px-3 py-2 text-right font-semibold text-primary-soft-foreground">{result.directCost > 0 ? (result.kaTotal/result.directCost*100).toFixed(1) : "0"}%</td>
                    <td className="px-3 py-2 text-right font-semibold text-success-soft-foreground">{result.salePriceUsd > 0 ? `${(result.kaTotal/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                    <td />
                  </tr>
                  {localKesifB.map((g) => {
                    const total = getGrpTot(g, s);
                    const pct = result.directCost > 0 ? (total / result.directCost) * 100 : 0;
                    const perWp = dcWp > 0 ? total / dcWp : 0;
                    return (
                      <tr key={g.code} className="hover:bg-primary-soft/40 cursor-pointer transition-colors group"
                        onClick={() => openGroupEditor(g, false)}>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{g.code}</td>
                        <td className="px-3 py-2 text-foreground">{g.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">${fmt(total)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{perWp > 0 ? `$${perWp.toFixed(4)}` : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-14 bg-muted rounded-full h-1"><div className="h-1 bg-info rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <span className="text-muted-foreground w-8">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-success-soft-foreground font-medium">{result.salePriceUsd > 0 ? `${(total/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-2 text-center"><ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary-soft-foreground transition-colors" /></td>
                      </tr>
                    );
                  })}
                  <tr className="bg-info-soft border-y-2 border-info/30">
                    <td colSpan={2} className="px-3 py-2 font-semibold text-info-soft-foreground">Kesif-B Ara Toplam</td>
                    <td className="px-3 py-2 text-right font-semibold text-info-soft-foreground">${fmt(result.kbTotal)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{dcWp > 0 ? `$${(result.kbTotal/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td className="px-3 py-2 text-right font-semibold text-info-soft-foreground">{result.directCost > 0 ? (result.kbTotal/result.directCost*100).toFixed(1) : "0"}%</td>
                    <td className="px-3 py-2 text-right font-semibold text-success-soft-foreground">{result.salePriceUsd > 0 ? `${(result.kbTotal/result.salePriceUsd*100).toFixed(1)}%` : "—"}</td>
                    <td />
                  </tr>
                </tbody>
                <tfoot className="border-t-2">
                  <tr className="bg-muted text-muted-foreground">
                    <td colSpan={2} className="px-3 py-2">Contingency (%{s.contingency})</td>
                    <td className="px-3 py-2 text-right font-semibold">${fmt(result.contingencyAmt)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{dcWp > 0 ? `$${(result.contingencyAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td />
                    <td className="px-3 py-2 text-right text-success-soft-foreground font-semibold">{pctOf(result.contingencyAmt).toFixed(1)}%</td>
                    <td />
                  </tr>
                  <tr className="bg-muted border-y-2 font-semibold text-foreground">
                    <td colSpan={2} className="px-3 py-2">Maliyet</td>
                    <td className="px-3 py-2 text-right">${fmt(result.totalCost)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs font-semibold">{dcWp > 0 ? `$${(result.totalCost/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td />
                    <td className="px-3 py-2 text-right text-success-soft-foreground">{pctOf(result.totalCost).toFixed(1)}%</td>
                    <td />
                  </tr>
                  <tr className="bg-muted text-info-soft-foreground">
                    <td colSpan={2} className="px-3 py-2">Overhead Cost (%{s.genelGider})</td>
                    <td className="px-3 py-2 text-right font-semibold">${fmt(result.genelGiderAmt)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{dcWp > 0 ? `$${(result.genelGiderAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td />
                    <td className="px-3 py-2 text-right text-success-soft-foreground font-semibold">{pctOf(result.genelGiderAmt).toFixed(1)}%</td>
                    <td />
                  </tr>
                  <tr className="bg-muted text-success-soft-foreground font-semibold">
                    <td colSpan={2} className="px-3 py-2">Net Kar (%{s.netKar})</td>
                    <td className="px-3 py-2 text-right">${fmt(result.netKarAmt)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{dcWp > 0 ? `$${(result.netKarAmt/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td />
                    <td className="px-3 py-2 text-right text-success-soft-foreground">{pctOf(result.netKarAmt).toFixed(1)}%</td>
                    <td />
                  </tr>
                  <tr className="bg-warning-soft text-warning-soft-foreground">
                    <td colSpan={2} className="px-3 py-2">Finans Maliyeti (Toplam Faiz)</td>
                    <td className="px-3 py-2 text-right font-semibold">${fmt(finansMaliyeti)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{dcWp > 0 ? `$${(finansMaliyeti/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td />
                    <td className="px-3 py-2 text-right text-warning-soft-foreground font-semibold">{pctOf(finansMaliyeti).toFixed(1)}%</td>
                    <td />
                  </tr>
                  <tr className="bg-primary-soft border-t-2 border-primary/30">
                    <td colSpan={2} className="px-3 py-3 font-semibold text-primary-soft-foreground">EPC SATIŞ FİYATI</td>
                    <td className="px-3 py-3 text-right font-bold text-primary-soft-foreground text-sm">${fmt(result.salePriceUsd)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground font-medium text-xs">{dcWp > 0 ? `$${(result.salePriceUsd/dcWp).toFixed(4)}/Wp` : ""}</td>
                    <td />
                    <td className="px-3 py-3 text-right font-semibold text-success-soft-foreground">100%</td>
                    <td />
                  </tr>
                  <tr className="bg-primary-soft">
                    <td colSpan={2} className="px-3 py-1.5 text-xs text-primary-soft-foreground">TL Karşılığı</td>
                    <td className="px-3 py-1.5 text-right text-xs text-primary-soft-foreground">₺{fmt(result.salePriceTry)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ╔═══════════════════════════════════════════════════════════════════╗ */}
      {/* ║ DİĞER DETAYLAR — collapsible accordion                            ║ */}
      {/* ╚═══════════════════════════════════════════════════════════════════╝ */}
      <details className="group rounded-xl border bg-card shadow-sm" open>
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40">
          <div className="flex items-center gap-3">
            <div className={cn("flex size-8 items-center justify-center rounded-lg", SECTION_TONE.info.iconBg)}>
              <BarChart2 className={cn("size-4", SECTION_TONE.info.iconText)} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Diğer Detaylar</p>
              <p className="text-xs text-muted-foreground">
                Marjlar · Maliyet Dağılımı · Halka · Cash Flow · Hassasiyet · Karlılık · Notlar
              </p>
            </div>
          </div>
          <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-5 border-t p-5">

          {/* Maliyet Dağılımı + Halka — yan yana */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Bar list */}
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-8 items-center justify-center rounded-xl", SECTION_TONE.primary.iconBg)}>
                    <DollarSign className={cn("size-4", SECTION_TONE.primary.iconText)} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Maliyet Dağılımı</h3>
                  <span className="text-xs text-muted-foreground">{pieData.length} grup · ${fmt(totalPieValue)}</span>
                </div>
                {hiddenItemKeys.size > 0 && (
                  <button onClick={() => setHiddenItemKeys(new Set())} className="text-xs font-semibold text-primary-soft-foreground hover:underline">
                    Tümünü göster ({hiddenItemKeys.size} gizli)
                  </button>
                )}
              </div>
              <CardContent className="p-4">
                {totalPieValue > 0 && (
                  <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full">
                      {[...pieData].sort((a, b) => b.value - a.value).map((d) => {
                        const w = (d.value / totalPieValue) * 100;
                        const isA = d.key.startsWith("A");
                        return (
                          <div key={d.key} className={cn("h-full transition-all", isA ? "bg-primary" : "bg-info")}
                            style={{ width: `${w}%`, opacity: 0.4 + 0.6 * (d.value / pieData[0].value) }}
                            title={`${d.name}: $${fmt(d.value)} (${w.toFixed(1)}%)`} />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-px">
                  {[...allPieItems].sort((a, b) => b.value - a.value).map((d) => {
                    const hidden = hiddenItemKeys.has(d.key);
                    const pct = totalPieValue > 0 && !hidden ? (d.value / totalPieValue) * 100 : 0;
                    const isA = d.key.startsWith("A");
                    const isDrilled = drilledGroupCode === d.key;
                    const isFaded = drilledGroupCode !== null && !isDrilled;
                    return (
                      <div
                        key={d.key}
                        className={cn(
                          "group flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-[11px] transition-colors",
                          isDrilled && "bg-primary-soft/40 ring-1 ring-primary/30",
                          !isDrilled && "hover:bg-muted/60",
                          hidden && "opacity-40",
                          isFaded && !hidden && "opacity-50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setDrilledGroupCode(isDrilled ? null : d.key)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          title={isDrilled ? "Halka odağını kapat" : "Halka grafiğinde aç"}
                        >
                          <span
                            className={cn(
                              "shrink-0 rounded-md border px-1 py-0 font-mono text-[10px] font-semibold leading-tight",
                              isA
                                ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                                : "border-info/30 bg-info-soft text-info-soft-foreground",
                            )}
                          >
                            {d.key}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground group-hover:text-foreground">
                            {d.name.replace(`${d.key} `, "")}
                          </span>
                          <div className="hidden h-1 w-28 shrink-0 overflow-hidden rounded-full bg-muted sm:block lg:w-40">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isA ? "bg-primary" : "bg-info",
                              )}
                              style={{ width: hidden ? "0%" : `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-foreground">
                            {hidden ? "—" : `${pct.toFixed(1)}%`}
                          </span>
                          <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                            {hidden ? "—" : `$${fmt(d.value)}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePieItem(d.key);
                          }}
                          className={cn(
                            "ml-1 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                            hidden && "text-muted-foreground/60",
                          )}
                          title={hidden ? "Göster" : "Gizle"}
                          aria-label={hidden ? "Göster" : "Gizle"}
                        >
                          {hidden ? (
                            // closed eye
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                              <path d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 5.08A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 8a13.16 13.16 0 01-2.69 4.06M6.61 6.61A13.526 13.526 0 001 13c1.73 4.89 6 8 11 8a10.94 10.94 0 005.94-1.74" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-3 border-t pt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" /> Keşif-A</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-info" /> Keşif-B</span>
                  <span className="ml-auto">Satır → halkayı odakla · 👁 → gizle</span>
                </div>
              </CardContent>
            </Card>

            {/* Hierarchical Donut */}
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-8 items-center justify-center rounded-xl", SECTION_TONE.info.iconBg)}>
                    <BarChart2 className={cn("size-4", SECTION_TONE.info.iconText)} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Maliyet Halkası</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {drilledGroupCode ? "Kalem detayı" : "Bir gruba tıkla"}
                  </span>
                </div>
                {drilledGroupCode && (
                  <button type="button" onClick={() => setDrilledGroupCode(null)} className="text-xs font-semibold text-primary-soft-foreground hover:underline">
                    ← Geri
                  </button>
                )}
              </div>
              <CardContent className="p-3">
                <div className="relative">
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px 0 rgb(15 23 42 / 0.04)", fontSize: "12px" }}
                        formatter={(value: number, name: string) => {
                          const total = drilledGroupCode ? donutInnerTotal : donutOuterTotal;
                          const pct = total > 0 ? (value / total * 100).toFixed(1) : "0.0";
                          return [`$${fmt(value)} · ${pct}%`, name];
                        }}
                      />
                      <Pie data={donutOuter} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={130} innerRadius={92} paddingAngle={1} stroke="#fff" strokeWidth={2}
                        onClick={(d: { key?: string }) => { if (d?.key) setDrilledGroupCode(d.key); }}
                        style={{ cursor: "pointer" }}>
                        {donutOuter.map((d) => (
                          <Cell key={d.key} fill={d.isA ? "#059669" : "#2563eb"}
                            opacity={drilledGroupCode && drilledGroupCode !== d.key ? 0.35 : 1} />
                        ))}
                      </Pie>
                      {drilledGroupCode && donutInner.length > 0 && (
                        <Pie data={donutInner} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={88} innerRadius={50} paddingAngle={1} stroke="#fff" strokeWidth={1.5}>
                          {donutInner.map((d) => (
                            <Cell key={d.key} fill={d.isA ? "#a7f3d0" : "#bfdbfe"} />
                          ))}
                        </Pie>
                      )}
                    </PieChart>
                  </ResponsiveContainer>
                  <button type="button" onClick={() => setDrilledGroupCode(null)}
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {drilledGroupCode && drilledGroup ? (
                      <>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{drilledGroup.code}</p>
                        <p className="text-[11px] font-semibold text-foreground max-w-[160px] text-center leading-tight mt-0.5 px-2">{drilledGroup.name}</p>
                        <p className="text-lg font-bold tabular-nums text-foreground mt-1">${fmt(donutInnerTotal)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 pointer-events-auto cursor-pointer hover:underline">← merkeze tıkla</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Toplam</p>
                        <p className="text-2xl font-bold tabular-nums text-foreground mt-0.5">${fmt(donutOuterTotal)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[140px] text-center">Bir gruba tıklayın</p>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-center gap-4 border-t pt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: "#059669" }} /> Keşif-A</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: "#2563eb" }} /> Keşif-B</span>
                  {drilledGroupCode && (
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: drilledGroup?.code.startsWith("A") ? "#a7f3d0" : "#bfdbfe" }} /> Kalem</span>
                  )}
                </div>

                {/* Top 5 Kalemler — donut'un altindaki bosluga sigan analiz */}
                {top5Items.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        En Pahalı 5 Kalem
                      </p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        Toplam <span className="font-semibold text-foreground">${fmt(top5Total)}</span>
                        {result.directCost > 0 && (
                          <> · <span>%{(top5Total / result.directCost * 100).toFixed(1)}</span></>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {top5Items.map((it, i) => {
                        const itemPct = top5Items[0].value > 0 ? (it.value / top5Items[0].value) * 100 : 0;
                        return (
                          <div key={`${it.groupCode}.${it.itemCode}`} className="flex items-center gap-2 text-[11px]">
                            <span className="w-4 shrink-0 text-center font-semibold tabular-nums text-muted-foreground">
                              {i + 1}
                            </span>
                            <span className={cn(
                              "shrink-0 rounded-md border px-1 py-0 font-mono text-[9px] font-semibold leading-tight",
                              it.isA
                                ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                                : "border-info/30 bg-info-soft text-info-soft-foreground",
                            )}>
                              {it.itemCode}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={it.name}>
                              {it.name}
                            </span>
                            <div className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
                              <div className={cn("h-full rounded-full", it.isA ? "bg-primary" : "bg-info")}
                                style={{ width: `${itemPct}%` }} />
                            </div>
                            <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-foreground">
                              ${fmt(it.value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow — yan yana 2 grafik (cashflow-view ile birebir ayni) */}
          {cfData.length > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Bar chart — Aylık Giriş / Çıkış */}
              <Card className="shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b">
                  <div className={cn("size-7 rounded-lg flex items-center justify-center", SECTION_TONE.success.iconBg)}>
                    <DollarSign className={cn("size-3.5", SECTION_TONE.success.iconText)} />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">Aylık Nakit Giriş / Çıkış</h3>
                  <span className="text-[10px] text-muted-foreground">000 USD</span>
                </div>
                <CardContent className="px-4 pb-4 pt-3">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cfData} barGap={2} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                      <Tooltip formatter={(v) => `$${Number(v).toFixed(1)}k`} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px 0 rgb(15 23 42 / 0.04)", fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Bar dataKey="Giriş" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="Çıkış" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Area chart — Kümülatif */}
              <Card className="shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b">
                  <div className={cn("size-7 rounded-lg flex items-center justify-center", SECTION_TONE.primary.iconBg)}>
                    <TrendingUp className={cn("size-3.5", SECTION_TONE.primary.iconText)} />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">Kümülatif Nakit Pozisyonu</h3>
                  <span className="text-[10px] text-muted-foreground">000 USD</span>
                </div>
                <CardContent className="px-4 pb-4 pt-3">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={cfData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="cumGradPos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="4 2" label={{ value: "0", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
                      <Tooltip formatter={(v) => `$${Number(v).toFixed(1)}k`} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px 0 rgb(15 23 42 / 0.04)", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="Kümülatif" stroke="#059669" strokeWidth={2.5} fill="url(#cumGradPos)" dot={false}
                        activeDot={{ r: 5, fill: "#059669", stroke: "white", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Hassasiyet + Karlılık */}
          <div className="grid lg:grid-cols-2 gap-3">
            {/* Döviz Duyarlılığı */}
            <Card className="shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <div className={cn("size-8 rounded-xl flex items-center justify-center", SECTION_TONE.info.iconBg)}>
                  <TrendingUp className={cn("size-4", SECTION_TONE.info.iconText)} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Döviz Duyarlılığı</h3>
                  <p className="text-xs text-muted-foreground">USD/TRY senaryolarına göre TL satış</p>
                </div>
              </div>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted border-b">
                      <th className="px-4 py-2 text-left text-muted-foreground font-semibold">Senaryo</th>
                      <th className="px-4 py-2 text-right text-muted-foreground font-semibold">USD/TRY</th>
                      <th className="px-4 py-2 text-right text-muted-foreground font-semibold">TL Satış</th>
                      <th className="px-4 py-2 text-right text-muted-foreground font-semibold">Fark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sensitivityRates.map((r) => (
                      <tr key={r.label} className={cn(r.isBase ? "bg-primary-soft font-semibold" : "hover:bg-muted/60")}>
                        <td className={cn("px-4 py-2", r.isBase ? "text-primary-soft-foreground" : "text-muted-foreground")}>{r.label}</td>
                        <td className={cn("px-4 py-2 text-right", r.isBase ? "text-primary-soft-foreground" : "text-muted-foreground")}>{fmt(r.rate, 2)}</td>
                        <td className={cn("px-4 py-2 text-right font-semibold", r.isBase ? "text-primary-soft-foreground" : "text-foreground")}>₺{fmt(r.tryAmt)}</td>
                        <td className={cn("px-4 py-2 text-right text-xs",
                          r.isBase ? "text-muted-foreground" : r.tryAmt > result.salePriceTry ? "text-success-soft-foreground" : "text-destructive-soft-foreground")}>
                          {r.isBase ? "—" : `${r.tryAmt > result.salePriceTry ? "+" : ""}₺${fmt(r.tryAmt - result.salePriceTry)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Kârlılık */}
            <Card className="shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <div className={cn("size-8 rounded-xl flex items-center justify-center", SECTION_TONE.primary.iconBg)}>
                  <BarChart2 className={cn("size-4", SECTION_TONE.primary.iconText)} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Kârlılık Analizi</h3>
                  <p className="text-xs text-muted-foreground">Satış fiyatı üzerinden marj dağılımı</p>
                </div>
              </div>
              <CardContent className="p-4 space-y-4">
                {result.salePriceUsd > 0 && (() => {
                  const kaPct = result.kaTotal / result.salePriceUsd * 100;
                  const kbPct = result.kbTotal / result.salePriceUsd * 100;
                  const contPct = result.contingencyAmt / result.salePriceUsd * 100;
                  const ohcPct = result.genelGiderAmt / result.salePriceUsd * 100;
                  const karPct = result.netKarAmt / result.salePriceUsd * 100;
                  return (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Satış Fiyatı Bileşimi</p>
                      <div className="flex h-8 rounded-xl overflow-hidden w-full gap-px">
                        <div className="flex items-center justify-center text-[9px] font-semibold text-primary-foreground overflow-hidden bg-primary" style={{ width: `${kaPct}%` }} title={`Kesif-A ${kaPct.toFixed(1)}%`}>A</div>
                        <div className="flex items-center justify-center text-[9px] font-semibold text-primary-foreground overflow-hidden bg-info" style={{ width: `${kbPct}%` }} title={`Kesif-B ${kbPct.toFixed(1)}%`}>B</div>
                        <div className="flex items-center justify-center text-[9px] font-semibold text-primary-foreground overflow-hidden bg-muted-foreground" style={{ width: `${contPct}%` }} title={`Contingency ${contPct.toFixed(1)}%`}>C</div>
                        <div className="flex items-center justify-center text-[9px] font-semibold text-primary-foreground overflow-hidden bg-warning" style={{ width: `${ohcPct}%` }} title={`OHC ${ohcPct.toFixed(1)}%`}>O</div>
                        <div className="flex items-center justify-center text-[9px] font-semibold text-primary-foreground overflow-hidden bg-success" style={{ width: `${karPct}%` }} title={`Net Kar ${karPct.toFixed(1)}%`}>K</div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {[
                          { label: "Kesif-A", pct: kaPct, color: "#059669" },
                          { label: "Kesif-B", pct: kbPct, color: "#2563eb" },
                          { label: "Contingency", pct: contPct, color: "#64748b" },
                          { label: "OHC", pct: ohcPct, color: "#d97706" },
                          { label: "Net Kar", pct: karPct, color: "#059669" },
                        ].map((it) => (
                          <span key={it.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="size-2 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: it.color }} />
                            {it.label} <span className="font-semibold text-foreground">{it.pct.toFixed(1)}%</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Brüt Kar Marjı", value: result.salePriceUsd > 0 ? `${(result.brutKar / result.salePriceUsd * 100).toFixed(1)}%` : "—", sub: `$${fmt(result.brutKar)}`, color: "text-success-soft-foreground", bg: "bg-success-soft border-success/30" },
                    { label: "Net Kar Marjı", value: result.salePriceUsd > 0 ? `${(result.netKarAmt / result.salePriceUsd * 100).toFixed(1)}%` : "—", sub: `$${fmt(result.netKarAmt)}`, color: "text-info-soft-foreground", bg: "bg-info-soft border-info/30" },
                    { label: "Kesif-A / Toplam", value: result.directCost > 0 ? `${(result.kaTotal / result.directCost * 100).toFixed(1)}%` : "—", sub: `$${fmt(result.kaTotal)}`, color: "text-primary-soft-foreground", bg: "bg-primary-soft border-primary/30" },
                    { label: "Markup Oranı", value: result.totalCost > 0 ? `${((result.salePriceUsd / result.totalCost - 1) * 100).toFixed(1)}%` : "—", sub: "Satış / Maliyet − 1", color: "text-primary-soft-foreground", bg: "bg-primary-soft border-primary/30" },
                  ].map((m) => (
                    <div key={m.label} className={cn("rounded-xl p-3 border", m.bg)}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{m.label}</p>
                      <p className={cn("text-xl font-bold", m.color)}>{m.value}</p>
                      <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notlar / Riskler / Müşteri Öngörüleri */}
          {((s.notes?.length ?? 0) > 0 || (s.risks?.length ?? 0) > 0 || (s.customerInsights?.length ?? 0) > 0) && (
            <div className="grid md:grid-cols-3 gap-3">
              {s.notes && s.notes.length > 0 && (
                <Card className="shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center gap-2.5">
                    <div className={cn("size-7 rounded-lg flex items-center justify-center", SECTION_TONE.primary.iconBg)}>
                      <FileDown className={cn("size-3.5", SECTION_TONE.primary.iconText)} />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">Teklif Notları</h3>
                  </div>
                  <CardContent className="p-4">
                    <ul className="space-y-1.5">
                      {s.notes.map((n, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2 leading-relaxed">
                          <span className="size-4 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-primary-soft-foreground text-xs font-bold">•</span></span>
                          {n}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {s.risks && s.risks.length > 0 && (
                <Card className="shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-destructive-soft flex items-center gap-2.5">
                    <div className="size-7 rounded-lg flex items-center justify-center bg-destructive"><span className="text-destructive-foreground text-xs font-bold">!</span></div>
                    <h3 className="font-semibold text-destructive-soft-foreground text-sm">Riskler</h3>
                  </div>
                  <CardContent className="p-4">
                    <ul className="space-y-1.5">
                      {s.risks.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2 leading-relaxed">
                          <span className="size-4 rounded-full bg-destructive-soft flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-destructive-soft-foreground text-xs">⚠</span></span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {s.customerInsights && s.customerInsights.length > 0 && (
                <Card className="shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-info-soft flex items-center gap-2.5">
                    <div className="size-7 rounded-lg flex items-center justify-center bg-info"><span className="text-info-foreground text-xs font-bold">→</span></div>
                    <h3 className="font-semibold text-info-soft-foreground text-sm">Müşteri Öngörüleri</h3>
                  </div>
                  <CardContent className="p-4">
                    <ul className="space-y-1.5">
                      {s.customerInsights.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2 leading-relaxed">
                          <span className="size-4 rounded-full bg-info-soft flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-info-soft-foreground text-xs font-bold">→</span></span>
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
      </details>

    </div>
  );
}

/* ─── Helpers (in-file) ─────────────────────────────────────────────────── */

function SysRow({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2",
        fullWidth && "col-span-2",
      )}
    >
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="text-xs font-semibold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}

const RATIO_TONE: Record<
  "primary" | "info" | "success" | "warning" | "muted",
  { card: string; label: string; value: string; sub: string; bar: string }
> = {
  primary: {
    card: "bg-primary-soft border-primary/30",
    label: "text-primary-soft-foreground/80",
    value: "text-primary-soft-foreground",
    sub: "text-primary-soft-foreground/70",
    bar: "bg-primary",
  },
  info: {
    card: "bg-info-soft border-info/30",
    label: "text-info-soft-foreground/80",
    value: "text-info-soft-foreground",
    sub: "text-info-soft-foreground/70",
    bar: "bg-info",
  },
  success: {
    card: "bg-success-soft border-success/30",
    label: "text-success-soft-foreground/80",
    value: "text-success-soft-foreground",
    sub: "text-success-soft-foreground/70",
    bar: "bg-success",
  },
  warning: {
    card: "bg-warning-soft border-warning/30",
    label: "text-warning-soft-foreground/80",
    value: "text-warning-soft-foreground",
    sub: "text-warning-soft-foreground/70",
    bar: "bg-warning",
  },
  muted: {
    card: "bg-muted border-border",
    label: "text-muted-foreground",
    value: "text-foreground",
    sub: "text-muted-foreground",
    bar: "bg-muted-foreground/60",
  },
};

function RatioKpi({
  tone,
  label,
  value,
  pct,
  ratePct,
  rateLabel,
  sub,
  onRateChange,
  maxRate = 30,
}: {
  tone: keyof typeof RATIO_TONE;
  label: string;
  value: string;
  pct: number;
  ratePct?: number;
  rateLabel?: string;
  sub?: string;
  onRateChange?: (newRate: number) => Promise<void> | void;
  maxRate?: number;
}) {
  const t = RATIO_TONE[tone];
  const editable = ratePct !== undefined && !!onRateChange;

  // Manuel giris (input) state'i
  const [manualEditing, setManualEditing] = useState(false);
  const [tempRate, setTempRate] = useState("");

  function startManualEdit() {
    if (!editable) return;
    setTempRate(String(ratePct));
    setManualEditing(true);
  }

  async function commitManual() {
    setManualEditing(false);
    const v = parseFloat(tempRate);
    if (!isNaN(v) && onRateChange && Math.abs(v - (ratePct ?? 0)) > 0.001) {
      await onRateChange(v);
    }
  }

  return (
    <div className={cn("rounded-xl border p-3 shadow-sm", t.card)}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-widest", t.label)}>
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums tracking-tight", t.value)}>
        {value}
      </p>

      {editable ? (
        <>
          {/* Slider — surukleyerek 0.1 adimda oran ver */}
          <div className="mt-2.5">
            <input
              type="range"
              min={0}
              max={maxRate}
              step={0.1}
              value={ratePct ?? 0}
              onChange={(e) => onRateChange?.(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-ew-resize appearance-none rounded-full bg-foreground/10 accent-current"
              style={{ accentColor: "currentColor" }}
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
              <span className={cn(t.sub)}>
                {rateLabel ?? "Oran"}:{" "}
                <span className={cn("font-semibold tabular-nums", t.value)}>
                  %{(ratePct ?? 0).toFixed(1)}
                </span>
              </span>
              <span className={cn("tabular-nums", t.sub)}>
                %{pct.toFixed(1)} satış
              </span>
            </div>
          </div>

          {/* Manuel giris input — dursun ki elle de yazabilsin */}
          {manualEditing ? (
            <input
              type="number"
              step="0.1"
              value={tempRate}
              onChange={(e) => setTempRate(e.target.value)}
              onBlur={commitManual}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setManualEditing(false);
              }}
              autoFocus
              className={cn(
                "mt-1.5 h-6 w-full rounded-md border bg-background px-2 text-[11px] font-semibold tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-ring",
                t.value,
              )}
            />
          ) : (
            <button
              type="button"
              onClick={startManualEdit}
              className={cn(
                "mt-1.5 flex w-full items-center justify-between gap-1 rounded-md border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] transition-colors hover:bg-foreground/10",
                t.sub,
              )}
              title="Oranı manuel gir"
            >
              <span>Manuel: %{(ratePct ?? 0).toFixed(1)}</span>
              <Edit2 className="size-2.5 opacity-60" />
            </button>
          )}
        </>
      ) : (
        <>
          {/* Salt-okunur bar (Maliyet kartı icin) */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn("h-full rounded-full transition-all", t.bar)}
                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
              />
            </div>
            <span className={cn("w-12 text-right text-[10px] font-semibold tabular-nums", t.value)}>
              %{pct.toFixed(1)}
            </span>
          </div>
          {sub && (
            <p className={cn("mt-1.5 text-[10px]", t.sub)}>{sub}</p>
          )}
        </>
      )}
    </div>
  );
}
