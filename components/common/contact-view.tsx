"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Bug,
  ChevronDown,
  Code2,
  Globe,
  HelpCircle,
  Info,
  Lightbulb,
  Mail,
  MessageSquare,
  Phone,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "./tokens";
import { DEVELOPER as DEV, PLATFORMS, type PlatformInfo } from "./platforms-data";
import { PlatformLogo, type PlatformId } from "./platform-logos";

/**
 * Ortak İletişim sayfası — tüm platformlarda birebir aynı şablon (components/common/).
 * Platforma özel metinler `config` ile, renkler ./tokens ile gelir.
 */
export interface ContactConfig {
  /** Bu platform (Diğer platformlar listesinde "Buradasın") */
  current: PlatformId;
  /** E-posta konusunun ön eki, ör. "Fizibilite" */
  subjectTag: string;
  /** Yasal bildirim alt satırındaki kısa etiket */
  footerTag: string;
  bio: string;
  /** Mesaj formunun alt açıklaması */
  formNote: string;
  /** Konu alanı örneği */
  subjectPlaceholder: string;
  privacy: React.ReactNode;
  disclaimerTitle: string;
  disclaimer: React.ReactNode;
  legalIntro: string;
  clauses: { title: string; body: React.ReactNode }[];
  /** Varsa mesaj sunucu üzerinden gönderilir; yoksa e-posta uygulaması açılır */
  onSend?: (input: { topic: string; subject: string; message: string }) => Promise<void>;
}

type Topic = "feedback" | "bug" | "feature" | "question";

const TOPIC_TONES = {
  blue: "border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#2563eb] dark:text-[#60a5fa]",
  rose: "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#dc2626] dark:text-[#f87171]",
  amber: "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#d97706] dark:text-[#fbbf24]",
  violet: "border-[#8b5cf6]/40 bg-[#8b5cf6]/10 text-[#7c3aed] dark:text-[#a78bfa]",
} as const;

const TOPICS: { key: Topic; label: string; icon: React.ComponentType<{ className?: string }>; tone: keyof typeof TOPIC_TONES }[] = [
  { key: "feedback", label: "Genel Geri Bildirim", icon: MessageSquare, tone: "blue" },
  { key: "bug", label: "Hata Bildirimi", icon: Bug, tone: "rose" },
  { key: "feature", label: "Özellik Önerisi", icon: Lightbulb, tone: "amber" },
  { key: "question", label: "Soru / Yardım", icon: HelpCircle, tone: "violet" },
];

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const btnBase = "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";

