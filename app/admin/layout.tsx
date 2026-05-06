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
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Panel</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Platform yönetim merkezi</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-soft-foreground"
          >
            <item.icon className="size-4 text-primary" />
            {item.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
