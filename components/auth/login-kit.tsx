"use client";

/*
 * ORTAK GİRİŞ SAYFASI — bütün fozanseyfi platformlarında BU DOSYA BİREBİR AYNIDIR.
 * (teklif · pm · karardestek · fizibilite · mounting)
 *
 * Platforma özgü olan yalnızca `LoginPlatform` nesnesidir (lib/login-platform.ts):
 * ad, logo, renk, sağ sütundaki tanıtım ve tanıtım ekran görüntüleri. Üst bar, form,
 * geliştirici notu, platform listesi ve alt bar her yerde aynı kalır.
 *
 * Bağımlılık: react, next/link ve her repoda aynı yolda duran components/common/platform-logos.
 * Renkler kendi CSS değişkenlerinden gelir; Tailwind 3 / 4 ve farklı temalarda aynı görünür.
 * Değiştirince diğer repolara da aynen kopyalayın.
 */

import { useState } from "react";
import Link from "next/link";
// Her platform reposunda aynı yolda bulunan gerçek platform logoları
import { PlatformLogo } from "@/components/common/platform-logos";

type LogoId = React.ComponentProps<typeof PlatformLogo>["id"];

// ─── Platforma özgü yapılandırma ─────────────────────────────────────────────

export type PlatformId = "teklif" | "pm" | "karar" | "fizibilite" | "bom";

export interface LoginPlatform {
  id: PlatformId;
  /** Kısa ad — üst bar ve başlık: "SolarTeklif" */
  name: string;
  /** Uzun ad — üst bar alt satırı: "Solar Teklif Platformu" */
  fullName: string;
  /** Logo (platformun kendi BrandMark bileşeni) */
  mark: React.ReactNode;
  /** Vurgu rengi (açık / gece) */
  accent: string;
  accentDark: string;
  /** Sağ sütun — platformun kendini anlattığı yer */
  intro: {
    eyebrow: string;
    title: string;
    text: string;
    points: { title: string; text: string }[];
  };
  /** Sağ sütundaki büyük gerçek ekran görüntüsü */
  hero?: { img: string; caption: string; href: string };
  /** Veri gizliliği maddeleri (yoksa gösterilmez) */
  privacy?: string[];
  /** Alt şerit: tanıtım turundan gerçek ekranlar */
  tour?: {
    text: string;
    modules: { id: string; title: string }[];
    total: number;
    previews: { id: string; img: string; title: string; label: string }[];
  };
  /** Bağlantılar (varsayılanlar: /register, /forgot-password, /tanitim). register: null → kayıt bağlantıları gizlenir. */
  links?: { register?: string | null; forgot?: string; tour?: string };
}

export interface LoginFormProps {
  /** Server action (useActionState) — ya da onSubmit */
  action?: (formData: FormData) => void;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
  error?: string | null;
  defaultEmail?: string;
  defaultPassword?: string;
  /**
   * "password" (varsayılan): e-posta + şifre.
   * "profile": şifresiz yerel profil — Ad Soyad (name="fullName") + e-posta (isteğe bağlı).
   */
  mode?: "password" | "profile";
  defaultName?: string;
  /** Formun altına küçük açıklama (ör. "Şifreli giriş yakında") */
  note?: string;
}

// ─── Ortak içerik ────────────────────────────────────────────────────────────

const DEV = {
  name: "Furkan Ozan Seyfi",
  linkedin: "https://www.linkedin.com/in/fozanseyfi/",
  site: "https://fozanseyfi.com",
  email: "mailto:fozanseyfi@gmail.com",
};

