"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveProjectInfo } from "@/app/actions/ges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@prisma/client";
import type { GesSettings } from "@/lib/ges-defaults";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  User,
  FileText,
  AlertTriangle,
  Lightbulb,
  Home,
  MapPin,
  X,
  Plus,
  Search,
  UserPlus,
  ChevronDown,
} from "lucide-react";

interface Customer {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface Props {
  projectId: string;
  project: Project;
  il: string;
  ilce: string;
  settings: GesSettings;
  customers: Customer[];
}

type InstallationType = "ROOFTOP" | "GROUND_MOUNTED";

const INSTALL_OPTIONS: {
  value: InstallationType;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "ROOFTOP", label: "Çatı Üstü", desc: "Bina çatısı üzeri", Icon: Home },
  {
    value: "GROUND_MOUNTED",
    label: "Arazi",
    desc: "Zemin / tarla sistemi",
    Icon: ({ className }) => (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.36 18.36l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
        />
      </svg>
    ),
  },
];

type SectionTone = "primary" | "info" | "warning" | "destructive" | "success";

const SECTION_TONE: Record<SectionTone, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary-soft", iconText: "text-primary-soft-foreground" },
  info: { iconBg: "bg-info-soft", iconText: "text-info-soft-foreground" },
  success: { iconBg: "bg-success-soft", iconText: "text-success-soft-foreground" },
  warning: { iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground" },
  destructive: {
    iconBg: "bg-destructive-soft",
    iconText: "text-destructive-soft-foreground",
  },
};

function SectionHeader({
  icon: Icon,
  title,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: SectionTone;
}) {
  const t = SECTION_TONE[tone];
  return (
    <div className="flex items-center gap-3 border-b px-6 py-4">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          t.iconBg,
        )}
      >
        <Icon className={cn("size-4", t.iconText)} />
      </div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    </div>
  );
}

// ── Bullet-list editor ──────────────────────────────────────────────────────
function BulletListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  function update(i: number, v: string) {
    const next = [...items];
    next[i] = v;
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, ""]);
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-sm font-bold text-muted-foreground/50">•</span>
          <Input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive-soft hover:text-destructive-soft-foreground"
            aria-label="Maddeyi sil"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" /> Madde Ekle
      </button>
    </div>
  );
}