export function ContactView({ config }: { config: ContactConfig }) {
  const [topic, setTopic] = useState<Topic>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = subject.trim().length > 0 && message.trim().length >= 10;
  const topicLabel = TOPICS.find((t) => t.key === topic)?.label ?? "Geri Bildirim";

  function mailto() {
    const params = new URLSearchParams({
      subject: `[${config.subjectTag} – ${topicLabel}] ${subject || "Geri Bildirim"}`,
      body: message,
    });
    window.location.href = `mailto:${DEV.email}?${params.toString()}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (!config.onSend) return mailto();
    setSending(true);
    setNote(null);
    try {
      await config.onSend({ topic: topicLabel, subject: subject.trim(), message: message.trim() });
      setNote({ ok: true, text: `Mesajınız ${DEV.email} adresine iletildi.` });
      setSubject("");
      setMessage("");
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Gönderim hatası" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* BAŞLIK */}
      <div className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br p-8 md:p-12", T.border, T.heroGrad)}>
        <div className="common-flow pointer-events-none absolute inset-0" />
        <div className={cn("pointer-events-none absolute -right-16 -top-16 size-64 rounded-full blur-3xl", T.glow)} />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-72 rounded-full bg-[#3b82f6]/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className={cn("mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider", T.accentSoft, T.accentText)}>
            <MessageSquare className="size-3" />
            Katkılarınız
          </div>
          <h1 className={cn("text-3xl font-extrabold leading-[1.1] tracking-tight md:text-[36px]", T.fg)}>
            Sizden gelen her geri bildirim
            <br className="hidden md:block" /> <span className={T.accentText}>platformu daha iyi yapar.</span>
          </h1>
          <p className={cn("mt-3 max-w-2xl text-[15px] leading-relaxed md:text-base", T.sub)}>
            Hata bildirimi, özellik önerisi veya genel sorularınız için aşağıdaki formdan veya doğrudan iletişim
            kanallarından bana ulaşabilirsiniz.
          </p>
        </div>
      </div>

      {/* GELİŞTİRİCİ + FORM */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className={cn("overflow-hidden rounded-xl border shadow-sm lg:col-span-5", T.border, T.card)}>
          <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-7 text-white">
            <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-[#10b981]/20 blur-2xl" />
            <div className="relative">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#10b981]/20 ring-1 ring-[#10b981]/30 backdrop-blur">
                <Code2 className="size-5 text-white" />
              </div>
              <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#34d399]">Geliştirici</div>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight" data-no-i18n>{DEV.name}</h2>
              <div className="mt-0.5 text-sm text-[#cbd5e1]">{DEV.role}</div>
              <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-[#cbd5e1]/95">{config.bio}</p>
              <dl className="mt-5">
                {(
                  [
                    ["Şu an", `${DEV.position} · ${DEV.company}`],
                    ["Eğitim", DEV.education],
                    ["Uzmanlık", DEV.expertise],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 border-t border-white/10 py-2.5">
                    <dt className="pt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{k}</dt>
                    <dd className="text-[13px] font-semibold text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="space-y-1 p-4">
            <ContactRow href={`tel:${DEV.phone.replace(/\s/g, "")}`} icon={Phone} label="Telefon" value={DEV.phone} />
            <ContactRow href={`mailto:${DEV.email}`} icon={Mail} label="E-posta" value={DEV.email} />
            <ContactRow href={DEV.linkedin.href} external icon={LinkedInIcon} label="LinkedIn" value={DEV.linkedin.label} />
            <ContactRow href={DEV.website.href} external icon={Globe} label="Web Sitesi" value={DEV.website.label} />
          </div>
        </div>

        <div className={cn("rounded-xl border shadow-sm lg:col-span-7", T.border, T.card)}>
          <div className="p-6 md:p-8">
            <div className={cn("mb-6 border-b pb-4", T.border)}>
              <div className={cn("mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", T.accentText)}>
                <Send className="size-3" />
                Mesaj Formu
              </div>
              <h3 className={cn("text-xl font-extrabold tracking-tight", T.fg)}>Mesajınızı Bırakın</h3>
              <p className={cn("mt-1.5 max-w-xl text-sm", T.sub)}>{config.formNote}</p>
            </div>

            <form className="space-y-6" onSubmit={submit}>
              <div>
                <p className={cn("mb-2 text-[11px] font-bold uppercase tracking-wider", T.faint)}>Konu Türü</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {TOPICS.map((t) => {
                    const Icon = t.icon;
                    const active = topic === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTopic(t.key)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-all",
                          active ? TOPIC_TONES[t.tone] : cn(T.border, T.card, T.faint, "hover:opacity-80")
                        )}
                      >
                        <Icon className="size-4" />
                        <span className="text-center leading-tight">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="c-subject" className={cn("mb-1.5 block text-[11px] font-bold uppercase tracking-wider", T.faint)}>
                  Konu
                </label>
                <input
                  id="c-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={config.subjectPlaceholder}
                  required
                  className={cn("flex h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/40", T.input, T.fg)}
                />
              </div>

              <div>
                <label htmlFor="c-message" className={cn("mb-1.5 block text-[11px] font-bold uppercase tracking-wider", T.faint)}>
                  Mesaj
                </label>
                <textarea
                  id="c-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detaylı açıklama: hangi sayfada, hangi adımda yaşandı, ne bekleniyordu, ne oldu?"
                  rows={7}
                  required
                  minLength={10}
                  className={cn("flex w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/40", T.input, T.fg)}
                />
                <div className={cn("mt-1 flex justify-between text-[11px]", T.faint)}>
                  <span>En az 10 karakter</span>
                  <span className={cn(message.trim().length >= 10 && cn("font-semibold", T.accentText))}>{message.length} karakter</span>
                </div>
              </div>

              {note && (
                <p className={cn("rounded-md px-3 py-2 text-sm", note.ok ? "bg-[#10b981]/10 text-[#047857] dark:text-[#6ee7b7]" : "bg-[#ef4444]/10 text-[#b91c1c] dark:text-[#fca5a5]")}>
                  {note.text}
                </p>
              )}

              <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t pt-4", T.border)}>
                <button type="button" onClick={mailto} disabled={sending} className={cn(btnBase, T.btnOutline, T.fg)}>
                  <Mail className="size-4" />
                  E-posta ile Gönder
                </button>
                <button type="submit" disabled={!valid || sending} className={cn(btnBase, T.btn)}>
                  <Send className="size-4" />
                  {sending ? "Gönderiliyor…" : "Gönder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* BİLGİ KARTLARI */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard icon={ShieldCheck} tone="green" eyebrow="Veri Gizliliği" title="Verileriniz size aittir">
          {config.privacy}
        </InfoCard>
        <InfoCard icon={Info} tone="yellow" eyebrow="Sorumluluk Reddi" title={config.disclaimerTitle}>
          {config.disclaimer}
        </InfoCard>
      </div>

      {/* YASAL BİLDİRİM (kapalı, tıklayınca açılır) */}
      <details className={cn("group overflow-hidden rounded-2xl border shadow-sm", T.border, T.card)}>
        <summary className={cn("flex cursor-pointer list-none items-start gap-4 border-[#f59e0b]/30 bg-gradient-to-r from-[#f59e0b]/15 via-[#f59e0b]/5 px-6 py-5 group-open:border-b [&::-webkit-details-marker]:hidden", T.toCard)}>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f59e0b] text-white shadow-sm">
            <Scale className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-[#d97706] dark:text-[#fbbf24]">
              <ShieldAlert className="size-3" />
              Yasal Bildirim
            </div>
            <h3 className={cn("mt-1 text-xl font-extrabold leading-tight tracking-tight", T.fg)}>Disclaimer · Sorumluluk Reddi</h3>
            <p className={cn("mt-1 max-w-3xl text-[13px] leading-relaxed", T.sub)}>{config.legalIntro}</p>
          </div>
          <span className={cn("ml-auto mt-1 inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold", T.border, T.card, T.sub)}>
            <span className="group-open:hidden">Göster</span>
            <span className="hidden group-open:inline">Gizle</span>
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 md:grid-cols-2">
          {config.clauses.map((s, i) => (
            <div key={s.title} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f59e0b]/15 font-mono text-[11px] font-bold tabular-nums text-[#d97706] dark:text-[#fbbf24]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h4 className={cn("text-[13px] font-bold tracking-tight", T.fg)}>{s.title}</h4>
                <p className={cn("mt-1 text-[12.5px] leading-relaxed", T.sub)}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className={cn("flex justify-between border-t px-6 py-3 font-mono text-[10px]", T.border, T.faint)}>
          <span>
            Sorularınız için: <span className={T.sub}>{DEV.email}</span>
          </span>
          <span>{config.footerTag}</span>
        </div>
      </details>

      {/* DİĞER PLATFORMLAR */}
      <section className={cn("relative mt-8 overflow-hidden rounded-2xl border border-[#f59e0b]/30 bg-gradient-to-br from-[#f59e0b]/10 via-[#f59e0b]/5 p-6 md:p-8", T.toCard)}>
        <div className="mb-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[1.4px] text-[#d97706] dark:text-[#fbbf24]">
            <Sparkles className="size-3" />
            Diğer Ücretsiz Platformlarım
          </span>
        </div>
        <h2 className={cn("text-xl font-extrabold tracking-tight md:text-2xl", T.fg)}>Geliştirdiğim diğer platformlara da göz atın</h2>
        <p className={cn("mt-2 max-w-3xl text-sm leading-relaxed", T.sub)}>
          Hepsi tamamen ücretsiz, <strong className={T.fg}>bağımsız bir inisiyatifle</strong> sektör paydaşlarına sunuluyor.
          Diğer platformlara ulaşmak için kart üzerine tıklamanız yeterli.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {PLATFORMS.map((p) => (
            <PlatformCard key={p.id} item={p} here={p.id === config.current} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlatformCard({ item, here }: { item: PlatformInfo; here: boolean }) {
  const soon = item.status === "soon";
  const linked = !!item.href && !here && !soon;
  const inner = (
    <div
      className={cn(
        "relative h-full rounded-xl border p-4 transition-all",
        T.card,
        here
          ? "border-[#f59e0b]/60 shadow-sm ring-2 ring-[#f59e0b]/40"
          : linked
            ? cn(T.border, "cursor-pointer hover:-translate-y-0.5 hover:shadow-md")
            : cn(T.border, "opacity-90")
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <PlatformLogo id={item.id} size={40} className="shrink-0 rounded-lg shadow-sm" />
        <StatusBadge here={here} soon={soon} />
      </div>
      <div className={cn("text-sm font-bold leading-tight tracking-tight", T.fg)} data-no-i18n>{item.title}</div>
      <div className={cn("mt-1 text-[12px] leading-snug", T.sub)}>{item.tagline}</div>
      {linked && (
        <div className={cn("mt-2 inline-flex items-center gap-1 text-[11px] font-bold", T.accentText)}>
          Aç <ArrowUpRight className="size-3" />
        </div>
      )}
    </div>
  );
  if (linked)
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="group block">
        {inner}
      </a>
    );
  return inner;
}

function StatusBadge({ here, soon }: { here: boolean; soon: boolean }) {
  if (here)
    return <span className="inline-flex items-center rounded-md bg-[#f59e0b] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Buradasın</span>;
  if (soon)
    return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", T.soft2, T.faint)}>Yakında</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#10b981]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#059669] dark:text-[#34d399]">
      <span className="size-1.5 animate-pulse rounded-full bg-[#10b981]" />
      Canlı
    </span>
  );
}

const INFO_TONES = {
  green: { box: "border-[#10b981]/30 bg-[#10b981]/5", icon: "bg-[#059669] text-white", text: "text-[#059669] dark:text-[#34d399]" },
  yellow: { box: "border-[#f59e0b]/30 bg-[#f59e0b]/5", icon: "bg-[#f59e0b] text-white", text: "text-[#d97706] dark:text-[#fbbf24]" },
} as const;

function InfoCard({
  icon: Icon,
  tone,
  eyebrow,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof INFO_TONES;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const t = INFO_TONES[tone];
  return (
    <div className={cn("rounded-xl border p-5", t.box)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm", t.icon)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className={cn("text-[10px] font-bold uppercase tracking-wider", t.text)}>{eyebrow}</div>
          <h4 className={cn("mt-0.5 text-sm font-bold", T.fg)}>{title}</h4>
          <p className={cn("mt-2 text-xs leading-relaxed", T.sub)}>{children}</p>
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  href,
  external,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  external?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn("flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors", T.hoverSoft)}
    >
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", T.soft, T.sub)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[10px] font-bold uppercase tracking-wider", T.faint)}>{label}</div>
        <div className={cn("truncate text-sm font-semibold", T.fg)}>{value}</div>
      </div>
    </a>
  );
}
