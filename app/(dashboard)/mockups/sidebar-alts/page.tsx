import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import {
  ArrowLeft,
  LayoutDashboard,
  FolderOpen,
  Upload,
  LayoutTemplate,
  Users,
  Share2,
  ScrollText,
  UserCircle2,
  Bell,
  HelpCircle,
  MessageCircle,
  Boxes,
  Sun,
  LogOut,
  ChevronDown,
  BarChart3,
  Check,
} from "lucide-react";

// 5 alternatif sidebar tasarımı — sadece görsel inceleme için.
// Kullanıcı beğendiğini söyleyince gerçek sidebar componente uygulanacak.

const NAV_GROUPS = [
  {
    label: "Ana Menü",
    items: [{ icon: LayoutDashboard, label: "Dashboard", active: true }],
  },
  {
    label: "Çalışma Alanı",
    items: [
      { icon: FolderOpen, label: "Projeler" },
      { icon: Upload, label: "Proje Yükle" },
      { icon: LayoutTemplate, label: "Şablonlar" },
      { icon: Users, label: "Müşteriler" },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { icon: Users, label: "Kullanıcılar" },
      { icon: Share2, label: "Paylaşım Linkleri" },
      { icon: ScrollText, label: "Aktivite Kayıtları" },
      { icon: UserCircle2, label: "Profilim" },
      { icon: Bell, label: "Bildirimler" },
      { icon: BarChart3, label: "Firma Performansı" },
    ],
  },
  {
    label: "Destek",
    items: [
      { icon: HelpCircle, label: "Nasıl Çalışır" },
      { icon: MessageCircle, label: "İletişime Geç" },
    ],
  },
  {
    label: "Diğer Platformlar",
    items: [{ icon: Boxes, label: "Diğer Platformlar" }],
  },
];

export default async function SidebarAltsMockupPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/mockups"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5" />
          Mockup Listesine Dön
        </Link>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
          Sidebar Alternatifleri · Önizleme
        </span>
      </div>

      <header className="rounded-2xl border bg-white p-5">
        <h1 className="text-xl font-bold tracking-tight">Sidebar Renk/Stil Alternatifleri</h1>
        <p className="mt-1 text-[13px] text-slate-600">
          5 farklı stil — beğendiğini söyle (A/B/C/D/E), gerçek sidebar
          componente onu uygulayalım.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
          <span className="size-2 rounded-full bg-slate-900" />
          <strong>Mevcut:</strong> bg slate-900 · fg slate-300 (çok koyu)
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <SidebarCard
          letter="A"
          name="Light & Clean"
          rationale="Notion / Linear tarzı — beyaz arkaplan, slate yazılar, aktif itemda emerald tint. En modern ve nötr."
          variant="light"
        />
        <SidebarCard
          letter="B"
          name="Soft Gray"
          rationale="Hafif gri arkaplan (slate-50), beyaz değil ama parlak değil. Konseptçe Notion'a yakın ama daha yumuşak."
          variant="soft-gray"
        />
        <SidebarCard
          letter="C"
          name="Slate-700 (Mid Dark)"
          rationale="Mevcuda en yakın — sadece koyuluğu azaltır. Karanlık kalmasını seviyorsan ama tonu biraz açmak istiyorsan."
          variant="mid-dark"
        />
        <SidebarCard
          letter="D"
          name="Emerald Tinted"
          rationale="Çok hafif emerald yeşili arkaplan (emerald-50). Marka rengiyle entegre, sıcak ve davetkar."
          variant="emerald-tint"
        />
        <SidebarCard
          letter="E"
          name="Emerald Header + White"
          rationale="Üst banda emerald gradient (firma adı/kullanıcı orada), nav listesi beyaz. Hibrit — hem marka hem ferahlık."
          variant="hybrid"
        />
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
        <p className="text-[13px] text-emerald-900">
          <strong>Beğendiğin harfi söyle</strong> (örn. "B" veya "D"),{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] ring-1 ring-emerald-200">
            components/shared/sidebar.tsx
          </code>{" "}
          dosyasındaki renk token'larını ona göre güncelleyim.
        </p>
      </div>
    </div>
  );
}

type Variant = "light" | "soft-gray" | "mid-dark" | "emerald-tint" | "hybrid";

const VARIANT_STYLES: Record<
  Variant,
  {
    container: string;
    border?: string;
    title: string;
    role: string;
    groupLabel: string;
    navIdle: string;
    navIdleIcon: string;
    navActive: string;
    activeIndicator?: string;
    topbarUser: string;
    topbarFirm: string;
    chevron: string;
    section: string;
    logoBg: string;
    logoFg: string;
    logoutBtn: string;
  }
