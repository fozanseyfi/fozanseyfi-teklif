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

async function fetchExchangeRates(): Promise<{
  usd?: number;
  eur?: number;
  source?: string;
}> {
  // Sunucu tarafı /api/fx/latest endpoint'i kullanılır — TCMB + 3 yedek
  // provider + 30 dk cache + hard fallback. Tarayıcıdan direkt provider
  // çağırmak CORS/rate-limit nedeniyle güvenilmez olduğundan kaldırıldı.
  try {
    const res = await fetch("/api/fx/latest", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (typeof data.usd === "number" && typeof data.eur === "number") {
      return { usd: data.usd, eur: data.eur, source: data.source };
    }
  } catch (e) {
    console.warn("[fx] /api/fx/latest failed:", e);
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
      const { usd, eur, source } = await fetchExchangeRates();
      if (typeof usd === "number" || typeof eur === "number") {
        setS((p) => ({
          ...p,
          ...(typeof usd === "number" ? { usd } : {}),
          ...(typeof eur === "number" ? { eur } : {}),
        }));
        if (!silent) {
          if (source === "fallback") {
            // Tüm canlı provider'lar başarısız oldu — server fallback değer
            // döndü. Kullanıcı bunu bilsin ki manuel düzeltebilsin.
            toast.warning(
              "Canlı kur alınamadı — son bilinen ortalama değer dolduruldu. Kontrol edip kaydedin.",
            );
          } else {
            toast.success(
              source ? `Kurlar güncellendi (${source})` : "Kurlar güncellendi",
            );
          }
        }
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

  // DC/AC gücü kW cinsinden girilir/gösterilir ama depoda MW olarak saklanır
  // (GES motoru ve şablonlar MW bekler). Sadece bu input katmanı kW çalışır.
  function fKw(key: "dcGuc" | "acGuc") {
    const kw = (s[key] as number) > 0 ? (s[key] as number) * 1000 : 0;
    return {
      value: kw === 0 ? "" : kw,
      placeholder: "0",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const kwVal = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
        setS((p) => ({ ...p, [key]: kwVal / 1000 }));
      },
    };
  }

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

      <div className="space-y-5">
        <div className="space-y-5">
          {/* Power & system */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={Zap}
              title="Güç & Sistem Parametreleri"
              subtitle="DC/AC güç, panel ve inverter bilgileri"
              tone="info"
            />
            <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
              <div className="space-y-2">
                <Label>
                  DC Güç (kW) <span className="text-destructive">*</span>
                </Label>
                <Input type="number" step="1" required {...fKw("dcGuc")} />
                {s.dcGuc > 0 && (
                  <p className="text-xs font-medium text-info-soft-foreground">
                    {s.dcGuc.toFixed(2)} MWp
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>AC Güç (kW)</Label>
                <Input type="number" step="1" {...fKw("acGuc")} />
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
            <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
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
      </div>
    </div>
  );
}
