"use client";

import { useState, useEffect, useRef } from "react";
import { saveTeknik } from "@/app/actions/ges";
import { useDirtyTracker } from "@/lib/unsaved-changes";
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
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";

interface Props {
  projectId: string;
  projectName: string;
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

async function fetchExchangeRates(): Promise<{ usd?: number; eur?: number }> {
  // Tek istekle USD ve EUR'u ceken, CORS-acik birden fazla saglayicidan
  // siralı olarak dene. Birinde hata olursa digerine gec.
  const providers: Array<() => Promise<{ usd?: number; eur?: number }>> = [
    // exchangerate.host — ucretsiz, CORS acik, tek istekte multi-base/symbols
    async () => {
      const res = await fetch(
        "https://api.exchangerate.host/latest?base=TRY&symbols=USD,EUR",
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("exchangerate.host HTTP " + res.status);
      const data = await res.json();
      const usd = data?.rates?.USD;
      const eur = data?.rates?.EUR;
      // base=TRY oldugundan rates 1 TRY = 0.0X USD/EUR cinsinden gelir;
      // bizim formata cevir (1 USD = X TRY).
      return {
        usd: usd ? 1 / usd : undefined,
        eur: eur ? 1 / eur : undefined,
      };
    },
    // open.er-api.com — ucretsiz, CORS acik, base=TRY ile rates
    async () => {
      const res = await fetch("https://open.er-api.com/v6/latest/TRY", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("open.er-api HTTP " + res.status);
      const data = await res.json();
      const usd = data?.rates?.USD;
      const eur = data?.rates?.EUR;
      return {
        usd: usd ? 1 / usd : undefined,
        eur: eur ? 1 / eur : undefined,
      };
    },
    // Frankfurter — ECB tabanli; calisirsa bonus, calismazsa diger ikisi yedek
    async () => {
      const [usdRes, eurRes] = await Promise.all([
        fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY", {
          cache: "no-store",
        }),
        fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY", {
          cache: "no-store",
        }),
      ]);
      const usdData = await usdRes.json();
      const eurData = await eurRes.json();
      return {
        usd: usdData?.rates?.TRY,
        eur: eurData?.rates?.TRY,
      };
    },
  ];

  for (const provider of providers) {
    try {
      const r = await provider();
      if (typeof r.usd === "number" && r.usd > 0 && typeof r.eur === "number" && r.eur > 0) {
        return r;
      }
    } catch (e) {
      console.warn("[fx] provider failed:", e);
    }
  }
  return {};
}