> = {
  light: {
    container: "bg-white border-r border-slate-200 text-slate-700",
    title: "text-slate-900",
    role: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200",
    groupLabel: "text-slate-400",
    navIdle: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    navIdleIcon: "text-slate-400",
    navActive: "bg-emerald-50 text-emerald-800 font-semibold",
    activeIndicator: "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-emerald-600",
    topbarUser: "text-slate-900",
    topbarFirm: "text-slate-500",
    chevron: "text-slate-400",
    section: "border-t border-slate-100",
    logoBg: "bg-emerald-600",
    logoFg: "text-white",
    logoutBtn: "text-slate-500 hover:bg-rose-50 hover:text-rose-700",
  },
  "soft-gray": {
    container: "bg-slate-50 border-r border-slate-200 text-slate-700",
    title: "text-slate-900",
    role: "text-emerald-700 bg-white ring-1 ring-emerald-200",
    groupLabel: "text-slate-400",
    navIdle: "text-slate-600 hover:bg-white hover:text-slate-900",
    navIdleIcon: "text-slate-400",
    navActive: "bg-white text-emerald-700 font-semibold shadow-sm ring-1 ring-slate-200",
    topbarUser: "text-slate-900",
    topbarFirm: "text-slate-500",
    chevron: "text-slate-400",
    section: "border-t border-slate-200",
    logoBg: "bg-emerald-600",
    logoFg: "text-white",
    logoutBtn: "text-slate-500 hover:bg-rose-50 hover:text-rose-700",
  },
  "mid-dark": {
    container: "bg-slate-700 text-slate-200",
    title: "text-white",
    role: "text-emerald-300 bg-emerald-900/40 ring-1 ring-emerald-700/40",
    groupLabel: "text-slate-400",
    navIdle: "text-slate-300 hover:bg-slate-600 hover:text-white",
    navIdleIcon: "text-slate-400",
    navActive: "bg-slate-800 text-white font-semibold",
    activeIndicator: "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-emerald-400",
    topbarUser: "text-white",
    topbarFirm: "text-slate-400",
    chevron: "text-slate-400",
    section: "border-t border-slate-600",
    logoBg: "bg-emerald-500",
    logoFg: "text-white",
    logoutBtn: "text-slate-400 hover:bg-rose-900/30 hover:text-rose-200",
  },
  "emerald-tint": {
    container: "bg-emerald-50 border-r border-emerald-100 text-slate-700",
    title: "text-emerald-900",
    role: "text-emerald-700 bg-white ring-1 ring-emerald-200",
    groupLabel: "text-emerald-700/60",
    navIdle: "text-slate-700 hover:bg-white hover:text-emerald-900",
    navIdleIcon: "text-emerald-700/60",
    navActive: "bg-emerald-600 text-white font-semibold shadow-sm",
    topbarUser: "text-emerald-900",
    topbarFirm: "text-emerald-700/70",
    chevron: "text-emerald-700/60",
    section: "border-t border-emerald-100",
    logoBg: "bg-white",
    logoFg: "text-emerald-700",
    logoutBtn: "text-slate-500 hover:bg-rose-50 hover:text-rose-700",
  },
  hybrid: {
    container: "bg-white border-r border-slate-200 text-slate-700",
    title: "text-white",
    role: "text-white bg-white/15 ring-1 ring-white/30",
    groupLabel: "text-slate-400",
    navIdle: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    navIdleIcon: "text-slate-400",
    navActive: "bg-emerald-50 text-emerald-800 font-semibold",
    activeIndicator: "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-emerald-600",
    topbarUser: "text-white",
    topbarFirm: "text-emerald-100",
    chevron: "text-emerald-100",
    section: "border-t border-slate-100",
    logoBg: "bg-white/20 backdrop-blur",
    logoFg: "text-white",
    logoutBtn: "text-slate-500 hover:bg-rose-50 hover:text-rose-700",
  },
};

function SidebarCard({
  letter,
  name,
  rationale,
  variant,
}: {
  letter: string;
  name: string;
  rationale: string;
  variant: Variant;
}) {
  const s = VARIANT_STYLES[variant];
  const isHybrid = variant === "hybrid";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
            {letter}
          </span>
          <strong className="text-[14px] text-slate-900">{name}</strong>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Check className="size-3" />
          {letter}'yi seç
        </button>
      </div>

      {/* Rationale */}
      <div className="border-b border-slate-100 bg-slate-50/30 px-4 py-2 text-[11.5px] text-slate-600">
        {rationale}
      </div>

      {/* Mini sidebar preview */}
      <div className={`flex h-[480px] w-full ${s.container}`}>
        <div className="flex w-full flex-col">
          {/* Top: firm + user box (hybrid'de gradient bar) */}
          <div
            className={
              isHybrid
                ? "bg-gradient-to-br from-emerald-600 to-emerald-700 px-3 py-3 text-white"
                : "px-3 py-3"
            }
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${s.logoBg} ${s.logoFg}`}
              >
                <Sun className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[11px] font-bold ${s.title}`}>
                  Solar Teklif
                </p>
                <p className={`truncate text-[9.5px] ${s.topbarFirm}`}>
                  Firma Adı A.Ş.
                </p>
              </div>
              <ChevronDown className={`size-3 ${s.chevron}`} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-black/5 px-2 py-1.5 text-[10.5px]">
              <span className={s.topbarUser}>
                <strong>Ozan S.</strong>
              </span>
              <span className={`rounded-full px-1.5 py-0 text-[9px] font-bold ${s.role}`}>
                Yönetici
              </span>
            </div>
          </div>

          {/* Nav groups */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="mb-2">
                <p
                  className={`mb-1 px-2 text-[9px] font-bold uppercase tracking-wider ${s.groupLabel}`}
                >
                  {g.label}
                </p>
                <ul className="space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    const isActive = "active" in it && it.active;
                    return (
                      <li key={it.label}>
                        <div
                          className={`relative flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                            isActive
                              ? `${s.navActive} ${s.activeIndicator ?? ""}`
                              : s.navIdle
                          }`}
                        >
                          <Icon
                            className={`size-3.5 ${isActive ? "" : s.navIdleIcon}`}
                          />
                          <span className="truncate">{it.label}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Logout */}
          <div className={`p-2 ${s.section}`}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${s.logoutBtn}`}
            >
              <LogOut className="size-3.5" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