/** Platform ailesi — logo (components/common/platform-logos), marka rengi ve kısa tanıtım. */
const PLATFORMS: {
  id: PlatformId | "muhendislik";
  logo: LogoId;
  name: string;
  text: string;
  color: string;
  href?: string;
}[] = [
  { id: "teklif", logo: "teklif", name: "Solar Teklif", color: "#059669", href: "https://teklif.fozanseyfi.com",
    text: "GES EPC teklifi: keşif, analiz, teklif belgesi, sözleşme ve maliyet kontrolü." },
  { id: "pm", logo: "proje", name: "Proje Yönetim", color: "#4f46e5", href: "https://pm.fozanseyfi.com",
    text: "Şantiye planlama, günlük gerçekleşme, puantaj, satınalma ve hakediş takibi." },
  { id: "karar", logo: "karardestek", name: "Satınalma Karar Destek", color: "#d97706", href: "https://karardestek.fozanseyfi.com",
    text: "Tedarikçi tekliflerini ağırlıklı ölçütlerle puanlayıp karşılaştırma." },
  { id: "fizibilite", logo: "fizibilite", name: "Solar Fizibilite", color: "#1f4e8c", href: "https://fizibilite.fozanseyfi.com",
    text: "GES ve batarya yatırımında nakit akışı, getiri ve geri ödeme analizi." },
  { id: "bom", logo: "bom", name: "Konstrüksiyon BoM", color: "#1a4a94",
    text: "Sehpa parça listesi, tonaj ve konstrüksiyon maliyeti hesabı." },
  { id: "muhendislik", logo: "ges-muh", name: "GES Mühendislik", color: "#e11d48",
    text: "Tasarım hesapları ve teknik dokümantasyon; hazırlanıyor." },
];

function kitCss(accent: string, accentDark: string) {
  return `
.lk{--lk-accent:${accent};--lk-bg:#f3f4f6;--lk-panel:#ffffff;--lk-soft:#f8f9fb;--lk-text:#14181f;--lk-muted:#5d6672;--lk-line:#d9dde3;--lk-input:#c9ced6;--lk-err-bg:#fdf2f2;--lk-err:#9b1c1c;
  background:var(--lk-bg);color:var(--lk-text);min-height:100vh;display:flex;flex-direction:column}
.dark .lk{--lk-accent:${accentDark};--lk-bg:#0f1216;--lk-panel:#161a20;--lk-soft:#1b2027;--lk-text:#e6e8eb;--lk-muted:#9aa3ae;--lk-line:#2a3038;--lk-input:#38404a;--lk-err-bg:#2a1515;--lk-err:#f3a5a5}
.lk a{color:inherit}
.lk .lk-input{width:100%;height:40px;border:1px solid var(--lk-input);border-radius:4px;background:var(--lk-panel);color:var(--lk-text);padding:0 12px;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}
.lk .lk-input:focus{border-color:var(--lk-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--lk-accent) 18%,transparent)}
.lk .lk-input::placeholder{color:var(--lk-muted);opacity:.7}
.lk .lk-btn{display:inline-flex;align-items:center;justify-content:center;height:40px;border-radius:4px;background:var(--lk-accent);color:#fff;font-weight:600;font-size:14px;transition:filter .15s}
.lk .lk-btn:hover{filter:brightness(.92)}
.lk .lk-btn:disabled{opacity:.6;cursor:default}
.lk .lk-link{color:var(--lk-accent);font-weight:600}
.lk .lk-link:hover{text-decoration:underline}
.lk .lk-shot{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;object-position:top;background:#fff}
`;
}

// ─── Parçalar ────────────────────────────────────────────────────────────────

