"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  UserCircle2,
} from "lucide-react";
import { logout, switchOrganization } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OrganizationOption {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface SidebarProps {
  userName: string;
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
    ],
  },
  {
    label: "Çalışma Alanı",
    items: [
      { href: "/projects", icon: FolderOpen, label: "Projeler" },
      { href: "/templates", icon: LayoutTemplate, label: "Şablonlar" },
      { href: "/customers", icon: Users, label: "Müşteriler" },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { href: "/admin/users", icon: Users, label: "Kullanıcılar", adminOnly: true },
      { href: "/firm-settings", icon: UserCircle2, label: "Profilim" },
      { href: "/notifications", icon: Bell, label: "Bildirimler" },
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
            "group flex w-full cursor-not-allowed items-center rounded-lg text-left text-sm font-medium transition-colors",
            "gap-3 px-3 py-2.5",
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
          "group flex items-center rounded-lg text-sm font-medium transition-colors",
          "gap-3 px-3 py-2.5",
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

// Top bar'da "Panel: <ad>" yerine dropdown — kullanicinin uye oldugu tum
// organizasyonlar listelenir, secim profile.organizationId'yi guncelleyip
// hard reload ile sayfayi sifirdan render eder.
function PanelSwitcher({
  firmName,
  organizations,
}: {
  firmName: string;
  organizations: OrganizationOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Dropdown her zaman tiklanabilir — tek panel varsa bile kullanici
  // "Panellerim" listesini gorebilsin. Profilim'de daha detayli panel
  // yonetimi (kendi paneline gec, davet rozetleri, vb.) var; bu sadece
  // hizli switcher.

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
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-sm text-muted-foreground">Panel:</span>
        <span className="truncate text-sm font-semibold text-foreground">{firmName}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="border-b bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Üye olduğun paneller
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {organizations.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(o.id)}
                  disabled={o.isActive || pending !== null}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                    o.isActive
                      ? "bg-primary-soft/40 cursor-default"
                      : "hover:bg-muted",
                    pending === o.id && "opacity-50",
                  )}
                >
                  <FolderOpen
                    className={cn(
                      "size-4 shrink-0",
                      o.isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{o.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {ROLE_LABEL[o.role] ?? o.role}
                    </p>
                  </div>
                  {o.isActive && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t bg-muted/30 px-3 py-2">
            <Link
              href="/firm-settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
            >
              Tüm panellerimi yönet →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
        aria-label="Kullanıcı menüsü"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="hidden min-w-0 text-left sm:block">
          <p className="truncate text-xs font-semibold leading-tight text-foreground">{name}</p>
          <p className="truncate text-[10px] leading-tight text-muted-foreground">{role}</p>
        </div>
        <ChevronDown
          className={cn(
            "hidden size-3.5 text-muted-foreground transition-transform sm:block",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border bg-card shadow-lg">
          {/* Mobile-only user header (since name/role hidden in trigger) */}
          <div className="border-b bg-muted/40 px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
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

export function Sidebar({ userName, firmName, userRole, organizations }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved === "1";
    setCollapsed(initial);
    document.documentElement.style.setProperty("--sidebar-w", initial ? "4rem" : "16rem");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
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
      document.documentElement.style.setProperty("--sidebar-w", next ? "4rem" : "16rem");
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
        style={{
          paddingLeft: undefined,
        }}
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
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sun className="size-4" />
            </div>
            <p className="truncate text-sm font-semibold text-foreground">SolarTeklif</p>
          </div>
        </div>

        {/* Desktop: Panel switcher (dropdown) */}
        <div
          className="hidden min-w-0 items-center gap-2 lg:flex"
          style={{ marginLeft: "var(--sidebar-w, 16rem)", transition: "margin-left 200ms" }}
        >
          <PanelSwitcher firmName={firmName} organizations={organizations ?? []} />
        </div>

        {/* Right: bell + user */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/notifications"
            aria-label="Bildirimler"
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-4" />
          </Link>
          <UserMenu name={userName} role={roleLabel} />
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
          "lg:translate-x-0 lg:[width:var(--sidebar-w,16rem)]",
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
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sun className="size-5" />
          </div>
          <div className={cn("min-w-0 flex-1", showCollapsed ? "lg:hidden" : "")}>
            <p className="text-sm font-semibold tracking-tight text-white">SolarTeklif</p>
            <p className="truncate text-xs text-sidebar-muted">{firmName}</p>
          </div>
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
                  "mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted",
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
