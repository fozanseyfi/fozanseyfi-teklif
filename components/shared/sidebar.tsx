"use client";

import { useState, useEffect } from "react";
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
      { href: "/help", icon: HelpCircle, label: "Nasıl Çalışır" },
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
    items: [{ href: "/contact", icon: MessageCircle, label: "İletişime Geç" }],
  },
];

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
        // Mobilde dokunma alani buyuk olsun (44px hedef yukseklik)
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2.5",
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
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {active && (
            <span className="ml-auto size-1.5 rounded-full bg-sidebar-accent-foreground" />
          )}
        </>
      )}
    </Link>
  );
}

export function Sidebar({ userName, firmName }: SidebarProps) {
  const pathname = usePathname();
  // Desktop'ta collapse durumu (lg breakpoint ve üstü); persist edilir.
  const [collapsed, setCollapsed] = useState(false);
  // Mobil'de drawer açık/kapalı; persist edilmez, route değiştikçe kapanır.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mevcut tercihi yükle + CSS var'ı set et — layout padding bunu kullanır.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved === "1";
    setCollapsed(initial);
    document.documentElement.style.setProperty("--sidebar-w", initial ? "4rem" : "16rem");
  }, []);

  // Route değiştikçe mobile drawer'ı kapat (link tıklanınca da onNavigate çalışır
  // ama programatik route değişiklikleri için ek güvence).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Drawer açıkken body scroll'u kilitle (mobil UX standardı).
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

  // Mobilde sidebar her zaman 16rem (collapse desktop-only). Drawer'ın görünürlüğü
  // translate-x ile, padding/width ile değil.
  const showCollapsed = collapsed; // sadece desktop'ta uygulanır CSS ile

  return (
    <>
      {/* Mobile top bar — yalnızca lg altında görünür, sticky */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          className="flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sun className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">SolarTeklif</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{firmName}</p>
          </div>
        </div>
      </header>

      {/* Mobile backdrop — drawer açıkken */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar — mobilde drawer (translate-x), desktop'ta fixed */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground",
          "transition-[transform,width] duration-200",
          // Mobil: 16rem genişlik sabit, drawer açıkken görünür
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop (lg+): her zaman görünür, genişlik CSS var ile
          "lg:translate-x-0 lg:[width:var(--sidebar-w,16rem)]",
        )}
      >
        {/* Toggle button (desktop) — collapse/expand chevron */}
        <button
          type="button"
          onClick={toggleCollapse}
          title={collapsed ? "Menüyü aç" : "Menüyü kapat"}
          aria-label={collapsed ? "Menüyü aç" : "Menüyü kapat"}
          className="absolute right-0 top-20 z-40 hidden size-6 translate-x-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted shadow-md transition-colors hover:bg-sidebar-border/50 hover:text-white lg:flex"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Menüyü kapat"
          className="absolute right-3 top-3 z-40 flex size-9 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-border/40 hover:text-white lg:hidden"
        >
          <X className="size-5" />
        </button>

        {/* Logo / firm */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border",
            "max-lg:gap-3 max-lg:px-5",
            showCollapsed ? "lg:justify-center lg:px-2" : "lg:gap-3 lg:px-5",
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sun className="size-5" />
          </div>
          <div className={cn("min-w-0", showCollapsed ? "lg:hidden" : "")}>
            <p className="text-sm font-semibold tracking-tight text-white">SolarTeklif</p>
            <p className="truncate text-xs text-sidebar-muted">{firmName}</p>
          </div>
        </div>

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
              {/* Collapsed iken gruplar arasinda kucuk ayirma cizgisi */}
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

        {/* Hint card — mobil drawer'da hep görünür, desktop collapsed'da gizli */}
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

        {/* User */}
        <div
          className={cn(
            "border-t border-sidebar-border",
            showCollapsed ? "lg:p-2" : "lg:p-3",
            "max-lg:p-3",
          )}
        >
          <div
            className={cn(
              "mb-1 flex items-center rounded-lg bg-sidebar-border/30",
              showCollapsed ? "lg:justify-center lg:p-2" : "lg:gap-3 lg:px-3 lg:py-2",
              "max-lg:gap-3 max-lg:px-3 max-lg:py-2",
            )}
            title={showCollapsed ? userName : undefined}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={cn("min-w-0 flex-1", showCollapsed ? "lg:hidden" : "")}>
              <p className="truncate text-sm font-medium text-white">{userName}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title={showCollapsed ? "Çıkış Yap" : undefined}
              className={cn(
                "flex w-full items-center rounded-lg text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-border/40 hover:text-white",
                showCollapsed ? "lg:justify-center lg:p-2" : "lg:gap-3 lg:px-3 lg:py-2",
                "max-lg:gap-3 max-lg:px-3 max-lg:py-2.5",
              )}
            >
              <LogOut className="size-4 shrink-0" />
              <span className={cn(showCollapsed ? "lg:hidden" : "")}>Çıkış Yap</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
