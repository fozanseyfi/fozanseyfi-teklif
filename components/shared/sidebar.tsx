"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUnreadCount } from "@/app/actions/notifications";
import {
  LayoutDashboard,
  FolderOpen,
  LogOut,
  Sun,
  Users,
  MessageCircle,
  LayoutTemplate,
  HelpCircle,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ScrollText,
  FileSignature,
  NotebookPen,
  CalendarDays,
  Share2,
  Search,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  UserCircle2,
  Package,
  PlayCircle,
  Wallet,
  Truck,
  SunMedium,
} from "lucide-react";
import { logout, switchOrganization } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface OrganizationOption {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface SidebarProps {
  userName: string;
  userEmail: string;
  firmName: string;
  userRole: string;
  organizations?: OrganizationOption[];
}

interface NavGroup {
  label: string;
  items: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    adminOnly?: boolean;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ana Menü",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/takvim", icon: CalendarDays, label: "Takvim" },
    ],
  },
  {
    label: "Çalışma Alanı",
    items: [
      { href: "/projects", icon: FolderOpen, label: "Teklifler" },
      { href: "/templates", icon: LayoutTemplate, label: "Şablonlar" },
      { href: "/sozlesmeler", icon: FileSignature, label: "Sözleşmeler" },
      { href: "/cost-control", icon: Wallet, label: "Maliyet Kontrol" },
      { href: "/customers", icon: Users, label: "Müşteriler" },
      { href: "/suppliers", icon: Truck, label: "Tedarikçiler" },
      { href: "/materials", icon: Package, label: "Malzemeler" },
      { href: "/tasarim", icon: SunMedium, label: "3D Tasarım" },
      { href: "/not-defteri", icon: NotebookPen, label: "Not Defteri" },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { href: "/admin/users", icon: Users, label: "Kullanıcılar", adminOnly: true },
      { href: "/admin/share-links", icon: Share2, label: "Paylaşım Linkleri" },
      { href: "/admin/audit", icon: ScrollText, label: "Aktivite Kayıtları", adminOnly: true },
      { href: "/firm-settings", icon: UserCircle2, label: "Profilim" },
      { href: "/notifications", icon: Bell, label: "Bildirimler" },
      { href: "/admin/insights", icon: BarChart3, label: "Firma Performansı", adminOnly: true },
    ],
  },
  {
    label: "Destek",
    items: [
      { href: "/help", icon: HelpCircle, label: "Nasıl Çalışır" },
      { href: "/contact", icon: MessageCircle, label: "İletişime Geç" },
    ],
  },
  {
    label: "Tanıtım",
    items: [{ href: "/platform-tanitimi", icon: PlayCircle, label: "Platform Tanıtımı" }],
  },
  {
    label: "Diğer Platformlar",
    items: [{ href: "/platforms", icon: Boxes, label: "Diğer Platformlar" }],
  },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Yönetici",
  user: "Kullanıcı",
  viewer: "Görüntüleyici",
};

