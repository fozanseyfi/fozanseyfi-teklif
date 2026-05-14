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
  BarChart3,
  ChevronsLeft,
  ArrowRight,
  Globe,
  Check,
} from "lucide-react";

// Referans: kullanıcı diğer platformundan ekran görüntüsü paylaştı.
// Karakteristik: açık/beyaz bg, üstte emerald gradient CTA pill, renkli
// vertical bar + dot ile section label'ları, sağ tarafta nokta aktif
// göstergesi, "DARALT <<" butonu.
//
// 5 varyasyon hazırladım — aynı temel iskelet, farklı vurgular.

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}

interface NavGroup {
  label: string;
  // Section indicator rengi — referansda her grubun farklı rengi var
  accent: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ana Menü",
    accent: "emerald",
    items: [{ icon: LayoutDashboard, label: "Dashboard", active: true }],
  },
  {
    label: "Çalışma Alanı",
    accent: "blue",
    items: [
      { icon: FolderOpen, label: "Projeler" },
      { icon: Upload, label: "Proje Yükle" },
      { icon: LayoutTemplate, label: "Şablonlar" },
      { icon: Users, label: "Müşteriler" },
    ],
  },
  {
    label: "Yönetim",
    accent: "purple",
    items: [
      { icon: Users, label: "Kullanıcılar" },
      { icon: Share2, label: "Paylaşım Linkleri" },
      { icon: ScrollText, label: "Aktivite Kayıtları" },
      { icon: UserCircle2, label: "Profilim" },
      { icon: BarChart3, label: "Firma Performansı" },
    ],
  },
  {
    label: "Destek",
    accent: "orange",
    items: [
      { icon: HelpCircle, label: "Nasıl Çalışır" },
      { icon: Bell, label: "Bildirimler" },
      { icon: MessageCircle, label: "İletişime Geç" },
    ],
  },
  {
    label: "Diğer",
    accent: "emerald",
    items: [{ icon: Boxes, label: "Diğer Platformlar" }],
  },
];

// Renk paleti — accent isimleri Tailwind class'larına eşlenir
const ACCENT_COLORS: Record<
  string,
  { dot: string; bar: string; label: string }
> = {
  emerald: { dot: "bg-emerald-500", bar: "bg-emerald-500", label: "text-emerald-700" },
  blue: { dot: "bg-blue-500", bar: "bg-blue-500", label: "text-blue-700" },
  purple: { dot: "bg-purple-500", bar: "bg-purple-500", label: "text-purple-700" },
  orange: { dot: "bg-orange-500", bar: "bg-orange-500", label: "text-orange-700" },
  slate: { dot: "bg-slate-400", bar: "bg-slate-400", label: "text-slate-500" },
};

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
          Sidebar — 5 Yeni Tasarım
        </span>
      </div>

      <header className="rounded-2xl border bg-white p-5">
        <h1 className="text-xl font-bold tracking-tight">
          Sidebar Tasarım Alternatifleri v2
        </h1>
        <p className="mt-1 text-[13px] text-slate-600">
          Paylaştığın referansa dayalı 5 farklı varyasyon — açık tema, renkli
          kategori çubukları, gradient CTA pill, nokta aktif göstergesi. Hangisini
          beğenirsen gerçek sidebar'a uygulayalım.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <SidebarPreview
          letter="V1"
          name="Referans Birebir"
          rationale="Paylaştığın ekran görüntüsünün direkt karşılığı — beyaz bg, her grup için farklı renkli vertical bar + dot, aktif item sağ tarafta yeşil nokta, üstte emerald gradient Portfolio pill."
          variant="reference"
        />
        <SidebarPreview
          letter="V2"
          name="Tek Aksent (Sadeleştirilmiş)"
          rationale="Aynı iskelet ama tüm gruplar slate-400. Renkli kategori yerine sade slate çubukları — daha minimal, dağılma yok. Marka rengi sadece aktif item ve CTA pill'de."
          variant="single-accent"
        />
        <SidebarPreview
          letter="V3"
          name="Pill Aktif"
          rationale="Referans ile aynı renkli grup başlıkları, ama aktif item sağdaki nokta yerine emerald-50 dolu pill'de — Notion tarzı. Daha belirgin."
          variant="pill-active"
        />
        <SidebarPreview
          letter="V4"
          name="Gradient Header + Beyaz Nav"
          rationale="Üst başlık + Portfolio pill emerald gradient bandı içinde. Nav listesi beyaz. Hibrit — marka rengi üstte güçlü, alttaki nav ferah."
          variant="gradient-top"
        />
        <SidebarPreview
          letter="V5"
          name="Kompakt + Sol Çubuk"
          rationale="Yoğun layout — küçük item satırları (compact spacing). Renkli vertical bar grup label'ının solunda, daha incelmiş. Daha fazla item ekrana sığar."
          variant="compact"
        />
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
        <p className="text-[13px] text-emerald-900">
          <strong>Beğendiğin numarayı söyle</strong> (örn. "V2" veya "V3"),{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] ring-1 ring-emerald-200">
            components/shared/sidebar.tsx
          </code>{" "}
          dosyasına uygulayalım.
        </p>
      </div>
    </div>
  );
}

type Variant =
  | "reference"
  | "single-accent"
  | "pill-active"
  | "gradient-top"
  | "compact";

