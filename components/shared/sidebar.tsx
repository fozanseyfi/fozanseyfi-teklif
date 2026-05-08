"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  LogOut,
  Sun,
  Users,
  Zap,
  MessageCircle,
  LayoutTemplate,
  HelpCircle,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userName: string;
  firmName: string;
  userRole: string;
}

interface NavGroup {
  label: string;
  items: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ana Menü",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/notifications", icon: Bell, label: "Bildirimler" },
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
    items: [{ href: "/firm-settings", icon: Settings, label: "Firma Ayarları" }],
  },
  {
    label: "Destek",
    items: [
      { href: "/help", icon: HelpCircle, label: "Nasıl Çalışır" },
      { href: "/contact", icon: MessageCircle, label: "İletişime Geç" },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  FIRM_ADMIN: "Yönetici",
  MANAGER: "Müdür",
  MEMBER: "Üye",
  VIEWER: "Gözlemci",
};

const STORAGE_KEY = "solar-sidebar-collapsed";

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavLink({ href, icon: Icon, label, active, collapsed, onNavigate }: NavLinkProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex items-center rounded-lg text-sm font-medium transition-colors",
        // Mobil drawer'da her zaman tam genişlik + label; collapsed sadece desktop'ta uygulanır
        "gap-3 px-3 py-2.5",
        collapsed && "lg:justify-center lg:gap-0 lg:px-2 lg:py-2",
        active
          ? "bg-sidebar-accent/20 text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-border/40 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-muted group-hover:text-sidebar-foreground",
        )}
      />
      {/* Label her zaman render edilir; desktop collapsed'da gizlenir */}
      <span className={cn("truncate", collapsed && "lg:hidden")}>{label}</span>
      {active && (
        <span
          className={cn(
            "ml-auto size-1.5 rounded-full bg-sidebar-accent-foreground",
            collapsed && "lg:hidden",
          )}
        />
      )}
    </Link>
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

export function Sidebar({ userName, firmName, userRole }: SidebarProps) {
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

        {/* Desktop: Panel: <firmName> */}
        <div
          className="hidden min-w-0 items-center gap-2 lg:flex"
          style={{ marginLeft: "var(--sidebar-w, 16rem)", transition: "margin-left 200ms" }}
        >
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-sm text-muted-foreground">Panel:</span>
          <span className="truncate text-sm font-semibold text-foreground">{firmName}</span>
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
                {group.items.map((item) => (
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
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Hint card — desktop collapsed'da gizli */}
        <div
          className={cn(
            "mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-border/30 p-3",
            showCollapsed ? "lg:hidden" : "",
          )}
        >
          <div className="mb-1 flex items-center gap-2">
            <Zap className="size-3.5 text-primary" />
            <p className="text-xs font-semibold text-white">Solar EPC Platform</p>
          </div>
          <p className="text-xs text-sidebar-muted">Güneş enerjisi teklif yönetimi</p>
        </div>
      </aside>
    </>
  );
}
