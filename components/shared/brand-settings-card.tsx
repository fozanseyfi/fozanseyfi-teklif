"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  updateBrandSettings,
  uploadBrandLogo,
  removeBrandLogo,
} from "@/app/actions/firm";
import type { BrandSettings } from "@/lib/pdf-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Palette,
  Image as ImageIcon,
  Upload,
  X,
  Eye,
  Loader2,
  Save,
  CheckCircle2,
  Quote,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BrandPreviewModal } from "./brand-preview-modal";

interface Props {
  firmName: string;
  initialBrand: BrandSettings;
}

// Hazir kurumsal palet — kullanici "Diger" ile ozel hex de girebilir.
const PALETTE: { name: string; color: string }[] = [
  { name: "Emerald", color: "#059669" },
  { name: "Lacivert", color: "#1e3a8a" },
  { name: "Bordo", color: "#9f1239" },
  { name: "Antrasit", color: "#1f2937" },
  { name: "Mavi", color: "#2563eb" },
  { name: "Mor", color: "#7c3aed" },
  { name: "Turuncu", color: "#ea580c" },
  { name: "Yesil", color: "#16a34a" },
];

const DEFAULT_COLOR = "#059669";

export function BrandSettingsCard({ firmName, initialBrand }: Props) {
  // ─── Local state (form) ──────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | undefined>(initialBrand.logoUrl);
  const [logoEnabled, setLogoEnabled] = useState(initialBrand.logoEnabled ?? false);
  const [color, setColor] = useState(initialBrand.color ?? DEFAULT_COLOR);
  const [colorEnabled, setColorEnabled] = useState(initialBrand.colorEnabled ?? false);
  const [slogan, setSlogan] = useState(initialBrand.slogan ?? "");
  const [sloganEnabled, setSloganEnabled] = useState(initialBrand.sloganEnabled ?? false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(initialBrand.watermarkEnabled ?? false);
  const [taxNumber, setTaxNumber] = useState(initialBrand.taxNumber ?? "");
  const [contact, setContact] = useState(initialBrand.contact ?? "");

  // ─── Logo upload ─────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  function onPickLogo() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    startUpload(async () => {
      const r = await uploadBrandLogo(fd);
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        if (r.url) {
          setLogoUrl(r.url);
          setLogoEnabled(true);
        }
      }
      e.target.value = ""; // ayni dosya tekrar secilebilsin
    });
  }

  const [removing, startRemove] = useTransition();
  function onRemoveLogo() {
    if (!logoUrl) return;
    startRemove(async () => {
      const r = await removeBrandLogo();
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        setLogoUrl(undefined);
        setLogoEnabled(false);
      }
    });
  }

  // ─── Save (server action) ────────────────────────────────────────────
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => updateBrandSettings(fd),
    null,
  );

  // ─── Preview modal ───────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);

  // Onizleme icin canli (kaydedilmemis) brand snapshot'i
  const liveBrand: BrandSettings = {
    logoUrl,
    logoEnabled,
    color,
    colorEnabled,
    slogan: slogan || undefined,
    sloganEnabled,
    watermarkEnabled,
    taxNumber: taxNumber || undefined,
    contact: contact || undefined,
  };

  // Toast feedback
  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Palette className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Marka Ayarları
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                PDF ve Excel çıktılarında firma kimliğinizi gösterin. Web arayüzü
                etkilenmez. Her unsur opsiyoneldir — istediğinizi açıp
                kapatabilirsiniz.
              </p>
            </div>
          </div>

          <form action={formAction} className="ml-0 space-y-5 sm:ml-12">
            {/* ─── LOGO ────────────────────────────────────────────────── */}
            <FieldRow icon={ImageIcon} label="Firma Logosu">
              <div className="flex flex-wrap items-center gap-3">
                {logoUrl ? (
                  <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Firma logosu"
                      className="h-12 w-auto max-w-[120px] object-contain"
                    />
                    <button
                      type="button"
                      onClick={onRemoveLogo}
                      disabled={removing}
                      title="Logoyu kaldır"
                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Henüz logo yok.</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPickLogo}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {logoUrl ? "Değiştir" : "Yükle"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                PNG, JPG, SVG veya WebP. En fazla 2 MB.
              </p>
              <ToggleRow
                name="logoEnabled"
                checked={logoEnabled}
                onChange={setLogoEnabled}
                disabled={!logoUrl}
                label="Logoyu PDF'lerde göster"
                hint={!logoUrl ? "Önce logo yüklemelisin" : undefined}
              />
            </FieldRow>

            {/* ─── RENK ────────────────────────────────────────────────── */}
            <FieldRow icon={Palette} label="Marka Rengi">
              <div className="flex flex-wrap items-center gap-1.5">
                {PALETTE.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    onClick={() => setColor(p.color)}
                    title={`${p.name} (${p.color})`}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border-2 transition-all",
                      color.toLowerCase() === p.color.toLowerCase()
                        ? "scale-110 border-slate-900 shadow-md"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: p.color }}
                  >
                    {color.toLowerCase() === p.color.toLowerCase() && (
                      <CheckCircle2 className="size-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
                <div className="ml-2 flex items-center gap-2">
                  <Label className="text-[11px] text-slate-500">Özel:</Label>
                  <input
                    type="color"
                    name="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border bg-card"
                  />
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                    {color.toUpperCase()}
                  </code>
                </div>
              </div>
              <ToggleRow
                name="colorEnabled"
                checked={colorEnabled}
                onChange={setColorEnabled}
                label="Marka rengini PDF kapaklarında uygula"
              />
            </FieldRow>

            {/* ─── SLOGAN ──────────────────────────────────────────────── */}
            <FieldRow icon={Quote} label="Slogan / Alt Yazı">
              <Input
                name="slogan"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Örn. Güneşten enerji, mühendislikten güven"
                maxLength={80}
              />
              <p className="text-[11px] text-slate-500">
                PDF kapağında firma adının altında küçük puntoda gözükür.
                Maks. 80 karakter.
              </p>
              <ToggleRow
                name="sloganEnabled"
                checked={sloganEnabled}
                onChange={setSloganEnabled}
                disabled={!slogan.trim()}
                label="Sloganı PDF'lerde göster"
                hint={!slogan.trim() ? "Önce slogan yaz" : undefined}
              />
            </FieldRow>

            {/* ─── WATERMARK ───────────────────────────────────────────── */}
            <FieldRow icon={Type} label="Arka Plan Filigranı">
              <p className="text-[11.5px] leading-relaxed text-slate-600">
                Sayfa arkasında çapraz, çok soluk firma adı yazısı. Belgenin
                kopyalanmasını caydırır.
              </p>
              <ToggleRow
                name="watermarkEnabled"
                checked={watermarkEnabled}
                onChange={setWatermarkEnabled}
                label="Çapraz firma adı filigranı ekle"
              />
            </FieldRow>

            {/* ─── ÇıKTı KıMLıK BıLGıLERı ──────────────────────────────── */}
            <FieldRow label="Çıktı Footer Bilgileri (Opsiyonel)">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    Vergi No
                  </Label>
                  <Input
                    name="taxNumber"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="Örn. 1234567890"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    İletişim (telefon / web)
                  </Label>
                  <Input
                    name="contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Örn. www.firma.com.tr · 0312 ..."
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Bu bilgiler PDF footer'ında firma adıyla birlikte küçük
                puntoda gözükür. Boş bırakılırsa hiç gösterilmez.
              </p>
            </FieldRow>

            {/* ─── SABıT BıLGıLER ──────────────────────────────────────── */}
            <div className="rounded-md border border-info/30 bg-info-soft/30 px-3 py-2 text-[11.5px] leading-relaxed text-info-soft-foreground">
              <strong>Her zaman aktif:</strong> PDF footer'ında çıktıyı üreten
              kullanıcı (e-posta), tarih ve benzersiz bir <code>doc-id</code>
              {" "}otomatik basılır — kopyalama caydırıcılığı için kapatılamaz.
            </div>

            {/* ─── BUTONLAR ────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="size-3.5" />
                Önizle
              </Button>
              <Button type="submit" disabled={pending} size="sm">
                <Save className="size-3.5" />
                {pending ? "Kaydediliyor…" : "Marka Ayarlarını Kaydet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <BrandPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        firmName={firmName}
        brand={liveBrand}
      />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function FieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-slate-400" />}
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  name,
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 text-[12px] transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:border-emerald-200 hover:bg-emerald-50/50",
        checked && !disabled && "border-emerald-300 bg-emerald-50/40",
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="size-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
      />
      <span className="flex-1 font-medium text-slate-700">{label}</span>
      {hint && <span className="text-[11px] italic text-slate-400">{hint}</span>}
    </label>
  );
}
