"use client";

import { useState } from "react";
import { saveTeknik } from "@/app/actions/ges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GesSettings } from "@/lib/ges-defaults";
import { Save, ArrowRight, RefreshCw, Zap, DollarSign, Percent, Settings2, Layers } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  settings: GesSettings;
}

function SectionHeader({ icon: Icon, title, subtitle, color }: { icon: React.ComponentType<{className?: string}>; title: string; subtitle?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`} style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <div>
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function TeknikForm({ projectId, settings }: Props) {
  const [s, setS] = useState<GesSettings>(settings);
  const [saving, setSaving] = useState(false);

  const panelAdetCalc = s.dcGuc > 0 && s.panelGuc > 0
    ? Math.round((s.dcGuc * 1_000_000) / s.panelGuc)
    : 0;

  function f(key: keyof GesSettings, isNum = true) {
    return {
      value: s[key] as string | number,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = isNum ? parseFloat(e.target.value) || 0 : e.target.value;
        setS((p) => ({ ...p, [key]: v }));
      },
    };
  }

  async function handleSave(goNext = false) {
    setSaving(true);
    try {
      const data = { ...s, panelAdet: panelAdetCalc };
      await saveTeknik(projectId, data as never);
      toast.success("Teknik parametreler kaydedildi — Kesif kalemleri güncellendi");
      if (goNext) window.location.href = `/projects/${projectId}/detail/kesif-a`;
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* ── Butonlar — üstte ── */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/70 shadow-sm px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Teknik Parametreler</p>
            <p className="text-xs text-slate-400">Kaydedince Kesif-A ve Kesif-B otomatik hesaplanır</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            Kaydet &amp; Keşif A <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── İki sütun layout ── */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* Sol sütun */}
        <div className="space-y-5">
          {/* Güç & Sistem */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={Zap} title="Güç & Sistem Parametreleri" subtitle="DC/AC güç, panel ve inverter bilgileri" color="bg-gradient-to-br from-blue-500 to-indigo-600" />
            <CardContent className="p-6 grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>DC Güç (MW) *</Label>
                <Input type="number" step="0.1" {...f("dcGuc")} />
                <p className="text-xs text-blue-500 font-medium">{(s.dcGuc * 1000).toFixed(0)} kWp</p>
              </div>
              <div className="space-y-2">
                <Label>AC Güç (MW)</Label>
                <Input type="number" step="0.1" {...f("acGuc")} />
                {s.dcGuc > 0 && s.acGuc > 0 && (
                  <p className="text-xs text-emerald-500 font-medium">Oran: {(s.dcGuc / s.acGuc).toFixed(2)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Panel Gücü (Wp)</Label>
                <Input type="number" {...f("panelGuc")} />
              </div>
              <div className="space-y-2">
                <Label>Panel Adedi</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={s.panelAdet || panelAdetCalc}
                    onChange={(e) => setS((p) => ({ ...p, panelAdet: parseInt(e.target.value) || 0 }))}
                  />
                  <button
                    type="button"
                    className="h-11 w-11 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-amber-50 hover:border-amber-200 transition-colors flex-shrink-0"
                    title="Otomatik hesapla"
                    onClick={() => setS((p) => ({ ...p, panelAdet: panelAdetCalc }))}
                  >
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <p className="text-xs text-slate-400">Hesaplanan: {panelAdetCalc} adet</p>
              </div>
              <div className="space-y-2">
                <Label>İnverter Gücü (kW)</Label>
                <Input type="number" {...f("invGuc")} />
              </div>
              <div className="space-y-2">
                <Label>İnverter Adedi</Label>
                <Input type="number" {...f("invAdet")} />
              </div>
              <div className="space-y-2">
                <Label>Trafo Sayısı</Label>
                <Input type="number" {...f("trafoSayisi")} />
              </div>
              <div className="space-y-2">
                <Label>Çevre Telçit (m)</Label>
                <Input type="number" {...f("cevreTelcit")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Proje Alanı (m²)</Label>
                <Input type="number" {...f("projeAlani")} />
              </div>
            </CardContent>
          </Card>

          {/* Döviz & Takvim */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={DollarSign} title="Döviz & Proje Takvimi" subtitle="Kur bilgileri ve inşaat süresi" color="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <CardContent className="p-6 grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>USD/TRY</Label>
                <Input type="number" step="0.01" {...f("usd")} />
              </div>
              <div className="space-y-2">
                <Label>EUR/TRY</Label>
                <Input type="number" step="0.01" {...f("eur")} />
              </div>
              <div className="space-y-2">
                <Label>Başlangıç Tarihi</Label>
                <Input type="date" {...f("baslangic", false)} />
              </div>
              <div className="space-y-2">
                <Label>İnşaat Süresi (gün)</Label>
                <Input type="number" {...f("sure")} />
              </div>
            </CardContent>
          </Card>

          {/* Maliyet Marjları */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={Percent} title="Maliyet Marjları" subtitle="Contingency, genel gider ve kar oranları" color="bg-gradient-to-br from-amber-500 to-orange-500" />
            <CardContent className="p-6 grid grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label>Contingency (%)</Label>
                <Input type="number" step="0.5" {...f("contingency")} />
              </div>
              <div className="space-y-2">
                <Label>Genel Gider (%)</Label>
                <Input type="number" step="0.5" {...f("genelGider")} />
              </div>
              <div className="space-y-2">
                <Label>Net Kar (%)</Label>
                <Input type="number" step="0.5" {...f("netKar")} />
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Kredi Faizi (%/yıl)</Label>
                <Input type="number" step="0.1" {...f("krediFaiz")} className="max-w-[180px]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ sütun — Kritik Malzeme Alternatifleri */}
        <div>
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={Layers} title="Kritik Malzeme Alternatifleri" subtitle="Panel, konstrüksiyon ve inverter seçenekleri" color="bg-gradient-to-br from-purple-500 to-violet-600" />
            <CardContent className="p-5 space-y-6">
              {[
                { label: "Panel Alternatifleri", key: "panelAlts" as const, sel: "selPanel" as const, placeholder: "USD/Wp" },
                { label: "Konstrüksiyon Alternatifleri", key: "konstrAlts" as const, sel: "selKonstr" as const, placeholder: "USD/MW" },
                { label: "İnverter Alternatifleri", key: "invAlts" as const, sel: "selInv" as const, placeholder: "USD/adet" },
              ].map(({ label, key, sel, placeholder }) => (
                <div key={key}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</p>
                  <div className="space-y-2">
                    {s[key].map((alt, i) => (
                      <div key={i} className="grid grid-cols-[1fr_90px_70px] gap-2 items-center">
                        <Input
                          className="text-sm h-9"
                          value={alt.name}
                          onChange={(e) => setS((p) => {
                            const a = [...p[key]] as typeof s[typeof key];
                            (a[i] as typeof a[0]) = { ...a[i], name: e.target.value };
                            return { ...p, [key]: a };
                          })}
                        />
                        <Input
                          type="number"
                          step="0.001"
                          className="text-sm h-9"
                          value={alt.price}
                          placeholder={placeholder}
                          onChange={(e) => setS((p) => {
                            const a = [...p[key]] as typeof s[typeof key];
                            (a[i] as typeof a[0]) = { ...a[i], price: parseFloat(e.target.value) || 0 };
                            return { ...p, [key]: a };
                          })}
                        />
                        <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1.5 rounded-lg border transition-all ${s[sel] === i ? "border-amber-300 bg-amber-50 text-amber-700 font-semibold" : "border-slate-200 text-slate-500"}`}>
                          <input
                            type="radio"
                            name={`sel_${key}`}
                            checked={s[sel] === i}
                            onChange={() => setS((p) => ({ ...p, [sel]: i }))}
                            className="accent-amber-500"
                          />
                          {s[sel] === i ? "✓" : "Seç"}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
