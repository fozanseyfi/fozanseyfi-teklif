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
import { CompanyProfileCard } from "@/components/shared/company-profile-card";
import { AccountPrivacyCard } from "@/components/shared/account-privacy-card";
import { switchOrganization } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  Check,
  Crown,
  KeyRound,
  LayoutGrid,
  Loader2,
  Mail,
  Save,
  Shield,
  User,
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
    <div className="space-y-5">
      {/* Kimlik şeridi — tüm platformlarda aynı Profilim düzeni */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border bg-gradient-to-b from-card to-muted/40 px-6 py-5">
        <div className="flex min-w-0 basis-full items-center gap-4 sm:basis-0 sm:flex-1">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {initials(fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Profilim</p>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-foreground">
              <span className="truncate">{fullName}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <Shield className="size-3" /> {roleLabel}
              </span>
            </h1>
            {profile.email && <p className="truncate text-[13px] text-muted-foreground">{profile.email}</p>}
          </div>
        </div>
        <dl className="flex gap-6 text-xs">
          <div>
            <dt className="text-muted-foreground">Şirket</dt>
            <dd className="font-semibold text-foreground">{firm.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Üyelik</dt>
            <dd className="font-semibold text-foreground">{formatDate(joinedAt)}</dd>
          </div>
        </dl>
        {isAdmin && (
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Users className="size-4" /> Ekibi yönet <ArrowRight className="size-3.5" />
          </Link>
        )}
      </section>

      {/* Panellerim */}
      <Panel
        icon={LayoutGrid}
        title="Panellerim"
        desc="Üye olduğunuz paneller. Kendi panelinizde yöneticisiniz; davet aldığınız panellere buradan veya üst başlıktaki seçiciden geçebilirsiniz."
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
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* Profil (+ şirket adı, yönetici için) */}
        <Panel icon={User} title="Profil" desc="Ekip arkadaşlarınız sizi bu isimle görür.">
          <form action={profileAction} className="space-y-3.5">
            <FieldGroup label="Ad Soyad">
              <Input name="fullName" defaultValue={fullName} required placeholder="Ad Soyad" />
            </FieldGroup>
            <FieldGroup label="E-posta">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={profile.email ?? ""} readOnly className="pl-9 bg-muted/50 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Değiştirmek için{" "}
                <Link href="/contact" className="font-semibold text-foreground underline-offset-2 hover:underline">
                  bize yazın
                </Link>
                .
              </p>
            </FieldGroup>
            {profileState?.error && <FormMessage tone="error">{profileState.error}</FormMessage>}
            {profileState?.success && <FormMessage tone="success">{profileState.success}</FormMessage>}
            <div className="flex justify-end">
              <Button type="submit" disabled={profilePending} size="sm">
                <Save className="size-3.5" />
                {profilePending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </form>
          {isAdmin && (
            <form action={updateFirmProfile} className="mt-4 space-y-3.5 border-t pt-4">
              <FieldGroup label="Şirket / panel adı">
                <Input name="name" defaultValue={firm.name} required />
              </FieldGroup>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  <Building2 className="size-3.5" />
                  Şirket adını kaydet
                </Button>
              </div>
            </form>
          )}
        </Panel>

        {/* Şifre */}
        <Panel icon={KeyRound} title="Şifre" desc="Mevcut şifrenizle onaylayıp yenisini belirleyin.">
          <form action={pwdAction} className="space-y-3.5">
            <FieldGroup label="Mevcut şifre">
              <PasswordInput name="currentPassword" autoComplete="current-password" />
            </FieldGroup>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FieldGroup label="Yeni şifre">
                <PasswordInput name="newPassword" autoComplete="new-password" placeholder="En az 8 karakter" />
              </FieldGroup>
              <FieldGroup label="Yeni şifre (tekrar)">
                <PasswordInput name="confirmPassword" autoComplete="new-password" placeholder="Tekrar yazın" />
              </FieldGroup>
            </div>
            {pwdState?.error && <FormMessage tone="error">{pwdState.error}</FormMessage>}
            {pwdState?.success && <FormMessage tone="success">{pwdState.success}</FormMessage>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">Unuttuysanız çıkış yapıp &quot;Şifremi unuttum&quot;u kullanın.</p>
              <Button type="submit" disabled={pwdPending} size="sm">
                <KeyRound className="size-3.5" />
                {pwdPending ? "Güncelleniyor…" : "Şifreyi güncelle"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>

      {/* Marka ayarları ve firma profili — yönetici (PDF/Excel çıktıları ve paylaşım) */}
      {isAdmin && <BrandSettingsCard firmName={firm.name} initialBrand={brand} />}
      {isAdmin && (
        <CompanyProfileCard
          initialBrochureUrl={brand.brochureUrl}
          initialBrochureFileName={brand.brochureFileName}
          initialReferencesBrochureUrl={brand.referencesBrochureUrl}
          initialReferencesBrochureFileName={brand.referencesBrochureFileName}
          initialCustomDocuments={brand.customDocuments ?? []}
        />
      )}

      {/* KVKK — veri indirme + hesap silme */}
      <AccountPrivacyCard userEmail={profile.email ?? ""} />
    </div>
  );
}

/** Başlıklı sade kart — tüm platformlarda aynı Profilim düzeni */
function Panel({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-start gap-3 border-b px-5 py-3.5">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
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
