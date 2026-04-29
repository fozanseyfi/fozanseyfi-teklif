import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Tag, Zap, Building2 } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  if (user.role !== "FIRM_ADMIN") redirect("/dashboard");

  const navItems = [
    { href: "/admin", icon: ShieldCheck, label: "Genel Bakış" },
    { href: "/admin/pricing", icon: Tag, label: "Referans Fiyatlar" },
    { href: "/admin/tariffs", icon: Zap, label: "Tarife Fiyatları" },
    { href: "/admin/firms", icon: Building2, label: "Firma Yönetimi" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform yönetim merkezi</p>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all duration-150"
            style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)" }}
          >
            <item.icon className="w-4 h-4 text-amber-400" />
            {item.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
