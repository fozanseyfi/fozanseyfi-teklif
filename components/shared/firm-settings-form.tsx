"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateFirmProfile,
  updateMyProfile,
  updateMyPassword,
} from "@/app/actions/firm";
import type { BrandSettings } from "@/lib/pdf-brand";
import { BrandSettingsCard } from "@/components/shared/brand-settings-card";
import { switchOrganization } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Crown,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  User,
  UserCircle2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Organization, Profile } from "@prisma/client";
import { cn } from "@/lib/utils";

interface PanelOption {
  id: string;
  name: string;
  role: "admin" | "user" | "viewer";
  isActive: boolean;
  /** Bu panel kullanicinin kendi yarattigi (signup'ta otomatik
   *  olusturulan) panel mi? Owner ise true. */
  isOwn: boolean;
  joinedAt: Date;
}

interface Props {
  firm: Organization;
  profile: Profile;
  platformRole: "admin" | "user" | "viewer";
  joinedAt: Date;
  panels: PanelOption[];
  brand: BrandSettings;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Yönetici",
  user: "Kullanıcı",
  viewer: "Görüntüleyici",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function FirmSettingsForm({ firm, profile, platformRole, joinedAt, panels, brand }: Props) {
  const fullName = profile.fullName || profile.email?.split("@")[0] || "Kullanıcı";
  const roleLabel = ROLE_LABEL[platformRole] ?? platformRole;
  const isAdmin = platformRole === "admin";

  // ─── Profile name update ─────────────────────────────────────────────
  const [profileState, profileAction, profilePending] = useActionState(
    async (_: unknown, fd: FormData) => updateMyProfile(fd),
    null,
  );

  // ─── Password update ─────────────────────────────────────────────────
  const [pwdState, pwdAction, pwdPending] = useActionState(
    async (_: unknown, fd: FormData) => updateMyPassword(fd),
    null,
  );

  // ─── Panel switcher ──────────────────────────────────────────────────
  const [switching, startSwitching] = useTransition();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  function handleSwitch(panelId: string) {
    setSwitchingId(panelId);
    startSwitching(async () => {
      const res = await switchOrganization(panelId);
      if (res?.error) {
        toast.error(res.error);
        setSwitchingId(null);
        return;
      }
      toast.success(res?.success ?? "Panel değiştirildi");
      // Hard navigate — sidebar firmName, layout auth context, hepsi
      // server-side render edildigi icin tam reload gerek.
      window.location.href = "/dashboard";
    });
  }

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────
          HERO — kompakt avatar + isim + meta. Sade slate gradient,
          karardestek-style disiplin: tek aksent (emerald) detaylarda.
         ───────────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <CardContent className="p-0">
          <div className="relative">
            {/* Background — yumusak slate, sag ust kosede ince emerald accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40" />
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-200" />

            <div className="relative grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-7">
              {/* Avatar */}
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-2xl font-bold tracking-tight text-white shadow-lg shadow-emerald-900/20 ring-4 ring-white">
                {initials(fullName)}
              </div>

              {/* Identity */}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                    <UserCircle2 className="size-3" />
                    Profilim
                  </span>
                </div>
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
                  {fullName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                    <Shield className="size-3 text-emerald-600" />
                    {roleLabel}
                  </span>
                  {profile.email && (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Mail className="size-3.5" />
                      {profile.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-grid — Şirket / Rol / Üyelik Tarihi */}
            <div className="relative grid gap-px overflow-hidden border-t border-slate-200/80 bg-slate-200/80 sm:grid-cols-3">
              <MetaCell icon={Building2} label="Şirket" value={firm.name} />
              <MetaCell icon={Shield} label="Rol" value={roleLabel} />
              <MetaCell icon={Calendar} label="Üyelik Tarihi" value={formatDate(joinedAt)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────
          PANELLERİM — kullanicinin uye oldugu tum paneller listelenir.
          Davet ile katilanlar buradan kendi panellerine gecip orada admin
          olarak yeni proje + kullanici daveti yapabilirler. Aktif panelin
          ustunde "Aktif" rozeti, kendi paneli ise "Senin Panelin" rozeti.
         ───────────────────────────────────────────────────────────────── */}
      <SectionCard
        icon={LayoutGrid}
        title="Panellerim"
        subtitle={
          <>
            Üye olduğun tüm paneller burada listelenir. <strong>Kendi panelinde
            yöneticisin</strong> — orada yeni projeler oluşturabilir, kullanıcı
            ve görüntüleyici davet edebilirsin. Davet aldığın panellere üst
            başlıktaki <strong>&quot;Panel:&quot;</strong> seçicisinden veya
            buradaki butonlardan istediğin zaman geri dönebilirsin.
          </>
        }
      >
        <div className="space-y-2.5">
          {panels.map((p) => (
            <PanelRow
              key={p.id}
              panel={p}
              busy={switching && switchingId === p.id}
              disabled={switching}
              onSwitch={() => handleSwitch(p.id)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────
          PROFİL BİLGİLERİ
         ───────────────────────────────────────────────────────────────── */}
      <SectionCard
        icon={User}
        title="Profil bilgileri"
        subtitle="Görünen adınızı güncelleyin — ekip arkadaşlarınız sizi bu isimle görür."
      >
        <form action={profileAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Ad Soyad">
              <Input
                name="fullName"
                defaultValue={fullName}
                required
                placeholder="Ad Soyad"
              />
            </FieldGroup>
            <FieldGroup label="E-posta">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={profile.email ?? ""}
                  readOnly
                  className="pl-9 bg-slate-50 text-slate-600"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                E-posta değişimi için <Link href="/contact" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">iletişime geçin</Link>.
              </p>
            </FieldGroup>
          </div>

          {profileState?.error && <FormMessage tone="error">{profileState.error}</FormMessage>}
          {profileState?.success && <FormMessage tone="success">{profileState.success}</FormMessage>}

          <div className="flex">
            <Button type="submit" disabled={profilePending} size="sm">
              <Save className="size-3.5" />
              {profilePending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────
          ŞİRKET / PANEL ADI — sadece admin için
         ───────────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <SectionCard
          icon={Building2}
          title="Şirket / panel adı"
          subtitle="Sidebar başlığında ve topbar'da görünen şirket adı."
        >
          <form action={updateFirmProfile} className="space-y-4">
            <FieldGroup label="Şirket Adı">
              <Input name="name" defaultValue={firm.name} required />
            </FieldGroup>
            <div className="flex">
              <Button type="submit" size="sm">
                <Save className="size-3.5" />
                Kaydet
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MARKA AYARLARI — sadece admin (PDF/Excel ciktilarinda kullanilir)
         ───────────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <BrandSettingsCard firmName={firm.name} initialBrand={brand} />
      )}

      {/* ─────────────────────────────────────────────────────────────────
          ŞİFRE GÜVENLİĞİ
         ───────────────────────────────────────────────────────────────── */}
      <SectionCard
        icon={KeyRound}
        title="Şifre güvenliği"
        subtitle={
          <>
            Mevcut şifrenizi onaylayarak yeni bir şifre belirleyin. Şifrenizi
            unuttuysanız çıkış yapıp{" "}
            <strong className="font-semibold text-slate-700">"Şifremi unuttum"</strong>{" "}
            bağlantısını kullanın.
          </>
        }
      >
        <form action={pwdAction} className="space-y-4">
          <FieldGroup label="Mevcut Şifre">
            <PasswordInput name="currentPassword" autoComplete="current-password" />
          </FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Yeni Şifre">
              <PasswordInput
                name="newPassword"
                autoComplete="new-password"
                placeholder="En az 8 karakter"
              />
            </FieldGroup>
            <FieldGroup label="Yeni Şifre (Tekrar)">
              <PasswordInput
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="En az 8 karakter"
              />
            </FieldGroup>
          </div>

          {pwdState?.error && <FormMessage tone="error">{pwdState.error}</FormMessage>}
          {pwdState?.success && <FormMessage tone="success">{pwdState.success}</FormMessage>}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pwdPending} size="sm">
              <KeyRound className="size-3.5" />
              {pwdPending ? "Güncelleniyor…" : "Şifreyi Güncelle"}
            </Button>
            <p className="text-[11px] text-slate-500">
              Şifre değişiminden sonra mevcut oturumlar bozulmaz.
            </p>
          </div>
        </form>
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────
          EKİP ve YETKİLENDİRME — admin için belirgin CTA paneli
         ───────────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <Card className="overflow-hidden border-emerald-200 shadow-sm">
          <CardContent className="p-0">
            <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
              {/* Sol: aciklama + ozellik listesi */}
              <div className="space-y-4 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                      Yönetici Paneli
                    </p>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                      Ekip ve Yetkilendirme
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      Kullanıcı davet et, rolleri yönet, kaynak erişimini
                      kişi bazında ayarla.
                    </p>
                  </div>
                </div>

                {/* Ozellik chip'leri */}
                <div className="grid gap-2 sm:grid-cols-3">
                  <FeatureChip
                    icon={UserPlus}
                    title="Kullanıcı Davet Et"
                    desc="E-posta ile davet"
                  />
                  <FeatureChip
                    icon={Shield}
                    title="Rol Yönetimi"
                    desc="Yönetici / Kullanıcı / Görüntüleyici"
                  />
                  <FeatureChip
                    icon={Lock}
                    title="Erişim Kontrolü"
                    desc="Proje bazlı gizle / salt okunur"
                  />
                </div>
              </div>

              {/* Sag: buyuk CTA — emerald gradient, vurgulu */}
              <div className="flex items-stretch border-t border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-6 lg:border-l lg:border-t-0">
                <Link
                  href="/admin/users"
                  className="group inline-flex w-full items-center justify-between gap-3 rounded-xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg lg:w-auto lg:flex-col lg:items-center lg:justify-center lg:gap-2 lg:px-7 lg:py-5"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 lg:size-12">
                    <Users className="size-5 lg:size-6" />
                  </div>
                  <div className="flex flex-1 flex-col text-left lg:flex-none lg:items-center lg:text-center">
                    <span className="text-[15px] font-bold leading-tight lg:text-base">
                      Ekibi Yönet
                    </span>
                    <span className="text-[11px] font-medium opacity-80 lg:mt-0.5">
                      Davet, rol, erişim
                    </span>
                  </div>
                  <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1 lg:hidden" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Helper sub-components ─────────────────────────────────────────────

function FeatureChip({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold leading-tight text-slate-900">{title}</p>
        <p className="mt-0.5 text-[10.5px] leading-tight text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function PanelRow({
  panel,
  busy,
  disabled,
  onSwitch,
}: {
  panel: PanelOption;
  busy: boolean;
  disabled: boolean;
  onSwitch: () => void;
}) {
  const roleBadge = ROLE_LABEL[panel.role] ?? panel.role;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-all",
        panel.isActive
          ? "border-emerald-300 bg-emerald-50/60 shadow-sm"
          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
          panel.isOwn
            ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
            : "bg-slate-100 text-slate-600 ring-slate-200",
        )}
      >
        {panel.isOwn ? <Crown className="size-4" /> : <Building2 className="size-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-900">
            {panel.name}
          </p>
          {panel.isOwn && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-700">
              <Crown className="size-2.5" />
              Senin Panelin
            </span>
          )}
          {panel.isActive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-800">
              <Check className="size-2.5" />
              Aktif
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Shield className="size-3 text-slate-400" />
            {roleBadge}
          </span>
          <span className="text-slate-300">·</span>
          <span>Katılım: {formatDate(panel.joinedAt)}</span>
        </div>
      </div>

      <div className="shrink-0">
        {panel.isActive ? (
          <span className="text-[11px] font-medium text-slate-400">
            Şu an buradasınız
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSwitch}
            disabled={disabled}
            className={cn(
              panel.isOwn &&
                "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800",
            )}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowRight className="size-3.5" />
            )}
            {busy ? "Geçiliyor…" : panel.isOwn ? "Kendi Paneline Geç" : "Bu Panele Geç"}
          </Button>
        )}
      </div>
    </div>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white px-5 py-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="ml-0 sm:ml-12">{children}</div>
      </CardContent>
    </Card>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}

function PasswordInput({
  name,
  autoComplete,
  placeholder,
}: {
  name: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
      <Input
        type="password"
        name={name}
        autoComplete={autoComplete}
        placeholder={placeholder ?? "••••••••"}
        className="pl-9"
      />
    </div>
  );
}

function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-xs font-medium",
        tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {children}
    </p>
  );
}