// ── Customer combobox ────────────────────────────────────────────────────────
function CustomerSelect({
  customers,
  value,
  onChange,
  onContactFill,
}: {
  customers: Customer[];
  value: string;
  onChange: (v: string) => void;
  onContactFill: (c: Customer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [addOpen, setAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  function selectCustomer(c: Customer) {
    onChange(c.name);
    setQuery(c.name);
    onContactFill(c);
    setOpen(false);
  }

  function applyNew() {
    if (!newCust.name.trim()) return;
    onChange(newCust.name.trim());
    setQuery(newCust.name.trim());
    onContactFill({
      name: newCust.name.trim(),
      email: newCust.email || null,
      phone: newCust.phone || null,
      address: newCust.address || null,
    });
    setAddOpen(false);
    setNewCust({ name: "", email: "", phone: "", address: "" });
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Müşteri adı ara veya yaz…"
          className="pl-9 pr-10"
        />
        <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto overflow-hidden rounded-md border bg-popover shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <button
                key={c.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCustomer(c)}
                className="block w-full border-b px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-muted"
              >
                <p className="text-sm font-medium">{c.name}</p>
                {(c.email || c.phone) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Eşleşen müşteri yok
            </div>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="flex w-full items-center gap-2 border-t bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70"
          >
            <UserPlus className="size-4" /> Yeni Müşteri Ekle
          </button>
        </div>
      )}

      {/* Add customer modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <UserPlus className="size-4" />
                </div>
                <h2 className="font-semibold">Yeni Müşteri</h2>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="flex size-8 items-center justify-center rounded-md border bg-card hover:bg-muted"
                aria-label="Kapat"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Müşteri / Firma Adı *
                </Label>
                <Input
                  value={newCust.name}
                  onChange={(e) =>
                    setNewCust((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Firma veya kişi adı"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  E-posta *
                </Label>
                <Input
                  type="email"
                  required
                  value={newCust.email}
                  onChange={(e) =>
                    setNewCust((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="ornek@firma.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Telefon *
                </Label>
                <Input
                  required
                  value={newCust.phone}
                  onChange={(e) =>
                    setNewCust((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="0532 000 00 00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Adres
                </Label>
                <Input
                  value={newCust.address}
                  onChange={(e) =>
                    setNewCust((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Firma veya saha adresi"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={applyNew}
                disabled={
                  !newCust.name.trim() ||
                  !newCust.email.trim() ||
                  !newCust.phone.trim()
                }
              >
                <CheckCircle2 className="size-4" /> Ekle ve Seç
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────
export function ProjeBilgileriForm({
  projectId,
  project,
  il,
  ilce,
  settings,
  customers,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const shouldAdvanceRef = useRef(false);

  const action = saveProjectInfo.bind(null, projectId);
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => {
      await action(fd);
      const adv = shouldAdvanceRef.current;
      shouldAdvanceRef.current = false;
      return { advance: adv };
    },
    null,
  );

  useEffect(() => {
    if (state?.advance) router.push(`/projects/${projectId}/detail/teknik`);
  }, [state, projectId, router]);

  const [nameVal, setNameVal] = useState(project.name ?? "");
  const [customerNameVal, setCustomerNameVal] = useState(project.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(project.customerEmail ?? "");
  const [customerPhone, setCustomerPhone] = useState(project.customerPhone ?? "");
  const [customerAddress, setCustomerAddress] = useState(project.customerAddress ?? "");
  const [installationType, setInstallationType] = useState<InstallationType>(
    (project.installationType as InstallationType) || "ROOFTOP",
  );
  const [ilVal, setIlVal] = useState(il ?? "");
  const [ilceVal, setIlceVal] = useState(ilce ?? "");
  const [notes, setNotes] = useState<string[]>(
    settings.notes?.length ? settings.notes : [""],
  );
  const [risks, setRisks] = useState<string[]>(
    settings.risks?.length ? settings.risks : [""],
  );
  const [insights, setInsights] = useState<string[]>(
    settings.customerInsights?.length ? settings.customerInsights : [""],
  );

  function handleContactFill(c: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  }) {
    setCustomerNameVal(c.name);
    if (c.email) setCustomerEmail(c.email);
    if (c.phone) setCustomerPhone(c.phone);
    if (c.address) setCustomerAddress(c.address);
  }

  function handleAdvance() {
    shouldAdvanceRef.current = true;
    formRef.current?.requestSubmit();
  }

  const location = [ilceVal.trim(), ilVal.trim()].filter(Boolean).join(" / ");

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Hidden inputs */}
      <input type="hidden" name="installationType" value={installationType} />
      <input type="hidden" name="systemSize" value="LARGE" />
      <input type="hidden" name="electricityTariff" value="INDUSTRIAL" />
      <input type="hidden" name="il" value={ilVal} />
      <input type="hidden" name="ilce" value={ilceVal} />
      <input type="hidden" name="projectLocation" value={location} />
      <input type="hidden" name="customerName" value={customerNameVal} />
      <input type="hidden" name="customerEmail" value={customerEmail} />
      <input type="hidden" name="customerPhone" value={customerPhone} />
      <input type="hidden" name="customerAddress" value={customerAddress} />
      <input type="hidden" name="notes" value={notes.filter(Boolean).join("\n")} />
      <input type="hidden" name="risks" value={risks.filter(Boolean).join("\n")} />
      <input
        type="hidden"
        name="customerInsights"
        value={insights.filter(Boolean).join("\n")}
      />

      {/* Top nav */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="flex size-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Projelere dön"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="text-[11px] leading-none text-muted-foreground">
              Proje Bilgileri
            </p>
            <p className="mt-0.5 max-w-xs truncate text-sm font-semibold leading-tight">
              {nameVal || "Yeni Proje"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending}
          >
            <CheckCircle2 className="size-3.5" />
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAdvance}
            disabled={pending}
          >
            Teknik Parametreler <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Proje Bilgileri */}
          <Card className="overflow-hidden">
            <SectionHeader icon={Building2} title="Proje Bilgileri" tone="info" />
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="name">Proje Adı</Label>
                <Input
                  id="name"
                  name="name"
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  placeholder="Örn: Konya 5 MWp GES Projesi (opsiyonel)"
                />
              </div>

              {/* Kurulum Tipi */}
              <div className="space-y-2.5">
                <Label>Kurulum Tipi</Label>
                <div className="grid grid-cols-2 gap-3">
                  {INSTALL_OPTIONS.map(({ value, label, desc, Icon }) => {
                    const sel = installationType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setInstallationType(value)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                          sel
                            ? "border-primary bg-primary-soft"
                            : "border-border bg-card hover:border-input/80",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            sel
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              sel ? "text-primary-soft-foreground" : "text-foreground",
                            )}
                          >
                            {label}
                          </p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Konum */}
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  Proje Konumu
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">İl</p>
                    <Input
                      value={ilVal}
                      onChange={(e) => setIlVal(e.target.value)}
                      placeholder="Örn: Ankara"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">İlçe</p>
                    <Input
                      value={ilceVal}
                      onChange={(e) => setIlceVal(e.target.value)}
                      placeholder="Örn: Polatlı"
                    />
                  </div>
                </div>
                {location && (
                  <div className="flex items-center gap-2 rounded-md border border-success-soft bg-success-soft px-4 py-2.5">
                    <MapPin className="size-4 shrink-0 text-success-soft-foreground" />
                    <span className="text-sm font-medium text-success-soft-foreground">
                      {location}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Müşteri */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={User}
              title="Müşteri / İşveren Bilgileri"
              tone="success"
            />
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Label>İşveren / Müşteri Adı</Label>
                <CustomerSelect
                  customers={customers}
                  value={customerNameVal}
                  onChange={setCustomerNameVal}
                  onContactFill={handleContactFill}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-posta</Label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="ornek@firma.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefon</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0532 000 00 00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Adres</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Firma / saha adresi"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          {/* Notlar */}
          <Card className="overflow-hidden">
            <SectionHeader icon={FileText} title="Teklif Detay Notları" tone="warning" />
            <CardContent className="p-6">
              <BulletListEditor
                items={notes}
                onChange={setNotes}
                placeholder="Detay mühendislik tasarım aşamasında metraj farklılıkları söz konusu olabilir…"
              />
            </CardContent>
          </Card>

          {/* Riskler */}
          <Card className="overflow-hidden">
            <SectionHeader icon={AlertTriangle} title="Riskler" tone="destructive" />
            <CardContent className="p-6">
              <BulletListEditor
                items={risks}
                onChange={setRisks}
                placeholder="Örn: Döviz kuru riski, malzeme tedarik gecikmesi…"
              />
            </CardContent>
          </Card>

          {/* Müşteri Öngörüleri */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={Lightbulb}
              title="Müşteri Öngörüleri"
              tone="primary"
            />
            <CardContent className="p-6">
              <BulletListEditor
                items={insights}
                onChange={setInsights}
                placeholder="Müşteri beklentileri, özel istekler, görüşme notları…"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
