import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";
import { Toaster } from "sonner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      <Sidebar userName={user.name} firmName={user.firm.name} role={user.role} />
      <div className="pl-64">
        <main className="min-h-screen p-8">{children}</main>
      </div>
      <Toaster theme="light" position="top-right" richColors />
    </div>
  );
}
