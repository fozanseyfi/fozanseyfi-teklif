"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Copy, Trash2, Link as LinkIcon, ExternalLink, Eye, Clock, Mail, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createShareLink, revokeShareLink, resendShareLinkEmail } from "@/app/actions/share";
import { SHARE_TABS, buildDocTabId, type SharePreset } from "@/lib/share-tabs";

interface ProjectOption {
  id: string;
  name: string;
  customerName: string;
}

interface LinkRow {
  id: string;
  token: string;
  projectId: string;
  projectName: string;
  customerLabel: string | null;
  recipientEmail: string | null;
  includedTabs: string[];
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface CustomDoc {
  id: string;
  title: string;
  fileName: string;
}

interface Props {
  projects: ProjectOption[];
  links: LinkRow[];
  organizationName: string;
  customDocuments: CustomDoc[];
}

const PRESET_OPTIONS: { value: SharePreset; label: string }[] = [
  { value: "1d", label: "1 gün" },
  { value: "7d", label: "7 gün" },
  { value: "14d", label: "14 gün" },
  { value: "30d", label: "30 gün" },
  { value: "60d", label: "60 gün" },
  { value: "90d", label: "90 gün" },
  { value: "infinite", label: "Süresiz" },
];

const TAB_LABEL_MAP = Object.fromEntries(SHARE_TABS.map((t) => [t.id, t.label]));

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function getStatus(link: LinkRow): {
  label: string;
  tone: "active" | "expired" | "revoked";
} {
  if (link.revokedAt) return { label: "İptal Edildi", tone: "revoked" };
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    return { label: "Süresi Doldu", tone: "expired" };
  }
  return { label: "Aktif", tone: "active" };
}

function formatRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "Süresiz";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Süresi doldu";
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days >= 1) return `${days} gün kaldı`;
  const hours = Math.floor(ms / (3600 * 1000));
  if (hours >= 1) return `${hours} saat kaldı`;
  return "1 saatten az";
}