export function TeknikForm({ projectId, projectName, settings }: Props) {
  const [s, setS] = useState<GesSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [fxLoading, setFxLoading] = useState(false);

  // Unsaved-changes: form state ile son kayit snapshot'unu karsilastir.
  const baselineRef = useRef<string>(JSON.stringify(settings));
  const isDirty = JSON.stringify(s) !== baselineRef.current;
  useDirtyTracker(isDirty);

  async function refreshFx(silent = false) {
    setFxLoading(true);
    try {
      const { usd, eur } = await fetchExchangeRates();
      if (typeof usd === "number" || typeof eur === "number") {
        setS((p) => ({
          ...p,
          ...(typeof usd === "number" ? { usd } : {}),
          ...(typeof eur === "number" ? { eur } : {}),
        }));
        if (!silent) toast.success("Kurlar güncellendi");
      } else if (!silent) {
        toast.error("Kur servisi yanıt vermedi");
      }
    } finally {
      setFxLoading(false);
    }
  }

  // Yeni projede USD/EUR 0 ise ilk yuklemede otomatik cek
  useEffect(() => {
    if (s.usd === 0 || s.eur === 0) {
      refreshFx(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panelAdetCalc =
    s.dcGuc > 0 && s.panelGuc > 0
      ? Math.round((s.dcGuc * 1_000_000) / s.panelGuc)
      : 0;

  function f(key: keyof GesSettings, isNum = true) {
    const raw = s[key];
    // Sayisal 0 input'ta "0" yazmaz; bos gosterir, kullanici yazinca degisir.
    // String alanlar oldugu gibi gosterilir.
    const display: string | number =
      isNum && typeof raw === "number" && raw === 0 ? "" : (raw as string | number);
    return {
      value: display,
      placeholder: isNum ? "0" : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = isNum
          ? e.target.value === ""
            ? 0
            : parseFloat(e.target.value) || 0
          : e.target.value;
        setS((p) => {
          const next: typeof p = { ...p, [key]: v };
          // Auto-perimeter: Proje Alani'ni doldurunca tel-cit otomatik
          // hesaplanir (kare varsayimi: cevre = 4 * sqrt(alan)). Kullanici
          // tel-cit'i daha sonra kendisi degistirebilir; alani tekrar
          // degistirirse de yeniden onerilir.
          if (key === "projeAlani" && typeof v === "number" && v > 0) {
            next.cevreTelcit = Math.round(4 * Math.sqrt(v));
          }
          return next;
        });
      },
    };
  }

  // Required fields — advance is gated until these are filled.
  const missingFields: string[] = [];
  if (!(s.dcGuc > 0)) missingFields.push("DC Güç");
  if (!(s.panelGuc > 0)) missingFields.push("Panel Gücü");
  if (!(s.invGuc > 0)) missingFields.push("İnverter Gücü");
  if (!(s.invAdet > 0)) missingFields.push("İnverter Adedi");
  if (!(s.usd > 0)) missingFields.push("USD/TRY Kuru");
  if (!s.baslangic) missingFields.push("Başlangıç Tarihi");
  if (!(s.sure > 0)) missingFields.push("İnşaat Süresi");
  const isValid = missingFields.length === 0;

  async function handleSave(goNext = false) {
    if (goNext && !isValid) {
      toast.error(`Eksik alanlar: ${missingFields.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const data = { ...s, panelAdet: panelAdetCalc };
      await saveTeknik(projectId, data as never, goNext);
      // Save sonrasi baseline yeniden esitlenir → dirty=false.
      baselineRef.current = JSON.stringify(data);
      toast.success("Teknik parametreler kaydedildi — Keşif kalemleri güncellendi");
      if (goNext) window.location.href = `/projects/${projectId}/detail/kesif-a`;
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <DetailPageHeader
        kicker="Teknik Parametreler"
        title={projectName}
        backHref={prevHref(projectId, "/teknik")}
        actions={
          <>
            <Button
              data-edit-only
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              <Save className="size-3.5" />
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button
              data-edit-only
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving || !isValid}
              title={
                !isValid
                  ? `Önce zorunlu alanları doldurun: ${missingFields.join(", ")}`
                  : undefined
              }
            >
              Kaydet &amp; İlerle <ArrowRight className="size-3.5" />
            </Button>
          </>
        }
      />
      {!isValid && (
        <div className="rounded-md border border-warning/30 bg-warning-soft px-4 py-2 text-xs text-warning-soft-foreground">
          <strong>Eksik alanlar:</strong> {missingFields.join(", ")}. İlerlemek
          için bu alanları doldurun.
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
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
                <Label>
                  DC Güç (MW) <span className="text-destructive">*</span>
                </Label>
                <Input type="number" step="0.1" required {...f("dcGuc")} />
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
                <Label>
                  Panel Gücü (Wp) <span className="text-destructive">*</span>
                </Label>
                <Input type="number" required {...f("panelGuc")} />
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
                    data-edit-only
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
                <Label>
                  İnverter Gücü (kW) <span className="text-destructive">*</span>
                </Label>
                <Input type="number" required {...f("invGuc")} />
              </div>
              <div className="space-y-2">
                <Label>
                  İnverter Adedi <span className="text-destructive">*</span>
                </Label>
                <Input type="number" required {...f("invAdet")} />
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
              <div className="col-span-2 -mb-2 flex items-center justify-end">
                <button
                  data-edit-only
                  type="button"
                  onClick={() => refreshFx(false)}
                  disabled={fxLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70 disabled:opacity-60"
                  title="Frankfurter (ECB) servisinden güncel TCMB-yakını kuru çek"
                >
                  <RefreshCw
                    className={cn("size-3", fxLoading && "animate-spin")}
                  />
                  {fxLoading ? "Çekiliyor…" : "Güncel kuru çek"}
                </button>
              </div>
              <div className="space-y-2">
                <Label>
                  USD/TRY <span className="text-destructive">*</span>
                </Label>
                <Input type="number" step="0.01" required {...f("usd")} />
              </div>
              <div className="space-y-2">
                <Label>EUR/TRY</Label>
                <Input type="number" step="0.01" {...f("eur")} />
              </div>
              <div className="space-y-2">
                <Label>
                  Başlangıç Tarihi <span className="text-destructive">*</span>
                </Label>
                <Input type="date" required {...f("baslangic", false)} />
              </div>
              <div className="space-y-2">
                <Label>
                  İnşaat Süresi (gün) <span className="text-destructive">*</span>
                </Label>
                <Input type="number" required {...f("sure")} />
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
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    <Button
                      data-edit-only
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setS((p) => {
                          const a = [...(p[key] as { name: string; price: number }[])];
                          a.push({ name: "Yeni", price: 0 });
                          return { ...p, [key]: a } as typeof p;
                        })
                      }
                    >
                      <Plus className="size-3" /> Ekle
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {s[key].map((alt, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_100px_70px_36px] items-center gap-2"
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
                        <button
                          data-edit-only
                          type="button"
                          onClick={() =>
                            setS((p) => {
                              const a = [...(p[key] as { name: string; price: number }[])];
                              if (a.length <= 1) return p;
                              a.splice(i, 1);
                              const newSelIdx = Math.max(
                                0,
                                Math.min((p[sel] as number) ?? 0, a.length - 1),
                              );
                              return { ...p, [key]: a, [sel]: newSelIdx } as typeof p;
                            })
                          }
                          disabled={s[key].length <= 1}
                          title={s[key].length <= 1 ? "En az bir alternatif olmalı" : "Sil"}
                          className="flex size-9 items-center justify-center rounded-md border border-border text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
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
