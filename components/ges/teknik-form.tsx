"use client";

import { useState } from "react";
import { saveTeknik } from "@/app/actions/ges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GesSettings } from "@/lib/ges-defaults";
import {
  Save,
  ArrowRight,
  RefreshCw,
  Zap,
  DollarSign,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  settings: GesSettings;
}

type SectionTone = "primary" | "info" | "success" | "warning" | "destructive";

const SECTION_TONE: Record<SectionTone, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary-soft", iconText: "text-primary-soft-foreground" },
  info: { iconBg: "bg-info-soft", iconText: "text-info-soft-foreground" },
  success: { iconBg: "bg-success-soft", iconText: "text-success-soft-foreground" },
  warning: { iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground" },
  destructive: { iconBg: "bg-destructive-soft", iconText: "text-destructive-soft-foreground" },
};

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  tone: SectionTone;
}) {
  const t = SECTION_TONE[tone];
  return (
    <div className="flex items-center gap-3 border-b px-6 py-4">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          t.iconBg,
        )}
      >
        <Icon className={cn("size-4", t.iconText)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export function TeknikForm({ projectId, settings }: Props) {
  const [s, setS] = useState<GesSettings>(settings);
  const [saving, setSaving] = useState(false);

  const panelAdetCalc =
    s.dcGuc > 0 && s.panelGuc > 0
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
      toast.success("Teknik parametreler kaydedildi — Keşif kalemleri güncellendi");
      if (goNext) window.location.href = `/projects/${projectId}/detail/kesif-a`;
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Teknik Parametreler</p>
            <p className="text-xs text-muted-foreground">
              Kaydedince Keşif-A ve Keşif-B otomatik hesaplanır
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            <Save className="size-3.5" />
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
            Kaydet &amp; Keşif A <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Power & system */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={Zap}
              title="Güç & Sistem Parametreleri"
              subtitle="DC/AC güç, panel ve inverter bilgileri"
              tone="info"
            />
            <CardContent className="grid grid-cols-2 gap-5 p-6">
              <div className="space-y-2">
                <Label>DC Güç (MW) *</Label>
                <Input type="number" step="0.1" {...f("dcGuc")} />
                <p className="text-xs font-medium text-info-soft-foreground">
                  {(s.dcGuc * 1000).toFixed(0)} kWp
                </p>
              </div>
              <div className="space-y-2">
                <Label>AC Güç (MW)</Label>
                <Input type="number" step="0.1" {...f("acGuc")} />
                {s.dcGuc > 0 && s.acGuc > 0 && (
                  <p className="text-xs font-medium text-success-soft-foreground">
                    Oran: {(s.dcGuc / s.acGuc).toFixed(2)}
                  </p>
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
                    onChange={(e) =>
                      setS((p) => ({
                        ...p,
                        panelAdet: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-soft-foreground"
                    title="Otomatik hesapla"
                    onClick={() =>
                      setS((p) => ({ ...p, panelAdet: panelAdetCalc }))
                    }
                  >
                    <RefreshCw className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hesaplanan: {panelAdetCalc} adet
                </p>
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

          {/* Currency & timeline */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={DollarSign}
              title="Döviz & Proje Takvimi"
              subtitle="Kur bilgileri ve inşaat süresi"
              tone="success"
            />
            <CardContent className="grid grid-cols-2 gap-5 p-6">
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

        </div>

        {/* Right column — material alternatives */}
        <div>
          <Card className="overflow-hidden">
            <SectionHeader
              icon={Layers}
              title="Kritik Malzeme Alternatifleri"
              subtitle="Panel, konstrüksiyon ve inverter seçenekleri"
              tone="primary"
            />
            <CardContent className="space-y-6 p-5">
              {[
                {
                  label: "Panel Alternatifleri",
                  key: "panelAlts" as const,
                  sel: "selPanel" as const,
                  placeholder: "USD/Wp",
                },
                {
                  label: "Konstrüksiyon Alternatifleri",
                  key: "konstrAlts" as const,
                  sel: "selKonstr" as const,
                  placeholder: "USD/MW",
                },
                {
                  label: "İnverter Alternatifleri",
                  key: "invAlts" as const,
                  sel: "selInv" as const,
                  placeholder: "USD/adet",
                },
              ].map(({ label, key, sel, placeholder }) => (
                <div key={key}>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <div className="space-y-2">
                    {s[key].map((alt, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_90px_70px] items-center gap-2"
                      >
                        <Input
                          className="h-9 text-sm"
                          value={alt.name}
                          onChange={(e) =>
                            setS((p) => {
                              const a = [...p[key]] as typeof s[typeof key];
                              (a[i] as typeof a[0]) = {
                                ...a[i],
                                name: e.target.value,
                              };
                              return { ...p, [key]: a };
                            })
                          }
                        />
                        <Input
                          type="number"
                          step="0.001"
                          className="h-9 text-sm"
                          value={alt.price}
                          placeholder={placeholder}
                          onChange={(e) =>
                            setS((p) => {
                              const a = [...p[key]] as typeof s[typeof key];
                              (a[i] as typeof a[0]) = {
                                ...a[i],
                                price: parseFloat(e.target.value) || 0,
                              };
                              return { ...p, [key]: a };
                            })
                          }
                        />
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                            s[sel] === i
                              ? "border-primary bg-primary-soft font-semibold text-primary-soft-foreground"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <input
                            type="radio"
                            name={`sel_${key}`}
                            checked={s[sel] === i}
                            onChange={() => setS((p) => ({ ...p, [sel]: i }))}
                            className="accent-primary"
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
