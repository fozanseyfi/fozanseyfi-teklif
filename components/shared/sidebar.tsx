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
}

function NavLink({ href, icon: Icon, label, active, collapsed }: NavLinkProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center rounded-lg text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
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
  const [collapsed, setCollapsed] = useState(false);

  // localStorage'dan tercihi oku ve --sidebar-w CSS var'ini ayarla; layout
  // bu var'a bagli olarak padding-left'i animate ediyor (bkz. (dashboard)/layout).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved === "1";
    setCollapsed(initial);
    document.documentElement.style.setProperty("--sidebar-w", initial ? "4rem" : "16rem");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      document.documentElement.style.setProperty("--sidebar-w", next ? "4rem" : "16rem");
      return next;
    });
  }

  return (
    <aside
      style={{ width: "var(--sidebar-w, 16rem)" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200"
    >
      {/* Toggle button — sidebar'in sag kenarinda yari disari, dairemsi rozet */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Menüyü aç" : "Menüyü kapat"}
        aria-label={collapsed ? "Menüyü aç" : "Menüyü kapat"}
        className="absolute right-0 top-20 z-40 flex size-6 translate-x-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted shadow-md transition-colors hover:bg-sidebar-border/50 hover:text-white"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>

      {/* Logo / firm */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "gap-3 px-5",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sun className="size-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">
              SolarTeklif
            </p>
            <p className="truncate text-xs text-sidebar-muted">{firmName}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-5" : ""}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.label}
              </p>
            )}
            {/* Collapsed iken gruplar arasinda kucuk ayirma cizgisi */}
            {collapsed && gi > 0 && (
              <div className="mx-2 mb-2 h-px bg-sidebar-border" />
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
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Hint card — sadece acikken */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-border/30 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="size-3.5 text-primary" />
            <p className="text-xs font-semibold text-white">Solar EPC Platform</p>
          </div>
          <p className="text-xs text-sidebar-muted">
            Güneş enerjisi teklif yönetimi
          </p>
        </div>
      )}

      {/* User */}
      <div
        className={cn(
          "border-t border-sidebar-border",
          collapsed ? "p-2" : "p-3",
        )}
      >
        <div
          className={cn(
            "mb-1 flex items-center rounded-lg bg-sidebar-border/30",
            collapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
          )}
          title={collapsed ? userName : undefined}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
            </div>
          )}
        </div>
        <form action={logout}>
          <button
            type="submit"
            title={collapsed ? "Çıkış Yap" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-border/40 hover:text-white",
              collapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Çıkış Yap"}
          </button>
        </form>
      </div>
    </aside>
  );
}
