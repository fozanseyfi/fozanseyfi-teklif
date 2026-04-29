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

export function Sidebar({ userName, firmName, role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full w-64 fixed left-0 top-0 bottom-0 z-30"
      style={{ background: "linear-gradient(180deg, #0f1f3d 0%, #0a1628 100%)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 4px 12px rgba(245,158,11,0.4)" }}>
          <Sun className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm tracking-wide">SolarTeklif</p>
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{firmName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-5 px-3">
        <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
          Menü
        </p>
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "text-white"
                    : "hover:text-white"
                )}
                style={active ? {
                  background: "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(234,88,12,0.15) 100%)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  color: "#fff",
                } : {
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                  active ? "bg-amber-500/30" : "bg-white/5"
                )}>
                  <item.icon className={cn("w-3.5 h-3.5", active ? "text-amber-400" : "text-white/50")} />
                </div>
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </Link>
            );
          })}
        </div>

        {role === "FIRM_ADMIN" && (
          <div className="mt-6">
            <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
              Platform
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                    style={active ? {
                      background: "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(234,88,12,0.15) 100%)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      color: "#fff",
                    } : {
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", active ? "bg-amber-500/30" : "bg-white/5")}>
                      <item.icon className={cn("w-3.5 h-3.5", active ? "text-amber-400" : "text-white/50")} />
                    </div>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Stats hint */}
      <div className="mx-3 mb-3 rounded-xl p-3" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-xs font-semibold text-amber-300">Solar EPC Platform</p>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Güneş enerjisi teklif yönetimi</p>
      </div>

      {/* User */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-xs"
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 2px 8px rgba(245,158,11,0.35)" }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </form>
      </div>
    </div>
  );
}