/** Üst bardaki geliştirici bağlantıları: LinkedIn · site · e-posta (her ekran boyunda). */
function DevLinks() {
  const cls =
    "flex size-8 items-center justify-center rounded border border-[var(--lk-line)] text-[var(--lk-muted)] transition-colors hover:border-[var(--lk-accent)] hover:text-[var(--lk-accent)]";
  return (
    <span className="flex items-center gap-1">
      <a href={DEV.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" className={cls}>
        <svg viewBox="0 0 24 24" className="size-[15px]" fill="currentColor" aria-hidden="true">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
        </svg>
      </a>
      <a href={DEV.site} target="_blank" rel="noopener noreferrer" title="fozanseyfi.com" aria-label="fozanseyfi.com" className={cls}>
        <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
      </a>
      <a href={DEV.email} title="E-posta" aria-label="E-posta" className={cls}>
        <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </a>
    </span>
  );
}

function TopBar({ p }: { p: LoginPlatform }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--lk-line)] bg-[var(--lk-panel)]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/login" className="flex min-w-0 items-center gap-2.5">
          <span className="size-8 shrink-0 [&>svg]:size-8">{p.mark}</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-bold">{p.name}</span>
            <span className="hidden truncate text-[11px] text-[var(--lk-muted)] sm:block">{p.fullName}</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-[13px] sm:gap-4">
          <DevLinks />
          <Link href={p.links?.tour ?? "/tanitim"} className="hidden px-1 text-[var(--lk-muted)] hover:text-[var(--lk-text)] sm:inline">
            Platform tanıtımı
          </Link>
          <a href="#platformlar" className="hidden px-1 text-[var(--lk-muted)] hover:text-[var(--lk-text)] md:inline">
            Diğer platformlar
          </a>
          {p.links?.register !== null && (
            <Link
              href={p.links?.register ?? "/register"}
              className="ml-1 rounded border border-[var(--lk-line)] px-2.5 py-1.5 font-semibold hover:border-[var(--lk-accent)] hover:text-[var(--lk-accent)] sm:ml-0 sm:px-3"
            >
              <span className="sm:hidden">Kayıt</span>
              <span className="hidden sm:inline">Hesap oluştur</span>
            </Link>
          )}
          {p.links?.register === null && (
            <Link
              href={p.links?.tour ?? "/tanitim"}
              className="rounded border border-[var(--lk-line)] px-3 py-1.5 font-semibold hover:border-[var(--lk-accent)] hover:text-[var(--lk-accent)] sm:hidden"
            >
              Tanıtım
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function LoginForm({ p, form }: { p: LoginPlatform; form: LoginFormProps }) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded border border-[var(--lk-line)] bg-[var(--lk-panel)]">
      <div className="border-b border-[var(--lk-line)] px-6 py-5">
        <p className="text-[12px] text-[var(--lk-muted)]">{p.name}</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight">Giriş yap</h1>
      </div>
      <form action={form.action} onSubmit={form.onSubmit} className="space-y-4 px-6 py-5">
        {form.error && (
          <div role="alert" className="rounded border border-[var(--lk-err)] bg-[var(--lk-err-bg)] px-3 py-2 text-[13px] text-[var(--lk-err)]">
            {form.error}
          </div>
        )}
        {form.mode === "profile" && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Ad Soyad</span>
            <input
              className="lk-input"
              name="fullName"
              required
              autoComplete="name"
              placeholder="Adınız Soyadınız"
              defaultValue={form.defaultName}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">E-posta</span>
          <input
            className="lk-input"
            name="email"
            type="email"
            required={form.mode !== "profile"}
            autoComplete="email"
            placeholder="ornek@firma.com"
            defaultValue={form.defaultEmail}
          />
        </label>
        {form.mode !== "profile" && <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="lk-password" className="text-[13px] font-semibold">Şifre</label>
            <Link href={p.links?.forgot ?? "/forgot-password"} className="lk-link text-[12px]">
              Şifremi unuttum
            </Link>
          </div>
          <div className="relative">
            <input
              id="lk-password"
              className="lk-input pr-16"
              name="password"
              type={show ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Şifreniz"
              defaultValue={form.defaultPassword}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 text-[12px] font-semibold text-[var(--lk-muted)] hover:text-[var(--lk-text)]"
              aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {show ? "Gizle" : "Göster"}
            </button>
          </div>
        </div>}
        <button type="submit" className="lk-btn w-full" disabled={form.pending}>
          {form.pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
        {form.note && <p className="text-center text-[12px] text-[var(--lk-muted)]">{form.note}</p>}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--lk-line)] bg-[var(--lk-soft)] px-6 py-3 text-[13px]">
        {p.links?.register !== null ? (
          <span className="text-[var(--lk-muted)]">
            Hesabınız yok mu?{" "}
            <Link href={p.links?.register ?? "/register"} className="lk-link">
              Kayıt olun
            </Link>
          </span>
        ) : (
          <span />
        )}
        <Link href={p.links?.tour ?? "/tanitim"} className="text-[var(--lk-muted)] hover:text-[var(--lk-text)]">
          Önce bir göz atın →
        </Link>
      </div>
    </div>
  );
}

/** Geliştirici notu — bütün platformlarda aynı. */
function DevNote() {
  return (
    <div className="border-l-2 border-[var(--lk-accent)] pl-4 text-[13.5px] leading-relaxed text-[var(--lk-muted)]">
      <p className="font-semibold text-[var(--lk-text)]">Merhaba, ben Ozan.</p>
      <p className="mt-2">
        Uzun süre sahada ve masa başında, teklif hazırlarken, keşif çıkarırken, tedarikçi karşılaştırırken hep
        aynı Excel dosyalarıyla uğraştım. Bu platformlar, önce kendi işimi kolaylaştırmak için yazdığım
        araçlardan doğdu.
      </p>
      <p className="mt-2">
        Arkasında bir şirket yok, size satmaya çalıştığım bir şey de yok. İşinize yararsa ne mutlu bana. Eksik
        gördüğünüz ya da canınızı sıkan bir şey olursa{" "}
        <a href={DEV.email} className="lk-link">yazın</a>; bir sonraki özellik sizin
        &ldquo;şu da olsa&rdquo; demenizle gelebilir.
      </p>
      <p className="mt-2 text-[var(--lk-text)]">— {DEV.name}</p>
    </div>
  );
}

function Intro({ p }: { p: LoginPlatform }) {
  const { intro, hero, privacy } = p;
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lk-accent)]">{intro.eyebrow}</p>
      <h2 className="mt-2 max-w-[34ch] text-[26px] font-bold leading-[1.2] tracking-tight sm:text-[30px]">{intro.title}</h2>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--lk-muted)]">{intro.text}</p>

      <ol className="mt-6 grid border-t border-[var(--lk-line)] sm:grid-cols-2">
        {intro.points.map((pt, i) => (
          <li
            key={pt.title}
            className="flex gap-3 border-b border-[var(--lk-line)] py-3 sm:odd:pr-5 sm:even:border-l sm:even:pl-5"
          >
            <span className="pt-px font-mono text-[12px] tabular-nums text-[var(--lk-accent)]">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">{pt.title}</span>
              <span className="block text-[12.5px] leading-snug text-[var(--lk-muted)]">{pt.text}</span>
            </span>
          </li>
        ))}
      </ol>

      {hero && (
        <figure className="mt-6">
          <Link href={hero.href} className="block overflow-hidden rounded border border-[var(--lk-line)] bg-[var(--lk-panel)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- statik tanıtım görseli */}
            <img src={hero.img} alt={hero.caption} className="lk-shot keep-light" loading="eager" decoding="async" />
          </Link>
          <figcaption className="mt-2 flex items-center justify-between gap-3 text-[12px] text-[var(--lk-muted)]">
            <span>{hero.caption}</span>
            <Link href={hero.href} className="lk-link shrink-0">Ekranları gezin →</Link>
          </figcaption>
        </figure>
      )}

      {privacy && privacy.length > 0 && (
        <div className="mt-6 rounded border border-[var(--lk-line)] bg-[var(--lk-panel)] px-4 py-3">
          <p className="text-[13px] font-semibold">Verileriniz size aittir</p>
          <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-[12.5px] text-[var(--lk-muted)] sm:grid-cols-2">
            {privacy.map((it) => (
              <li key={it} className="flex gap-2">
                <span className="text-[var(--lk-accent)]">–</span>
                {it}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TourStrip({ p }: { p: LoginPlatform }) {
  const t = p.tour;
  if (!t || t.previews.length === 0) return null;
  const href = p.links?.tour ?? "/tanitim";
  return (
    <section id="tanitim" className="border-t border-[var(--lk-line)] bg-[var(--lk-panel)]">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,4fr)_8fr] lg:gap-10 lg:px-8 lg:py-10">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold tracking-tight">Kayıt olmadan ekranları inceleyin</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--lk-muted)]">{t.text}</p>
          <ul className="mt-4 columns-2 gap-4 text-[12.5px]">
            {t.modules.map((m, i) => (
              <li key={m.id} className="break-inside-avoid py-0.5">
                <Link href={`${href}#${m.id}`} className="hover:text-[var(--lk-accent)]">
                  <span className="mr-1.5 font-mono tabular-nums text-[var(--lk-muted)]">{String(i + 1).padStart(2, "0")}</span>
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={href} className="lk-btn mt-5 px-4">
            Tanıtımı başlat
          </Link>
          <span className="ml-3 text-[12px] text-[var(--lk-muted)]">
            {t.modules.length} bölüm · {t.total} ekran
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3 self-center sm:grid-cols-3">
          {t.previews.map((s, i) => (
            <Link
              key={s.id + i}
              href={`${href}#${s.id}`}
              className={`group min-w-0 ${i === 2 ? "hidden sm:block" : ""}`}
            >
              <span className="block overflow-hidden rounded border border-[var(--lk-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- statik tanıtım görseli */}
                <img src={s.img} alt={s.title} loading="lazy" decoding="async" className="lk-shot keep-light transition-transform duration-300 group-hover:scale-[1.02]" />
              </span>
              <span className="mt-1.5 block truncate text-[12px] text-[var(--lk-muted)] group-hover:text-[var(--lk-text)]">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformList({ current }: { current: PlatformId }) {
  return (
    <section id="platformlar" className="border-t border-[var(--lk-line)]">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">Diğer platformlarım</h2>
            <p className="mt-1 text-[13px] text-[var(--lk-muted)]">
              Aynı ailenin araçları — tek hesapla hepsine girebilirsiniz.
            </p>
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {PLATFORMS.map((x) => {
            const isCurrent = x.id === current;
            const live = !!x.href && !isCurrent;
            const body = (
              <>
                <span className="block h-1 w-full" style={{ background: x.color }} />
                <span className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                  <span className="flex items-center justify-between gap-2">
                    <PlatformLogo id={x.logo} size={40} className="shrink-0 rounded-[10px]" />
                    {isCurrent ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-white"
                        style={{ background: x.color }}
                      >
                        Buradasınız
                      </span>
                    ) : !x.href ? (
                      <span className="rounded border border-[var(--lk-line)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--lk-muted)]">
                        Yakında
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2.5 block text-[13.5px] font-bold leading-snug">{x.name}</span>
                  <span className="mt-1 block flex-1 text-[12px] leading-snug text-[var(--lk-muted)]">{x.text}</span>
                  {x.href && (
                    <span className="mt-2.5 block truncate text-[11.5px] font-semibold" style={{ color: x.color }}>
                      {x.href.replace("https://", "")}
                      {live && " ↗"}
                    </span>
                  )}
                </span>
              </>
            );
            const cls =
              "group flex h-full flex-col overflow-hidden rounded border bg-[var(--lk-panel)] transition-[border-color,box-shadow,transform] duration-150";
            return (
              <li key={x.id} className="min-w-0">
                {live ? (
                  <a
                    href={x.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cls} border-[var(--lk-line)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,.25)]`}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = x.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                  >
                    {body}
                  </a>
                ) : (
                  <div
                    className={`${cls} ${isCurrent ? "" : "border-[var(--lk-line)] opacity-80"}`}
                    style={isCurrent ? { borderColor: x.color } : undefined}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function BottomBar({ p }: { p: LoginPlatform }) {
  return (
    <footer className="border-t border-[var(--lk-line)] bg-[var(--lk-panel)]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-2 px-4 py-4 text-[12px] text-[var(--lk-muted)] sm:flex-row sm:px-6 lg:px-8">
        <span>
          © {new Date().getFullYear()} {p.name} · {DEV.name}
        </span>
        <span className="flex items-center gap-4">
          <a href={DEV.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--lk-text)]">LinkedIn</a>
          <a href={DEV.site} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--lk-text)]">fozanseyfi.com</a>
          <a href={DEV.email} className="hover:text-[var(--lk-text)]">E-posta</a>
        </span>
      </div>
    </footer>
  );
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────

export function LoginKitPage({ platform, form }: { platform: LoginPlatform; form: LoginFormProps }) {
  return (
    <div className="lk">
      <style>{kitCss(platform.accent, platform.accentDark)}</style>
      <TopBar p={platform} />
      <main className="flex-1">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:py-12">
          <div className="min-w-0 space-y-6">
            <LoginForm p={platform} form={form} />
            <DevNote />
          </div>
          <Intro p={platform} />
        </div>
        <TourStrip p={platform} />
        <PlatformList current={platform.id} />
      </main>
      <BottomBar p={platform} />
    </div>
  );
}