function SidebarPreview({
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
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
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

      <div className="border-b border-slate-100 bg-slate-50/30 px-4 py-2 text-[11.5px] leading-relaxed text-slate-600">
        {rationale}
      </div>

      <div className="flex h-[640px] w-full bg-slate-50/30 p-3">
        <SidebarBody variant={variant} />
      </div>
    </div>
  );
}

function SidebarBody({ variant }: { variant: Variant }) {
  // Variant'a göre genel container stili
  const containerClass =
    variant === "gradient-top"
      ? "flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      : "flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

  return (
    <div className={containerClass}>
      {/* Header / Top */}
      <Header variant={variant} />

      {/* Portfolio CTA pill */}
      <PortfolioPill variant={variant} />

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 pt-2">
        {NAV_GROUPS.map((g, gi) => (
          <NavGroupRender key={g.label} group={g} variant={variant} isLast={gi === NAV_GROUPS.length - 1} />
        ))}
      </div>

      {/* Footer avatar */}
      <Footer />
    </div>
  );
}

function Header({ variant }: { variant: Variant }) {
  if (variant === "gradient-top") {
    return (
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-3 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15 backdrop-blur-sm">
              <BarChart3 className="size-3.5" />
            </div>
            <p className="text-[12px] font-bold">
              Solar <span className="font-normal text-emerald-100">Teklif</span>
            </p>
          </div>
          <button className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-100 hover:text-white">
            DARALT <ChevronsLeft className="size-3" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <BarChart3 className="size-3.5" />
        </div>
        <p className="text-[12px] font-bold text-slate-900">
          Solar <span className="font-normal text-slate-500">Teklif</span>
        </p>
      </div>
      <button className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 hover:text-slate-700">
        DARALT <ChevronsLeft className="size-3" />
      </button>
    </div>
  );
}

function PortfolioPill({ variant }: { variant: Variant }) {
  // Gradient-top varyasyonunda üstteki banttan sonra dış padding ile gelir
  return (
    <div className="px-2 pt-2">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-2.5 text-left text-white shadow-sm transition-transform hover:scale-[1.01]"
      >
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Globe className="size-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold leading-tight">Portfolio</p>
            <p className="text-[9px] text-emerald-50">Tüm Projeler</p>
          </div>
        </div>
        <ArrowRight className="size-3.5 text-white/80" />
      </button>
    </div>
  );
}

function NavGroupRender({
  group,
  variant,
  isLast,
}: {
  group: NavGroup;
  variant: Variant;
  isLast: boolean;
}) {
  const accent =
    variant === "single-accent" ? ACCENT_COLORS.slate : ACCENT_COLORS[group.accent];

  const compact = variant === "compact";

  return (
    <div className={compact ? "mb-1.5" : "mb-2.5"}>
      {/* Section label */}
      <div className="mb-1 flex items-center gap-1.5 px-2 pt-2">
        {variant === "compact" ? (
          <span className={`h-3 w-[2px] rounded-sm ${accent.bar}`} />
        ) : (
          <span className={`size-1.5 rounded-full ${accent.dot}`} />
        )}
        <p
          className={`text-[9px] font-bold uppercase tracking-[0.1em] ${accent.label}`}
        >
          {group.label}
        </p>
      </div>

      {/* Items */}
      <ul className={compact ? "space-y-0" : "space-y-0.5"}>
        {group.items.map((it) => (
          <NavItemRender key={it.label} item={it} variant={variant} />
        ))}
      </ul>

      {!isLast && variant !== "compact" && (
        <div className="mx-2 my-1 border-t border-slate-100" />
      )}
    </div>
  );
}

function NavItemRender({ item, variant }: { item: NavItem; variant: Variant }) {
  const Icon = item.icon;
  const active = item.active;

  // Pill aktif varyasyonu
  if (variant === "pill-active") {
    return (
      <li>
        <div
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
            active
              ? "bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Icon
            className={`size-3.5 ${active ? "text-emerald-600" : "text-slate-400"}`}
          />
          <span className="truncate">{item.label}</span>
        </div>
      </li>
    );
  }

  // Compact varyasyonu — daha sıkı padding
  if (variant === "compact") {
    return (
      <li>
        <div
          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] transition-colors ${
            active
              ? "bg-emerald-50/60 font-semibold text-emerald-700"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon
              className={`size-3.5 ${active ? "text-emerald-600" : "text-slate-500"}`}
            />
            <span className="truncate">{item.label}</span>
          </span>
          {active && <span className="size-1.5 rounded-full bg-emerald-500" />}
        </div>
      </li>
    );
  }

  // Default (V1/V2/V4): nokta aktif göstergesi sağda
  return (
    <li>
      <div
        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
          active
            ? "font-semibold text-emerald-700"
            : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            className={`size-3.5 ${active ? "text-emerald-600" : "text-slate-500"}`}
          />
          <span className="truncate">{item.label}</span>
        </span>
        {active && <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />}
      </div>
    </li>
  );
}

function Footer() {
  return (
    <div className="border-t border-slate-100 p-2">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
          O
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-slate-800">
            Ozan Seyfi
          </p>
          <p className="truncate text-[9.5px] text-slate-500">Yönetici</p>
        </div>
      </div>
    </div>
  );
}