export function ShareLinksClient({ projects, links, organizationName, customDocuments }: Props) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [preset, setPreset] = useState<SharePreset>("7d");
  // Varsayilan secim: musteriye guvenle gidebilecek tab'ler isaretli, hassas
  // (Fiyatli BoQ + Analiz) bos. "belgeler" sentinel'i otomatik turetilir,
  // selectedTabs'a manuel eklemeye gerek yok. Yonetici isteyerek isaretler.
  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(
    new Set(SHARE_TABS.filter((t) => !t.sensitive && t.id !== "belgeler").map((t) => t.id)),
  );
  // Ek belgeler: her custom doc icin ayri secim. Bos baslar — admin elle ekler.
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const anySensitiveSelected = SHARE_TABS.some(
    (t) => t.sensitive && selectedTabs.has(t.id),
  );

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function toggleTab(id: string) {
    setSelectedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Link kopyalandı");
  }

  function handleSubmit() {
    if (!selectedProject) {
      toast.error("Proje seçmelisin");
      return;
    }
    if (selectedTabs.size === 0 && selectedDocIds.size === 0) {
      toast.error("En az bir bölüm veya belge seçmelisin");
      return;
    }
    const fd = new FormData();
    fd.set("projectId", selectedProject);
    fd.set("customerLabel", customerLabel.trim());
    fd.set("recipientEmail", recipientEmail.trim());
    fd.set("preset", preset);
    selectedTabs.forEach((t) => fd.append("tabs", t));
    // Ek belge id'leri "doc:xxx" formatında tabs listesine eklenir
    selectedDocIds.forEach((id) => fd.append("tabs", buildDocTabId(id)));

    startTransition(async () => {
      const result = await createShareLink(fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.url) {
        const fullUrl = `${baseUrl}/share/${result.url}`;
        copyToClipboard(fullUrl);
        toast.success("Link oluşturuldu ve panoya kopyalandı");
        if (recipientEmail.trim() && result.emailSent) {
          toast.success(`Mail ${recipientEmail.trim()} adresine gönderildi`);
        } else if (recipientEmail.trim() && !result.emailSent) {
          toast.error(`Mail gönderilemedi: ${result.emailError ?? "bilinmeyen hata"}`);
        }
      }
      // Reset
      setCustomerLabel("");
      setRecipientEmail("");
      setSelectedDocIds(new Set());
    });
  }

  function handleRevoke(id: string) {
    if (!confirm("Bu paylaşım linkini iptal etmek istediğinden emin misin? İptal edilen link tekrar açılamaz.")) return;
    startTransition(async () => {
      const result = await revokeShareLink(id);
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "İptal edildi");
    });
  }

  function handleResend(id: string) {
    startTransition(async () => {
      const result = await resendShareLinkEmail(id);
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Mail gönderildi");
    });
  }

  const activeLinks = useMemo(() => links.filter((l) => !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt).getTime() > Date.now())), [links]);
  const archivedLinks = useMemo(() => links.filter((l) => l.revokedAt || (l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now())), [links]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden border-emerald-200 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Share2 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                  Yönetici Paneli
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Paylaşım Linkleri
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  <strong className="text-slate-900">{organizationName}</strong>{" "}
                  panelindeki projelerin müşteri/yatırımcıya gönderilebilir
                  read-only linkleri. Hangi sekmelerin (Keşif, BoQ, Analiz, DoR)
                  paylaşılacağını ve süresini sen belirlersin. Müşteri linke
                  tıklayınca sadece seçili sekmeleri görür ve PDF indirebilir.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yeni Paylaşım Oluştur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="size-4" /> Yeni Paylaşım Oluştur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project">Proje</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project" className="w-full">
                  <SelectValue placeholder="Proje seç..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      Hiç proje yok
                    </SelectItem>
                  )}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.customerName && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {p.customerName}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customerLabel">Müşteri Notu (opsiyonel)</Label>
              <Input
                id="customerLabel"
                placeholder="örn: Çimsa müşteri, Yatırımcı XYZ"
                value={customerLabel}
                onChange={(e) => setCustomerLabel(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipientEmail">
              Müşteri E-postası <span className="text-xs font-normal text-muted-foreground">(opsiyonel — boş bırakırsan sadece link kopyalanır)</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="recipientEmail"
                type="email"
                placeholder="musteri@firma.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Paylaşılacak Bölümler</Label>

            {/* Güvenli grup — müşteriye gönderilebilir.
                "belgeler" tab'ı listede gözükmez; otomatik olarak en az 1 ek
                belge seçilince Belgeler sekmesi public sayfada görünür. */}
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                Müşteri / yatırımcıya açıkça gönderilebilir
              </p>
              <div className="grid gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {SHARE_TABS.filter((t) => !t.sensitive && t.id !== "belgeler").map((t) => {
                  const isChecked = selectedTabs.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleTab(t.id)}
                      />
                      <span className="flex-1 font-medium text-foreground">{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Ek Belgeler — kullanıcı Profilim'den yüklemişse görünür */}
            {customDocuments.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-700">
                  <span className="inline-block size-1.5 rounded-full bg-slate-500" />
                  Ek Belgeler ({selectedDocIds.size} / {customDocuments.length} seçili)
                </p>
                <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customDocuments.map((d) => {
                    const isChecked = selectedDocIds.has(d.id);
                    return (
                      <label
                        key={d.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                          isChecked && "border-emerald-300/70 bg-emerald-50/40",
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleDoc(d.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {d.title}
                          </span>
                          <span className="block truncate text-[10.5px] text-muted-foreground">
                            {d.fileName}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-slate-500">
                  Yeni belge eklemek için: <strong>Profilim → Firma Profili & Referanslar → Ek Belgeler</strong>.
                </p>
              </div>
            )}

            {/* Hassas grup — maliyet/kâr içerir */}
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-warning-soft-foreground">
                <AlertTriangle className="size-3" />
                Maliyet / kâr içerir — dikkatli kullanın
              </p>
              <div className="grid gap-2 rounded-lg border border-warning/40 bg-warning-soft/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {SHARE_TABS.filter((t) => t.sensitive).map((t) => {
                  const isChecked = selectedTabs.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                        isChecked && "border-warning/60 bg-warning-soft/60",
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleTab(t.id)}
                      />
                      <span className="flex-1 font-medium text-foreground">{t.label}</span>
                      <AlertTriangle
                        className="size-3.5 text-warning-soft-foreground"
                        aria-label="Maliyet/kâr bilgisi içerir"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {anySensitiveSelected && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-xs text-warning-soft-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Dikkat:</strong> İşaretlediğin bölümlerden biri <strong>maliyet/kâr</strong> bilgisi içeriyor.
                  Bu içerikler müşteri/yatırımcıya genelde gönderilmez — şirket içi paylaşım için uygundur. Göndereceğine emin ol.
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset">Geçerlilik Süresi</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as SharePreset)}>
                <SelectTrigger id="preset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !selectedProject || selectedTabs.size === 0}
                className="w-full sm:w-auto"
              >
                <LinkIcon className="size-4" /> Link Oluştur
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aktif Linkler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="size-4" /> Aktif Linkler ({activeLinks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeLinks.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              Henüz aktif paylaşım linki yok. Yukarıdan yeni bir link oluştur.
            </div>
          ) : (
            <LinkTable
              rows={activeLinks}
              baseUrl={baseUrl}
              onCopy={copyToClipboard}
              onRevoke={handleRevoke}
              onResend={handleResend}
              showRevoke
              pending={pending}
            />
          )}
        </CardContent>
      </Card>

      {/* Arşiv */}
      {archivedLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" /> Geçmiş ({archivedLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LinkTable
              rows={archivedLinks}
              baseUrl={baseUrl}
              onCopy={copyToClipboard}
              onRevoke={handleRevoke}
              onResend={handleResend}
              showRevoke={false}
              pending={pending}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinkTable({
  rows,
  baseUrl,
  onCopy,
  onRevoke,
  onResend,
  showRevoke,
  pending,
}: {
  rows: LinkRow[];
  baseUrl: string;
  onCopy: (s: string) => void;
  onRevoke: (id: string) => void;
  onResend: (id: string) => void;
  showRevoke: boolean;
  pending: boolean;
}) {
  return (
    <>
      {/* Mobile: kart yığını — yatay scroll yerine her satır kart, aksiyon
          butonları kart altında her zaman görünür kalır. */}
      <div className="space-y-2.5 sm:hidden">
        {rows.map((l) => {
          const url = `${baseUrl}/share/${l.token}`;
          const status = getStatus(l);
          return (
            <div
              key={l.id}
              className="rounded-lg border bg-card p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {l.projectName}
                  </p>
                  {l.customerLabel && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {l.customerLabel}
                    </p>
                  )}
                  {l.recipientEmail && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-info-soft-foreground">
                      <Mail className="size-2.5" /> {l.recipientEmail}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] font-semibold",
                    status.tone === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                    status.tone === "expired" && "border-amber-200 bg-amber-50 text-amber-700",
                    status.tone === "revoked" && "border-red-200 bg-red-50 text-red-700",
                  )}
                >
                  {status.label}
                </Badge>
              </div>

              {/* Bölümler */}
              <div className="mt-2 flex flex-wrap gap-1">
                {l.includedTabs.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] font-semibold">
                    {TAB_LABEL_MAP[t] ?? t}
                  </Badge>
                ))}
              </div>

              {/* Süre + Görüntülenme */}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[11px]">
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Süre
                  </p>
                  <p className="mt-0.5 text-foreground">{formatRemaining(l.expiresAt)}</p>
                  {l.expiresAt && (
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateTime(l.expiresAt)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Görüntülenme
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-foreground">
                    <Eye className="size-3 text-muted-foreground" />
                    <span className="font-semibold">{l.viewCount}</span>
                  </p>
                  {l.lastViewedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Son: {formatDateTime(l.lastViewedAt)}
                    </p>
                  )}
                </div>
              </div>

              {/* Aksiyon butonları — etiketli, mobile'da net görünür */}
              {status.tone === "active" && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => onCopy(url)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Copy className="size-3.5" /> Kopyala
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ExternalLink className="size-3.5" /> Linke Git
                  </a>
                  {l.recipientEmail && (
                    <button
                      type="button"
                      onClick={() => onResend(l.id)}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-info/30 bg-info-soft/40 px-2 py-1.5 text-[11.5px] font-semibold text-info-soft-foreground transition-colors hover:bg-info-soft/70 disabled:opacity-50"
                    >
                      <Send className="size-3.5" /> Tekrar Mail
                    </button>
                  )}
                  {showRevoke && (
                    <button
                      type="button"
                      onClick={() => onRevoke(l.id)}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50/40 px-2 py-1.5 text-[11.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" /> İptal Et
                    </button>
                  )}
                </div>
              )}

              <p className="mt-2 text-[10px] text-muted-foreground/70">
                Oluşturuldu: {formatDateTime(l.createdAt)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Desktop: tablo */}
      <div className="hidden overflow-hidden rounded-lg border sm:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-medium">Proje / Müşteri</th>
            <th className="px-3 py-2.5 text-left font-medium">Bölümler</th>
            <th className="px-3 py-2.5 text-left font-medium">Süre</th>
            <th className="px-3 py-2.5 text-left font-medium">Görüntülenme</th>
            <th className="px-3 py-2.5 text-left font-medium">Durum</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((l) => {
            const url = `${baseUrl}/share/${l.token}`;
            const status = getStatus(l);
            return (
              <tr key={l.id} className="hover:bg-muted/40">
                <td className="px-3 py-3">
                  <div className="font-medium text-foreground">{l.projectName}</div>
                  {l.customerLabel && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {l.customerLabel}
                    </div>
                  )}
                  {l.recipientEmail && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-info-soft-foreground">
                      <Mail className="size-2.5" /> {l.recipientEmail}
                    </div>
                  )}
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    Oluşturuldu: {formatDateTime(l.createdAt)}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {l.includedTabs.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px] font-semibold"
                      >
                        {TAB_LABEL_MAP[t] ?? t}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-foreground whitespace-nowrap">
                  {formatRemaining(l.expiresAt)}
                  {l.expiresAt && (
                    <div className="text-[10px] text-muted-foreground">
                      {formatDateTime(l.expiresAt)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Eye className="size-3.5 text-muted-foreground" />
                    <span className="font-semibold">{l.viewCount}</span>
                  </div>
                  {l.lastViewedAt && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Son: {formatDateTime(l.lastViewedAt)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
                      status.tone === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                      status.tone === "expired" && "border-amber-200 bg-amber-50 text-amber-700",
                      status.tone === "revoked" && "border-red-200 bg-red-50 text-red-700",
                    )}
                  >
                    {status.label}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {status.tone === "active" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onCopy(url)}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Linki kopyala"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Yeni sekmede aç"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                        {l.recipientEmail && (
                          <button
                            type="button"
                            onClick={() => onResend(l.id)}
                            disabled={pending}
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-info-soft hover:text-info-soft-foreground disabled:opacity-50"
                            title={`Maili ${l.recipientEmail} adresine yeniden gönder`}
                          >
                            <Send className="size-3.5" />
                          </button>
                        )}
                      </>
                    )}
                    {showRevoke && status.tone === "active" && (
                      <button
                        type="button"
                        onClick={() => onRevoke(l.id)}
                        disabled={pending}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title="İptal et"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
