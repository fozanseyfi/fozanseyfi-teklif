"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  LogOut,
  Sun,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

interface SidebarProps {
  userName: string;
  firmName: string;
  role: UserRole;
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderOpen, label: "Projeler" },
  { href: "/customers", icon: Users, label: "Müşteriler" },
  { href: "/firm-settings", icon: Settings, label: "Firma Ayarları" },
];

const adminItems = [
  { href: "/admin", icon: ShieldCheck, label: "Admin Panel" },
];

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}

function NavLink({ href, icon: Icon, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent/20 text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-border/40 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-sidebar-accent-foreground" : "text-sidebar-muted group-hover:text-sidebar-foreground"
        )}
      />
      <span className="truncate">{label}</span>
      {active && (
        <span className="ml-auto size-1.5 rounded-full bg-sidebar-accent-foreground" />
      )}
    </Link>
  );
}

export function Sidebar({ userName, firmName, role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo / firm */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sun className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-white">SolarTeklif</p>
          <p className="truncate text-xs text-sidebar-muted">{firmName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
          Menü
        </p>
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          ))}
        </div>

        {role === "FIRM_ADMIN" && (
          <div className="mt-6">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              Platform
            </p>
            <div className="space-y-0.5">
              {adminItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hint card */}
      <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-border/30 p-3">
        <div className="mb-1 flex items-center gap-2">
          <Zap className="size-3.5 text-primary" />
          <p className="text-xs font-semibold text-white">Solar EPC Platform</p>
        </div>
        <p className="text-xs text-sidebar-muted">Güneş enerjisi teklif yönetimi</p>
      </div>

      {/* User */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-1 flex items-center gap-3 rounded-lg bg-sidebar-border/30 px-3 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-border/40 hover:text-white"
          >
            <LogOut className="size-4" />
            Çıkış Yap
          </button>
        </form>
      </div>
    </aside>
  );
}