const STORAGE_KEY = "solar-sidebar-collapsed";

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  disabled?: boolean;
  disabledMessage?: string;
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  onNavigate,
  disabled = false,
  disabledMessage,
}: NavLinkProps) {
  // Sidebar daraltikken hover'da custom tooltip — native title degil, portal ile
  // body'ye render edilir, overflow clip'inden etkilenmez.
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  function handleEnter(e: React.MouseEvent<HTMLElement>) {
    if (!collapsed) return;
    if (typeof window === "undefined" || window.innerWidth < 1024) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  }

  function handleLeave() {
    setTooltipPos(null);
  }

  // Yetkisiz erisim — tiklanabilir buton ama navigate etmez, sadece toast.
  // Sidebar'da gozukmeye devam etsin ki kullanici bilsin "burada bir sey
  // var ama bana kapali"; tiklayinca rolu hakkinda bilgilendirme alir.
  const linkContent = (
    <>
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          disabled
            ? "text-sidebar-muted/60"
            : active
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-muted group-hover:text-sidebar-foreground",
        )}
      />
      <span
        className={cn(
          "truncate",
          collapsed && "lg:hidden",
          disabled && "text-sidebar-muted/70",
        )}
      >
        {label}
      </span>
      {disabled && (
        <span
          className={cn(
            "ml-auto rounded-full border border-sidebar-border/40 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-sidebar-muted/70",
            collapsed && "lg:hidden",
          )}
        >
          Yetki yok
        </span>
      )}
      {!disabled && active && (
        <span
          className={cn(
            "ml-auto size-1.5 rounded-full bg-sidebar-accent-foreground",
            collapsed && "lg:hidden",
          )}
        />
      )}
    </>
  );

  if (disabled) {
    return (
      <>
        <button
          type="button"
          onClick={() =>
            toast.error(disabledMessage ?? "Bu sayfaya yalnızca yöneticiler erişebilir.")
          }
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={cn(
            "group flex w-full cursor-not-allowed items-center rounded-lg text-left text-[12px] font-medium transition-colors",
            "gap-2 px-2.5 py-1.5",
            collapsed && "lg:justify-center lg:gap-0 lg:px-2 lg:py-2",
            "text-sidebar-muted/70 hover:bg-sidebar-border/30",
          )}
          aria-disabled="true"
        >
          {linkContent}
        </button>
        {tooltipPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[100] hidden select-none nav-tooltip-enter lg:block"
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
              <div className="relative rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
                {label} · Yetki yok
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-y-[5px] border-r-[5px] border-y-transparent border-r-slate-900" />
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  return (
    <>
      <Link
        href={href}
        onClick={() => {
          setTooltipPos(null);
          onNavigate?.();
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={cn(
          "group flex items-center rounded-lg text-[12px] font-medium transition-colors",
          "gap-2 px-2.5 py-1.5",
          collapsed && "lg:justify-center lg:gap-0 lg:px-2 lg:py-2",
          active
            ? "bg-sidebar-accent/20 text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-border/40 hover:text-sidebar-accent-foreground",
        )}
      >
        {linkContent}
      </Link>
      {tooltipPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[100] hidden select-none nav-tooltip-enter lg:block"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            <div className="relative rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
              {label}
              {/* Sol tarafa bakan ok */}
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-y-[5px] border-r-[5px] border-y-transparent border-r-slate-900" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Üst barın solundaki hesap menüsü (Fizibilite ile aynı yerleşim): avatar + ad +
// çalışılan panel (şirket) + e-posta. Açılır listede kullanıcının üye olduğu
// paneller (tıklayınca o panele geçilir), Profilim ve Çıkış Yap bulunur.
// Panel değişimi profile.organizationId'yi günceller ve sayfayı sıfırdan yükler.
function AccountMenu({
  name,
  email,
  role,
  firmName,
  organizations,
  compact = false,
}: {
  name: string;
  email: string;
  role: string;
  firmName: string;
  organizations: OrganizationOption[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSwitch(orgId: string) {
    if (pending) return;
    setPending(orgId);
    try {
      await switchOrganization(orgId);
      setOpen(false);
      // Hard reload — yeni org context'i sunucu render'ina yansisin diye.
      window.location.href = "/dashboard";
    } finally {
      setPending(null);
    }
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Hesap ve panel menüsü"
        aria-expanded={open}
        className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
      >
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-white"
          data-no-i18n
        >
          {initials(name)}
        </div>
        {!compact && (
          <>
            <div className="min-w-0 leading-tight">
              <p className="flex min-w-0 items-center gap-1.5" data-no-i18n>
                <span className="truncate text-[13px] font-semibold text-foreground">{name}</span>
                <span className="shrink-0 text-muted-foreground/60">·</span>
                <span className="truncate rounded bg-primary-soft px-1.5 py-px text-[11px] font-semibold text-primary-soft-foreground">
                  {firmName}
                </span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground" data-no-i18n>
                {email}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border bg-card shadow-lg",
            compact ? "right-0" : "left-0",
          )}
        >
          <div className="border-b bg-secondary/40 px-3 py-2">
            <p className="truncate text-sm font-semibold text-foreground" data-no-i18n>
              {name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              <span data-no-i18n>{email}</span> · {role}
            </p>
          </div>

          <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Çalışılan panel
          </p>
          <ul className="max-h-60 overflow-y-auto pb-1">
            {organizations.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(o.id)}
                  disabled={o.isActive || pending !== null}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                    o.isActive ? "cursor-default bg-primary-soft/50" : "hover:bg-secondary",
                    pending === o.id && "opacity-50",
                  )}
                >
                  <Building2
                    className={cn(
                      "size-4 shrink-0",
                      o.isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground" data-no-i18n>
                      {o.name}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {ROLE_LABEL[o.role] ?? o.role}
                    </p>
                  </div>
                  {o.isActive && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>

          <Link
            href="/firm-settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <UserCircle2 className="size-4 text-muted-foreground" />
            Profilim ve panellerim
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Çıkış Yap
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userName, userEmail, firmName, userRole, organizations }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount'ta localStorage'dan başlangıç durumu (dış senkronizasyon)
    setCollapsed(initial);
    document.documentElement.style.setProperty("--sidebar-w", initial ? "4rem" : "14rem");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rota değişince mobil menüyü kapat (dış senkronizasyon)
    setMobileOpen(false);
  }, [pathname]);

  // Okunmamis bildirim sayisi — vakti gelen takvim hatirlatmalarini da isler.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      getUnreadCount()
        .then((n) => { if (alive) setUnread(n); })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      document.documentElement.style.setProperty("--sidebar-w", next ? "4rem" : "14rem");
      return next;
    });
  }

  const showCollapsed = collapsed;
  const roleLabel = ROLE_LABEL[userRole] ?? userRole;

  return (
    <>
      {/* Sticky top bar — mobil + desktop, içerik responsive değişir */}
      <header
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md sm:px-4 lg:px-6"
      >
        {/* Desktop: padding-left sidebar genişliğine göre */}
        <div className="contents lg:hidden">
          {/* Mobile: hamburger + brand */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Menüyü aç"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
          <Link
            href="/dashboard"
            aria-label="Dashboard'a git"
            className="flex min-w-0 items-center gap-2 rounded-lg transition-opacity hover:opacity-80"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sun className="size-4" />
            </div>
            <p className="shimmer-text truncate text-sm font-semibold text-foreground">
              Teklif Platformu
            </p>
          </Link>
        </div>

        {/* Masaüstü: hesap + panel menüsü sidebar'ın hemen sağında */}
        <div
          className="hidden min-w-0 items-center lg:flex"
          style={{ marginLeft: "var(--sidebar-w, 14rem)", transition: "margin-left 200ms" }}
        >
          <AccountMenu
            name={userName}
            email={userEmail}
            role={roleLabel}
            firmName={firmName}
            organizations={organizations ?? []}
          />
        </div>

        {/* Sağ: arama + bildirim + dil + tema (mobilde ayrıca hesap menüsü) */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Global Ctrl+K arama tetikleyici — ikon (mobile) veya rozet (desktop). */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("solar:open-search"))}
            aria-label="Ara (Ctrl+K)"
            title="Ara — Ctrl+K"
            className="hidden h-9 items-center gap-2 rounded-md border border-border bg-secondary px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground md:flex"
          >
            <Search className="size-3.5" />
            <span className="text-[11.5px]">Ara</span>
            <kbd className="rounded border border-border bg-background/60 px-1 py-0 font-mono text-[9.5px] font-semibold" data-no-i18n>
              Ctrl+K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("solar:open-search"))}
            aria-label="Ara"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          >
            <Search className="size-4" />
          </button>
          <Link
            href="/notifications"
            aria-label="Bildirimler"
            title="Bildirimler"
            className="relative flex size-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground transition-colors hover:bg-secondary/80"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <LocaleToggle />
          <ThemeToggle />
          <div className="lg:hidden">
            <AccountMenu
              compact
              name={userName}
              email={userEmail}
              role={roleLabel}
              firmName={firmName}
              organizations={organizations ?? []}
            />
          </div>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar — mobilde drawer, desktop'ta fixed */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground",
          "transition-[transform,width] duration-200",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:[width:var(--sidebar-w,14rem)]",
        )}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Menüyü kapat"
          className="absolute right-3 top-3 z-40 flex size-9 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-border/40 hover:text-white lg:hidden"
        >
          <X className="size-5" />
        </button>

        {/* Logo / firm — sidebar başlığı + collapse chevron */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border",
            "max-lg:gap-3 max-lg:px-5",
            showCollapsed ? "lg:justify-center lg:px-2" : "lg:gap-3 lg:pl-5 lg:pr-2",
          )}
        >
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="Dashboard'a git"
            title="Dashboard'a git"
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-80",
              showCollapsed ? "lg:flex-none lg:gap-0" : "flex-1",
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sun className="size-5" />
            </div>
            <div className={cn("min-w-0 flex-1", showCollapsed ? "lg:hidden" : "")}>
              <p className="truncate text-sm font-semibold tracking-tight text-white">
                Teklif Platformu
              </p>
            </div>
          </Link>
          {/* Collapse chevron — desktop only */}
          <button
            type="button"
            onClick={toggleCollapse}
            title={collapsed ? "Menüyü aç" : "Menüyü kapat"}
            aria-label={collapsed ? "Menüyü aç" : "Menüyü kapat"}
            className={cn(
              "hidden size-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-border/50 hover:text-white lg:flex",
              showCollapsed && "lg:hidden",
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        {/* Collapsed state'te ayrı bir expand butonu (sidebar header altında) */}
        {showCollapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            title="Menüyü aç"
            aria-label="Menüyü aç"
            className="mx-auto mt-2 hidden size-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-border/50 hover:text-white lg:flex"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-4", showCollapsed ? "lg:px-2" : "lg:px-3", "max-lg:px-3")}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-5" : ""}>
              <p
                className={cn(
                  "mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/80",
                  showCollapsed ? "lg:hidden" : "",
                )}
              >
                {group.label}
              </p>
              {showCollapsed && gi > 0 && (
                <div className="mx-2 mb-2 hidden h-px bg-sidebar-border lg:block" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isAdminOnlyDenied = item.adminOnly && userRole !== "admin";
                  return (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={
                        pathname === item.href || pathname.startsWith(item.href + "/")
                      }
                      collapsed={showCollapsed}
                      onNavigate={() => setMobileOpen(false)}
                      disabled={isAdminOnlyDenied}
                      disabledMessage={
                        isAdminOnlyDenied
                          ? "Bu sayfaya yalnızca yöneticiler erişebilir."
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

      </aside>
    </>
  );
}
